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


def list_objects(suffix: str | None = ".pptx", prefix: str | None = None) -> list[dict]:
    """R2 버킷의 객체 목록.

    Args:
      suffix: 필터링할 확장자 (e.g. '.pptx'). None 이면 모두.
      prefix: R2 키 prefix 필터 (e.g. 'skeletons/'). None 이면 전체 버킷.
              Spec D-Build-SkeletonConnect — 골격 동기화 시 'skeletons/' 한정.
              기본값 None = 기존 호출자 (sync_master_templates) 동작 그대로.
    """
    if not _is_configured() or not _BOTO3_AVAILABLE:
        return []
    bucket = os.environ["R2_BUCKET_NAME"]
    out: list[dict] = []
    try:
        client = _client()
        paginator = client.get_paginator("list_objects_v2")
        paginate_kwargs = {"Bucket": bucket}
        if prefix:
            paginate_kwargs["Prefix"] = prefix
        for page in paginator.paginate(**paginate_kwargs):
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
    """기본 마스터 PPTX 1개만 다운로드 + dmz_default alias 생성.

    Spec fix/r2-sync-master-only — 이전에는 버킷 전체 *.pptx 를 순회 다운로드해
    사용자 제안서 pptx/*/*.pptx (Spec D-Fix-PptxR2 로 축적) 와 루트 잔재까지
    매 startup 마다 받아 Railway healthcheck (300s) 를 초과했다. 실제 startup 에
    필요한 건 마스터 1개뿐. 사용자 제안서는 필요 시 download_to_buffer 로
    stream 한다 (main.py:6532 등).

    키 결정: R2_DEFAULT_KEY 환경변수가 있으면 그 값, 없으면 "paperlogy_default.pptx".
    download_one 재사용 → 기존 ETag 캐시 + 로컬 fallback 정합.

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
    master_key = os.environ.get("R2_DEFAULT_KEY", "").strip() or "paperlogy_default.pptx"
    local = cache / _safe_local_name(master_key)

    # download_one: ETag 캐시 HIT 시 즉시 return (로그만), MISS 시 다운로드.
    # 실패 시 로컬에 이미 있으면 그것 반환, 없으면 None.
    p = download_one(master_key, local)
    if p is None:
        result["failed"] = 1
        log.warning("R2 마스터 다운로드 실패 (%s) — 로컬 master_templates/ 만 사용", master_key)
        return result
    result["downloaded"] = 1  # (skip/downloaded 정확 구분은 download_one 로그로 확인)

    # 기본 마스터 alias (find_master_template 가 dmz_default.pptx 를 찾음).
    # 기존 로직 그대로 — hardlink 우선, 실패 시 copy.
    default_alias = cache / "dmz_default.pptx"
    if p.exists():
        try:
            if default_alias.resolve() != p.resolve():
                if default_alias.exists():
                    default_alias.unlink()
                try:
                    os.link(p, default_alias)
                    log.info("기본 마스터 alias (hardlink): %s → %s", default_alias.name, p.name)
                except (OSError, NotImplementedError):
                    import shutil
                    shutil.copy2(p, default_alias)
                    log.info("기본 마스터 alias (copy):     %s → %s", default_alias.name, p.name)
            result["default"] = default_alias
        except Exception as e:
            log.warning("기본 마스터 alias 생성 실패: %s", e)
            result["default"] = p

    log.info(
        "R2 master sync 완료 · master=%s · default=%s",
        master_key, getattr(result["default"], "name", None),
    )
    return result


# ── Spec D-Build-SkeletonConnect — 골격 13종 HTML + _index.json 동기화 ──────
# R2 nightoff-templates 버킷의 'skeletons/' prefix 아래 객체를 로컬 ./skeletons/ 에 캐시.
# 파일: KPI.html / G1.html ~ G12.html (총 13개) + _index.json (한 개).
# 골격 추가/수정 시 R2 업로드만 → 코드 배포 X (sync_master_templates 와 동일 패턴).
# 환경변수 미설정 / boto3 미설치 = graceful skip (HTML 모드 토글 OFF 영향 0).
def _local_skeletons_dir() -> Path:
    p = Path(
        os.environ.get("R2_SKELETONS_CACHE_DIR")
        or (Path(__file__).parent / "skeletons")
    )
    p.mkdir(parents=True, exist_ok=True)
    return p


def sync_skeletons(prefix: str = "skeletons/") -> dict:
    """버킷의 'skeletons/' prefix 아래 모든 객체 (.html + _index.json) 동기화.

    sync_master_templates 와 동일 ETag 캐시 전략 — 동일 etag 면 skip.

    return: {"downloaded": N, "skipped": N, "failed": N}
    """
    result = {"downloaded": 0, "skipped": 0, "failed": 0}
    if not _BOTO3_AVAILABLE:
        log.warning("R2 skeletons sync skip — boto3 미설치")
        return result
    if not _is_configured():
        log.info("R2 skeletons sync skip — 환경변수 미설정 (로컬 skeletons/ 만 사용)")
        return result

    cache = _local_skeletons_dir()
    # suffix=None → .html + .json 둘 다 포함. prefix='skeletons/' 로 한정.
    objects = list_objects(suffix=None, prefix=prefix)
    log.info("R2 skeletons %d 개 발견 (prefix=%s)", len(objects), prefix)

    for obj in objects:
        key = obj["key"]
        # prefix 제거한 상대 경로만 로컬에 (예: "skeletons/G1.html" → "G1.html")
        rel = key[len(prefix):] if key.startswith(prefix) else key
        if not rel or rel.endswith("/"):
            # prefix 자체 또는 하위 디렉토리 표식 → skip
            continue
        local = cache / rel
        try:
            local.parent.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            log.warning("R2 skeletons mkdir 실패 (%s): %s", local.parent, e)
            result["failed"] += 1
            continue
        marker = _etag_marker_path(local)
        prev = _read_marker(marker)
        if local.exists() and prev == obj["etag"]:
            result["skipped"] += 1
            continue
        p = download_one(key, local)
        if p is not None:
            result["downloaded"] += 1
        else:
            result["failed"] += 1

    log.info(
        "R2 skeletons sync 완료 · 다운로드 %d · skip %d · 실패 %d",
        result["downloaded"], result["skipped"], result["failed"],
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


def upload_one(local_path: Path, key: str) -> bool:
    """Spec D-Fix-PptxR2 — 단일 파일을 R2 에 업로드.

    Args:
      local_path: 로컬 디스크 파일 경로 (Path).
      key       : R2 객체 키 (예: "pptx/{conv8}/{name}.pptx").
    Returns:
      성공 True / 실패·미설정 False (예외 전파 X — 호출측이 try/except 한 번 더 감싸도 안전).
    """
    if not _is_configured() or not _BOTO3_AVAILABLE:
        return False
    if not local_path.is_file():
        log.warning("R2 upload skip — 로컬 파일 없음: %s", local_path)
        return False
    bucket = os.environ["R2_BUCKET_NAME"]
    try:
        client = _client()
        client.upload_file(str(local_path), bucket, key)
        log.info("R2 업로드 · %s → s3://%s/%s (size=%s)",
                 local_path.name, bucket, key, local_path.stat().st_size)
        return True
    except (BotoCoreError, ClientError, Exception) as e:
        log.warning("R2 upload 실패 (%s): %s", key, e)
        return False


def download_to_buffer(key: str):
    """Spec D-Fix-PptxR2 — 단일 객체를 메모리 버퍼(BytesIO)로 다운로드.

    반환:
      io.BytesIO (성공) / None (실패·미설정·미존재).
    호출측은 StreamingResponse 등으로 클라이언트에 흘려보낼 수 있다.
    """
    if not _is_configured() or not _BOTO3_AVAILABLE:
        return None
    bucket = os.environ["R2_BUCKET_NAME"]
    try:
        import io
        client = _client()
        resp = client.get_object(Bucket=bucket, Key=key)
        body = resp.get("Body")
        if body is None:
            return None
        buf = io.BytesIO(body.read())
        buf.seek(0)
        return buf
    except (BotoCoreError, ClientError, Exception) as e:
        log.warning("R2 download_to_buffer 실패 (%s): %s", key, e)
        return None


def delete_object(key: str) -> bool:
    """단일 객체를 R2 에서 삭제 (멱등 — 없는 키도 성공).

    Args:
      key: R2 객체 키 (예: "company-docs/{user_id}/{doc_id}_{name}.pdf").
    Returns:
      성공 True / 실패·미설정 False (예외 전파 X — upload_one 패턴 정합).
    """
    if not _is_configured() or not _BOTO3_AVAILABLE:
        return False
    bucket = os.environ["R2_BUCKET_NAME"]
    try:
        client = _client()
        client.delete_object(Bucket=bucket, Key=key)
        log.info("R2 삭제 · s3://%s/%s", bucket, key)
        return True
    except (BotoCoreError, ClientError, Exception) as e:
        log.warning("R2 delete 실패 (%s): %s", key, e)
        return False


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
