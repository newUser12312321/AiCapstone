#!/usr/bin/env python3
"""
DB에 image_path 는 있는데 서버 inspection-images 파일이 없을 때,
Pi edge/captures 를 VM으로 복사해 둔 폴더에서 타임스탬프로 매칭해 복구한다.

사용 예 (GCP VM, Pi captures 를 ~/captures_backup 에 rsync 한 뒤):

  python3 scripts/restore_inspection_images.py \\
    --api http://127.0.0.1:8080 \\
    --source ~/captures_backup \\
    --dest ./inspection-images-restore

  # Docker backend 볼륨에 반영:
  docker cp ./inspection-images-restore/. aicapstone-backend:/app/inspection-images/

MySQL에서 직접 (API 없이):
  python3 scripts/restore_inspection_images.py \\
    --mysql-host 127.0.0.1 --mysql-port 3307 \\
    --mysql-user root --mysql-password your_password \\
    --source ~/captures_backup \\
    --dest ./inspection-images-restore
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import urllib.request
from pathlib import Path

TIME_KEY_RE = re.compile(r"(\d{8}_\d{6}_\d{3})")


def filename_from_image_path(image_path: str) -> str | None:
    p = image_path.replace("\\", "/").strip()
    if not p:
        return None
    if "/images/" in p:
        return p.rsplit("/images/", 1)[-1]
    return Path(p).name


def time_key_from_filename(name: str) -> str | None:
    m = TIME_KEY_RE.search(name)
    return m.group(1) if m else None


def index_source_files(source_dir: Path) -> dict[str, list[Path]]:
    """타임스탬프 키 -> 후보 파일 목록 (aligned 우선 정렬은 복사 시)"""
    index: dict[str, list[Path]] = {}
    for path in source_dir.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp", ".bmp"}:
            continue
        key = time_key_from_filename(path.name)
        if not key:
            continue
        index.setdefault(key, []).append(path)
    return index


def pick_best_source(candidates: list[Path]) -> Path:
    """서버에 저장된 보정본에 가깝게 aligned > deskew > 원본 순"""
    def score(p: Path) -> int:
        n = p.stem.lower()
        if "_aligned" in n:
            return 0
        if "_deskew" in n:
            return 1
        return 2

    return sorted(candidates, key=score)[0]


def fetch_image_paths_from_api(api_base: str) -> list[tuple[int, str]]:
    """전체 이력 — 데이터 많으면 search API 페이지 루프 권장"""
    paths: list[tuple[int, str]] = []
    page = 0
    while True:
        url = f"{api_base.rstrip('/')}/inspections/search?page={page}&size=200"
        with urllib.request.urlopen(url, timeout=60) as resp:
            data = json.load(resp)
        content = data.get("content") or []
        if not content:
            break
        for row in content:
            ip = row.get("imagePath")
            if ip:
                paths.append((int(row["id"]), ip))
        if page + 1 >= int(data.get("totalPages") or 0):
            break
        page += 1
    return paths


def fetch_image_paths_from_mysql(
    host: str, port: int, user: str, password: str, database: str
) -> list[tuple[int, str]]:
    try:
        import pymysql  # type: ignore
    except ImportError as e:
        raise SystemExit(
            "MySQL 모드에는 pymysql 이 필요합니다: pip install pymysql"
        ) from e
    conn = pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        charset="utf8mb4",
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, image_path FROM inspection_log "
                "WHERE image_path IS NOT NULL AND image_path <> '' "
                "ORDER BY id"
            )
            rows = cur.fetchall()
        return [(int(r[0]), str(r[1])) for r in rows]
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Pi captures → inspection-images 복구")
    parser.add_argument("--source", required=True, help="Pi에서 rsync 한 captures 폴더")
    parser.add_argument(
        "--dest",
        required=True,
        help="복사 대상 (보통 backend /app/inspection-images 와 동일한 파일명)",
    )
    parser.add_argument("--api", help="예: http://127.0.0.1:8080/api/v1")
    parser.add_argument("--mysql-host")
    parser.add_argument("--mysql-port", type=int, default=3307)
    parser.add_argument("--mysql-user", default="root")
    parser.add_argument("--mysql-password", default="your_password")
    parser.add_argument("--mysql-database", default="inspection_db")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    source_dir = Path(args.source).expanduser().resolve()
    dest_dir = Path(args.dest).expanduser().resolve()
    if not source_dir.is_dir():
        print(f"source 없음: {source_dir}", file=sys.stderr)
        return 1

    if args.api:
        records = fetch_image_paths_from_api(args.api)
    elif args.mysql_host:
        records = fetch_image_paths_from_mysql(
            args.mysql_host,
            args.mysql_port,
            args.mysql_user,
            args.mysql_password,
            args.mysql_database,
        )
    else:
        print("--api 또는 --mysql-host 중 하나는 필수입니다.", file=sys.stderr)
        return 1

    index = index_source_files(source_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)

    restored = skipped_exists = missing = 0
    for log_id, image_path in records:
        target_name = filename_from_image_path(image_path)
        if not target_name:
            continue
        dest_file = dest_dir / target_name
        if dest_file.is_file():
            skipped_exists += 1
            continue
        key = time_key_from_filename(target_name)
        if not key or key not in index:
            missing += 1
            print(f"[MISS] id={log_id} {target_name} (Pi 백업에 {key} 없음)")
            continue
        src = pick_best_source(index[key])
        if args.dry_run:
            print(f"[DRY] id={log_id} {src.name} -> {target_name}")
        else:
            shutil.copy2(src, dest_file)
            print(f"[OK] id={log_id} {src.name} -> {target_name}")
        restored += 1

    print(
        f"\n완료: 복구={restored}, 이미있음={skipped_exists}, "
        f"Pi에없음={missing}, 대상={len(records)}"
    )
    if not args.dry_run and restored:
        print(
            f"\n다음: docker cp {dest_dir}/. aicapstone-backend:/app/inspection-images/"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
