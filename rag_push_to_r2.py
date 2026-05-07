#!/usr/bin/env python3
"""rag_kb.db 영역 R2 영역 푸시 영역 — 운영 영역 NightOff 영역 RAG 영역 반영.

흐름:
  Phase 1: R2 server-side 백업 영역 (운영본 → rag_kb_pre_d5_<DATE>.db, 0초, 무비용)
  Phase 2: 로컬 영역 rag_kb.db → R2 업로드 (multipart, 202 MB)
  Phase 3: 검증 영역 (size / ETag)

사용:
  python rag_push_to_r2.py                  # dry-run (디폴트, 변경 X)
  python rag_push_to_r2.py --apply          # 실제 백업 + 업로드 + 검증
  python rag_push_to_r2.py --apply --skip-backup    # 백업 없이 업로드 (위험)
  python rag_push_to_r2.py --backup-key=rag_kb_custom_backup.db  # 백업 키 영역 명명

환경변수 (필수, PowerShell 영역 영역 등록):
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_ENDPOINT_URL          (https://<account-id>.r2.cloudflarestorage.com)
  R2_BUCKET_NAME           (예: nightoff-templates)

사고 발현 시 롤백:
  1) R2 dashboard 영역 영역 rag_kb.db 영역 삭제
  2) rag_kb_pre_d5_<DATE>.db 영역 rag_kb.db 영역 server-side copy
  3) Railway dashboard 영역 영역 Restart
"""
from __future__ import annotations
import argparse
import hashlib
import os
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

DB_PATH = Path("rag_kb.db")
RAG_KEY = "rag_kb.db"  # R2 영역 키 영역 영역
DEFAULT_BACKUP_KEY = f"rag_kb_pre_d5_{datetime.now().strftime('%Y%m%d')}.db"
MULTIPART_THRESHOLD_MB = 64
MULTIPART_CHUNKSIZE_MB = 32

REQUIRED_ENV = [
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_ENDPOINT_URL",
    "R2_BUCKET_NAME",
]


def _check_env() -> tuple[bool, list[str]]:
    """환경변수 4개 영역 검증."""
    missing = [k for k in REQUIRED_ENV if not os.environ.get(k, "").strip()]
    return (not missing, missing)


def _format_size(n: int) -> str:
    if n >= 1024 ** 3:
        return f"{n / 1024 ** 3:.2f} GB"
    if n >= 1024 ** 2:
        return f"{n / 1024 ** 2:.1f} MB"
    if n >= 1024:
        return f"{n / 1024:.1f} KB"
    return f"{n} B"


def _file_md5(path: Path, chunk: int = 8 * 1024 * 1024) -> str:
    """로컬 파일 MD5 (단일 part 업로드 시 ETag 비교용)."""
    h = hashlib.md5()
    with open(path, "rb") as f:
        while True:
            data = f.read(chunk)
            if not data:
                break
            h.update(data)
    return h.hexdigest()


def _client():
    import boto3
    from botocore.config import Config as BotoConfig
    cfg = BotoConfig(
        signature_version="s3v4",
        retries={"max_attempts": 3, "mode": "standard"},
        connect_timeout=10,
        read_timeout=300,
    )
    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT_URL"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=cfg,
    )


def _head(client, bucket: str, key: str) -> dict | None:
    """head_object — 객체 영역 메타 영역. 없으면 None."""
    try:
        return client.head_object(Bucket=bucket, Key=key)
    except Exception as e:
        msg = str(e)
        if "404" in msg or "NoSuchKey" in msg or "Not Found" in msg:
            return None
        raise


def main():
    parser = argparse.ArgumentParser(description="rag_kb.db → R2 영역 푸시")
    parser.add_argument("--apply", action="store_true",
                        help="실제 영역 백업 + 업로드 (디폴트 = dry-run)")
    parser.add_argument("--skip-backup", action="store_true",
                        help="server-side 백업 영역 영역 (위험: 롤백 영역 X)")
    parser.add_argument("--backup-key", type=str, default=DEFAULT_BACKUP_KEY,
                        help=f"백업 객체 키 (디폴트: {DEFAULT_BACKUP_KEY})")
    args = parser.parse_args()

    apply_mode = args.apply
    mode_str = "APPLY" if apply_mode else "DRY-RUN"

    print(f"=== rag_kb.db → R2 push  [{mode_str}] ===")
    print()

    # ── 1. 환경변수 검증 ──
    ok, missing = _check_env()
    if not ok:
        print(f"ERROR: 환경변수 누락 — {', '.join(missing)}")
        print("  PowerShell 영역 영역 영역 영역 영역 영역:")
        print("    $env:R2_ACCESS_KEY_ID = '...'")
        print("    $env:R2_SECRET_ACCESS_KEY = '...'")
        print("    $env:R2_ENDPOINT_URL = 'https://<account-id>.r2.cloudflarestorage.com'")
        print("    $env:R2_BUCKET_NAME = 'nightoff-templates'")
        sys.exit(1)

    bucket = os.environ["R2_BUCKET_NAME"]
    endpoint = os.environ["R2_ENDPOINT_URL"]
    print(f"  bucket   : {bucket}")
    print(f"  endpoint : {endpoint}")
    print(f"  key      : {RAG_KEY}")
    print()

    # ── 2. 로컬 영역 검증 ──
    if not DB_PATH.exists():
        print(f"ERROR: {DB_PATH} not found")
        sys.exit(1)
    local_size = DB_PATH.stat().st_size
    print(f"  [LOCAL] {DB_PATH.name}")
    print(f"    size : {local_size:,} bytes ({_format_size(local_size)})")
    print(f"    mtime: {datetime.fromtimestamp(DB_PATH.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # ── 3. boto3 영역 client ──
    try:
        import boto3  # noqa: F401
        from boto3.s3.transfer import TransferConfig
    except ImportError:
        print("ERROR: boto3 영역 미설치 — `pip install boto3` 필요")
        sys.exit(1)

    client = _client()

    # ── 4. R2 영역 현재 상태 ──
    print(f"  [R2] {RAG_KEY} (현재 운영본)")
    cur = _head(client, bucket, RAG_KEY)
    if cur is None:
        print(f"    상태 : 객체 없음 (신규 업로드)")
        cur_size = 0
        cur_etag = ""
    else:
        cur_size = cur.get("ContentLength", 0)
        cur_etag = (cur.get("ETag") or "").strip('"')
        cur_modified = cur.get("LastModified")
        print(f"    size : {cur_size:,} bytes ({_format_size(cur_size)})")
        print(f"    etag : {cur_etag}")
        print(f"    mtime: {cur_modified}")
    print()

    # ── 5. 백업 키 영역 영역 ──
    if not args.skip_backup:
        print(f"  [R2] {args.backup_key} (백업 영역)")
        bk = _head(client, bucket, args.backup_key)
        if bk is None:
            print(f"    상태 : 영역 없음 (백업 신규 생성 영역)")
        else:
            print(f"    ⚠️  이미 존재 — size: {bk.get('ContentLength', 0):,}, etag: {(bk.get('ETag') or '').strip(chr(34))}")
            print(f"    ⚠️  같은 영역 영역 백업 영역 이미 존재 — 덮어쓰기 영역 영역.")
        print()

    # ── 6. 변경 계획 ──
    print(f"  [PLAN] {mode_str}")
    if not args.skip_backup:
        print(f"    Phase 1: copy_object  R2:{RAG_KEY}  →  R2:{args.backup_key}")
    else:
        print(f"    Phase 1: SKIP (--skip-backup) ⚠️  롤백 영역 X")
    print(f"    Phase 2: upload_file  LOCAL:{DB_PATH.name}  →  R2:{RAG_KEY}  ({_format_size(local_size)})")
    print(f"    Phase 3: head_object  R2:{RAG_KEY}  (size 검증)")
    print()

    if not apply_mode:
        print("  [DRY-RUN] 영역 변경 X. --apply 영역 영역 실제 영역 영역.")
        return

    # ============================================================
    # APPLY MODE
    # ============================================================

    # ── Phase 1: server-side 백업 ──
    if not args.skip_backup:
        print(f"  [Phase 1] server-side copy 영역 ...")
        t0 = time.time()
        try:
            client.copy_object(
                Bucket=bucket,
                Key=args.backup_key,
                CopySource={"Bucket": bucket, "Key": RAG_KEY},
            )
            elapsed = time.time() - t0
            # 검증
            bk = _head(client, bucket, args.backup_key)
            if bk and bk.get("ContentLength") == cur_size:
                print(f"    ✓ 백업 완료  ({elapsed:.1f}s)  size={bk.get('ContentLength'):,}  etag={(bk.get('ETag') or '').strip(chr(34))}")
            else:
                print(f"    ⚠️  백업 size 불일치 — 운영본 size={cur_size}, 백업 size={bk.get('ContentLength') if bk else None}")
        except Exception as e:
            if cur is None:
                print(f"    skip — 운영본 영역 없으므로 백업 영역 영역 의미 X")
            else:
                print(f"    ERROR: 백업 실패 — {e}")
                print(f"    중단. Phase 2 영역 영역 영역.")
                sys.exit(1)
        print()

    # ── Phase 2: 업로드 ──
    print(f"  [Phase 2] upload_file 영역 ({_format_size(local_size)}, multipart) ...")
    transfer_config = TransferConfig(
        multipart_threshold=MULTIPART_THRESHOLD_MB * 1024 * 1024,
        multipart_chunksize=MULTIPART_CHUNKSIZE_MB * 1024 * 1024,
        max_concurrency=4,
        use_threads=True,
    )
    t0 = time.time()
    try:
        client.upload_file(
            Filename=str(DB_PATH),
            Bucket=bucket,
            Key=RAG_KEY,
            Config=transfer_config,
        )
        elapsed = time.time() - t0
        print(f"    ✓ 업로드 완료  ({elapsed:.1f}s, {local_size / elapsed / 1024 / 1024:.1f} MB/s)")
    except Exception as e:
        print(f"    ERROR: 업로드 실패 — {e}")
        sys.exit(1)
    print()

    # ── Phase 3: 검증 ──
    print(f"  [Phase 3] 업로드 검증 ...")
    new_head = _head(client, bucket, RAG_KEY)
    if new_head is None:
        print(f"    ⚠️  head_object 영역 None — R2 영역 영역 영역 X")
        sys.exit(2)
    new_size = new_head.get("ContentLength", 0)
    new_etag = (new_head.get("ETag") or "").strip('"')
    print(f"    new size : {new_size:,} bytes ({_format_size(new_size)})")
    print(f"    new etag : {new_etag}")
    if new_size == local_size:
        print(f"    ✓ size 일치 (local={local_size:,}, R2={new_size:,})")
    else:
        print(f"    ⚠️  size 불일치 — local={local_size:,}, R2={new_size:,}")
        sys.exit(2)
    if cur_etag and cur_etag == new_etag:
        print(f"    ⚠️  etag 영역 동일 — 업로드 영역 영역 영역 영역 영역 영역 (??)")
    else:
        print(f"    ✓ etag 변경 (이전 {cur_etag or '(없음)'} → {new_etag})")
    print()

    # ── 마무리 ──
    print(f"  ====================================================")
    print(f"  ✓ R2 푸시 완료")
    print(f"  ====================================================")
    print(f"  bucket : {bucket}")
    print(f"  key    : {RAG_KEY}")
    print(f"  size   : {_format_size(new_size)}")
    print(f"  backup : {args.backup_key if not args.skip_backup else '(skipped)'}")
    print()
    print(f"  → 다음 단계: Railway dashboard → Deployments → Restart")
    print(f"  → 검증 영역: 운영 NightOff 영역 새 RFP 시도 → RAG 검색 영역 D5 컨텍스트 영역 영역")
    print()
    print(f"  [롤백 영역 영역]")
    print(f"    1) R2 dashboard 영역 영역 {RAG_KEY} 삭제")
    print(f"    2) {args.backup_key} → {RAG_KEY} 영역 server-side copy")
    print(f"    3) Railway dashboard 영역 Restart")


if __name__ == "__main__":
    main()
