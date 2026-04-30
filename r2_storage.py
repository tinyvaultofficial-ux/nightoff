"""Cloudflare R2 (S3 호환) 마스터 PPTX 스토리지.

전체 흐름:
  1. 서버 시작 시 sync_master_templates() 호출
  2. R2 버킷의 *.pptx 목록 → 로컬 master_templates/ 와 비교
  3. ETag (또는 LastModified) 기준으로 새 것만 다운로드
  4. 로컬 파일명: R2 의 키를 그대로 따르되, '/' → '_' 치환
  5. 첫 번째 파일은 dmz_default.pptx 로도 심볼릭 (find_master_template 호환)

환경변수:
  R2_ACCESS_KEY_ID        — Cloudflare R2 Access Key
  R2_SECRET_ACCESS_KEY    — Secret
  R2_ENDPOINT_URL         — https://<account-id>.r2.cloudflarestorage.com
  R2_BUCKET_NAME          — 버킷 이름 (예: nightoff-templates)
  R2_DEFAULT_KEY          — (옵션) 기본 마스터로 쓸 객체 키. 없으면 첫 *.pptx
  R2_LOCAL_CACHE_DIR      — (옵션) 다운로드 경로. 기본 ./master_templates

graceful 동작:
  - boto3 미설치 → 경고 로그 + skip
  - 환경변수 누락 → 경고 로그 + skip
  - 네트워크 실패 → 경고 로그 + skip (로컬에 이미 있는 파일 그대로 사용)
"""
from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Optional

log = logging.getLogger("nightoff.r2")

# boto3 는 옵셔널 — 미설치여도 import 단계는 통과해야 함
try:
    import boto3
    from botocore.config import Config as BotoConfig
    from botocore.exceptions import BotoCoreError, ClientError
    _BOTO3_AVAILABLE = True
except Exception as e:
    boto3 = None  # type: ignore
    BotoConfig = None  # type: ignore
    BotoCoreError = Exception  # type: ignore
    ClientError = Exception  # type: ignore
    _BOTO3_AVAILABLE = False
    log.warning("boto3 import 실패 — R2 동기화 비활성: %s", e)


def _safe_local_name(key: str) -> str:
    """R2 객체 키를 로컬 파일명으로 안전 변환."""
    # 슬래시는 언더스코어로
    name = key.replace("/", "_").replace("\\", "_")
    # 너무 긴 파일명은 OS 제한 회피 (255 → 200 으로)
    if len(name) > 200:
        stem, dot, ext = name.rpartition(".")
        name = stem[:190] + dot + ext
    return name


def _local_cache_dir() -> Path:
    p = Path(os.environ.get("R2_LOCAL_CACHE_DIR") or (Path(__file__).parent / "master_templates"))
    p.mkdir(parents=True, exist_ok=True)
    return p


def _is_configured() -> bool:
    return all(
        os.environ.get(k) for k in (
            "R2_ACCESS_KEY_ID",
            "R2_SECRET_ACCESS_KEY",
            "R2_ENDPOINT_URL",
            "R2_BUCKET_NAME",
        )
    )


def _client():
    """R2 S3-compatible client."""
    if not _BOTO3_AVAILABLE:
        return None
    cfg = BotoConfig(
        signature_version="s3v4",
        retries={"max_attempts": 3, "mode": "standard"},
        connect_timeout=10,
        read_timeout=60,
    )
    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT_URL"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=cfg,
    )


def _etag_marker_path(local_path: Path) -> Path:
    """ETag 비교용 사이드카 파일 (.etag)."""
    return local_path.with_suffix(local_path.suffix + ".etag")


def _read_marker(p: Path) -> Optional[str]:
    try:
        return p.read_text(encoding="utf-8").strip() or None
    except Exception:
        return None


def _write_marker(p: Path, etag: str) -> None:
    try:
        p.write_text(etag, encoding="utf-8")
    except Exception as e:
        log.warning("ETag marker write 실패 (%s): %s", p, e)


def list_objects(suffix: str | None = ".pptx") -> list[dict]:
    """R2 버킷의 객체 목록.

    Args:
      suffix: 필터링할 확장자 (e.g. '.pptx'). None 이면 모두.
    """
    if not _is_configured() or not _BOTO3_AVAILABLE:
        return []
    bucket = os.environ["R2_BUCKET_NAME"]
    out: list[dict] = []
    try:
        client = _client()
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=bucket):
            for obj in page.get("Contents", []) or []:
                key = obj.get("Key") or ""
                if suffix and not key.lower().endswith(suffix):
                    continue
                out.append({
                    "key": key,
                    "etag": (obj.get("ETag") or "").strip('"'),
                    "size": obj.get("Size") or 0,
                    "last_modified": obj.get("LastModified"),
                })
    except (BotoCoreError, ClientError, Exception) as e:
        log.warning("R2 list_objects 실패: %s", e)
    return out


def download_one(key: str, local_path: Optional[Path] = None) -> Optional[Path]:
    """단일 객체 다운로드 (ETag 비교 — 동일하면 skip)."""
    if not _is_configured() or not _BOTO3_AVAILABLE:
        return None
    bucket = os.environ["R2_BUCKET_NAME"]
    cache = _local_cache_dir()
    local_path = local_path or (cache / _safe_local_name(key))
    marker = _etag_marker_path(local_path)
    try:
        client = _client()
        head = client.head_object(Bucket=bucket, Key=key)
        etag = (head.get("ETag") or "").strip('"')
        size = head.get("ContentLength") or 0
        prev = _read_marker(marker)
        if local_path.exists() and prev == etag and local_path.stat().st_size == size:
            log.info("R2 캐시 HIT  · %s (etag=%s, size=%s)", key, etag[:10], size)
            return local_path
        log.info("R2 다운로드 · %s → %s (size=%s)", key, local_path.name, size)
        client.download_file(bucket, key, str(local_path))
        _write_marker(marker, etag)
        return local_path
    except (BotoCoreError, ClientError, Exception) as e:
        log.warning("R2 download 실패 (%s): %s", key, e)
        # 로컬에 이미 있으면 그것 사용
        return local_path if local_path.exists() else None


def sync_master_templates() -> dict:
    """버킷의 모든 PPTX 동기화 + 기본 마스터 alias 생성.

    return: {"downloaded": N, "skipped": N, "failed": N, "default": Path|None}
    """
    result = {"downloaded": 0, "skipped": 0, "failed": 0, "default": None}
    if not _BOTO3_AVAILABLE:
        log.warning("R2 sync skip — boto3 미설치")
        return result
    if not _is_configured():
        log.info("R2 sync skip — 환경변수 미설정 (로컬 master_templates/ 사용)")
        return result

    cache = _local_cache_dir()
    objects = list_objects()
    log.info("R2 객체 %d 개 발견 (bucket=%s)", len(objects), os.environ["R2_BUCKET_NAME"])

    downloaded_paths: list[tuple[str, Path]] = []
    for obj in objects:
        key = obj["key"]
        local = cache / _safe_local_name(key)
        marker = _etag_marker_path(local)
        prev = _read_marker(marker)
        if local.exists() and prev == obj["etag"]:
            result["skipped"] += 1
            downloaded_paths.append((key, local))
            continue
        p = download_one(key, local)
        if p is not None:
            result["downloaded"] += 1
            downloaded_paths.append((key, p))
        else:
            result["failed"] += 1

    # 기본 마스터 alias (find_master_template 가 dmz_default.pptx 를 찾음)
    default_alias = cache / "dmz_default.pptx"
    default_key = os.environ.get("R2_DEFAULT_KEY", "").strip()

    chosen: Optional[Path] = None
    if default_key:
        for k, p in downloaded_paths:
            if k == default_key:
                chosen = p
                break
    if chosen is None and downloaded_paths:
        # 키 이름에 'DMZ' 또는 'default' 포함 우선 → 없으면 첫 번째
        for k, p in downloaded_paths:
            if re.search(r"DMZ|default", k, re.IGNORECASE):
                chosen = p
                break
        if chosen is None:
            chosen = downloaded_paths[0][1]

    if chosen is not None and chosen.exists():
        try:
            # Windows 는 symlink 권한 이슈 → 단순 copy 로 alias 보장
            if default_alias.resolve() != chosen.resolve():
                if default_alias.exists():
                    default_alias.unlink()
                # 같은 디렉토리 내라서 hardlink 가능하면 그게 가장 빠름
                try:
                    os.link(chosen, default_alias)
                    log.info("기본 마스터 alias (hardlink): %s → %s", default_alias.name, chosen.name)
                except (OSError, NotImplementedError):
                    import shutil
                    shutil.copy2(chosen, default_alias)
                    log.info("기본 마스터 alias (copy):     %s → %s", default_alias.name, chosen.name)
            result["default"] = default_alias
        except Exception as e:
            log.warning("기본 마스터 alias 생성 실패: %s", e)
            result["default"] = chosen

    log.info(
        "R2 sync 완료 · 다운로드 %d · skip %d · 실패 %d · default=%s",
        result["downloaded"], result["skipped"], result["failed"],
        getattr(result["default"], "name", None),
    )
    return result


def sync_rag_db() -> dict:
    """R2 의 rag_kb.db 다운로드 → 워크트리 루트.

    NightOff 의 RAG 검색에 필수. 177MB 정도라 git 에 못 넣어서 R2 통해 배포.

    return: {"downloaded": bool, "size_mb": float, "skipped": bool, "error": str|None}
    """
    result = {"downloaded": False, "size_mb": 0.0, "skipped": False, "error": None}
    if not _BOTO3_AVAILABLE:
        result["error"] = "boto3 미설치"
        return result
    if not _is_configured():
        result["error"] = "R2 환경변수 미설정"
        return result
    bucket = os.environ["R2_BUCKET_NAME"]
    # 워크트리 루트 = 이 파일의 디렉토리
    root = Path(__file__).parent
    local = root / "rag_kb.db"
    marker = _etag_marker_path(local)
    try:
        client = _client()
        head = client.head_object(Bucket=bucket, Key="rag_kb.db")
        etag = (head.get("ETag") or "").strip('"')
        size = head.get("ContentLength") or 0
        prev = _read_marker(marker)
        result["size_mb"] = round(size / 1024 / 1024, 1)
        if local.exists() and prev == etag and local.stat().st_size == size:
            log.info("RAG DB 캐시 HIT · etag=%s · %s MB", etag[:10], result["size_mb"])
            result["skipped"] = True
            return result
        log.info("RAG DB 다운로드 시작 · %s MB", result["size_mb"])
        client.download_file(bucket, "rag_kb.db", str(local))
        _write_marker(marker, etag)
        log.info("RAG DB 다운로드 완료 · %s", local.name)
        result["downloaded"] = True
    except ClientError as e:
        if hasattr(e, "response") and e.response.get("Error", {}).get("Code") in ("404", "NoSuchKey"):
            log.info("R2 에 rag_kb.db 없음 — RAG 비활성 모드로 진행")
            result["error"] = "rag_kb.db not in R2"
        else:
            log.warning("RAG DB 다운로드 실패: %s", e)
            result["error"] = str(e)[:120]
    except (BotoCoreError, Exception) as e:
        log.warning("RAG DB 다운로드 예외: %s", e)
        result["error"] = str(e)[:120]
    return result


def status() -> dict:
    """진단용 — 현재 R2 설정 / 캐시 상태."""
    cache = _local_cache_dir()
    files = sorted([f.name for f in cache.glob("*.pptx")])
    return {
        "boto3_available": _BOTO3_AVAILABLE,
        "configured": _is_configured(),
        "endpoint": os.environ.get("R2_ENDPOINT_URL", ""),
        "bucket": os.environ.get("R2_BUCKET_NAME", ""),
        "cache_dir": str(cache),
        "cached_files": files,
    }
