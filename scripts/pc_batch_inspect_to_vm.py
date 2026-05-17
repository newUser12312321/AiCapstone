#!/usr/bin/env python3
"""
PC에서 gn948x/ · GT125A/ 등 폴더의 이미지를 로컬 Edge로 검사하고,
edge/.env 의 SERVER_BASE_URL( GCP VM :8080 ) 로 결과·이미지를 전송한다.

사전 조건:
  1. edge/.env → SERVER_BASE_URL=http://<VM-IP>:8080
     SEND_IMAGE_BASE64_TO_CLOUD=true
  2. edge 가상환경에서 Edge 기동:
     cd edge && uvicorn main:app --host 127.0.0.1 --port 8000
  3. YOLO 가중치·Gemini 설정이 PC에서 동작 가능한 상태

사용 예:
  python scripts/pc_batch_inspect_to_vm.py --limit 5
  python scripts/pc_batch_inspect_to_vm.py --gn948x-dir gn948x --gt125a-dir GT125A --wait 90
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
IMAGE_SUFFIX = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def _list_images(folder: Path, limit: int) -> list[Path]:
    if not folder.is_dir():
        raise FileNotFoundError(f"폴더 없음: {folder}")
    files = sorted(
        p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_SUFFIX
    )
    if not files:
        raise FileNotFoundError(f"이미지 없음: {folder}")
    return files[:limit]


def _check_edge(edge_url: str) -> None:
    url = f"{edge_url.rstrip('/')}/edge/health"
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
    except requests.RequestException as e:
        raise SystemExit(
            f"Edge API에 연결할 수 없습니다 ({url}).\n"
            "  cd edge && uvicorn main:app --host 127.0.0.1 --port 8000\n"
            f"  오류: {e}"
        ) from e


def _upload(
    edge_url: str,
    image_path: Path,
    stage2: str | None,
    kiosk_preset: str | None,
) -> None:
    url = f"{edge_url.rstrip('/')}/edge/inspect/upload"
    params: dict[str, str] = {}
    if stage2:
        params["stage2Source"] = stage2
    if kiosk_preset:
        params["kioskPreset"] = kiosk_preset
    with image_path.open("rb") as f:
        files = {"image": (image_path.name, f, "image/jpeg")}
        r = requests.post(url, files=files, params=params or None, timeout=180)
    if r.status_code >= 400:
        raise RuntimeError(f"{image_path.name}: HTTP {r.status_code} — {r.text[:500]}")
    msg = r.json().get("message", r.text)
    print(f"  → {msg}")


def main() -> int:
    parser = argparse.ArgumentParser(description="PC 이미지 배치 검사 → VM 전송")
    parser.add_argument(
        "--edge-url",
        default="http://127.0.0.1:8000",
        help="로컬 Edge FastAPI (기본 http://127.0.0.1:8000)",
    )
    parser.add_argument(
        "--gn948x-dir",
        type=Path,
        default=REPO_ROOT / "gn948x",
        help="GN-948X 샘플 폴더",
    )
    parser.add_argument(
        "--gt125a-dir",
        type=Path,
        default=REPO_ROOT / "GT125A",
        help="GT-125A 샘플 폴더",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="각 폴더에서 검사할 이미지 수 (기본 5)",
    )
    parser.add_argument(
        "--wait",
        type=float,
        default=50.0,
        help="장당 대기 초 (YOLO+전송 완료 여유, 기본 50)",
    )
    parser.add_argument(
        "--stage2",
        default=None,
        help="stage2Source 쿼리 (예: aligned, full)",
    )
    parser.add_argument(
        "--skip-gn948x",
        action="store_true",
        help="gn948x 폴더 건너뛰기",
    )
    parser.add_argument(
        "--skip-gt125a",
        action="store_true",
        help="GT125A 폴더 건너뛰기",
    )
    args = parser.parse_args()

    _check_edge(args.edge_url)

    # (표시 라벨, 이미지 목록, kioskPreset → board_profiles 가중치)
    batches: list[tuple[str, list[Path], str]] = []
    if not args.skip_gn948x:
        batches.append(
            ("GN-948X", _list_images(args.gn948x_dir.resolve(), args.limit), "gn948x")
        )
    if not args.skip_gt125a:
        batches.append(
            ("GT-125A", _list_images(args.gt125a_dir.resolve(), args.limit), "gt125a")
        )

    total = sum(len(imgs) for _, imgs, _ in batches)
    print(f"Edge: {args.edge_url} | 총 {total}장 검사 예정 (장당 {args.wait}s 대기)\n")

    n = 0
    for label, paths, preset in batches:
        print(f"=== {label} ({len(paths)}장, kioskPreset={preset}) ===")
        for p in paths:
            n += 1
            print(f"[{n}/{total}] {p.name}")
            _upload(args.edge_url, p, args.stage2, preset)
            if n < total and args.wait > 0:
                time.sleep(args.wait)
        print()

    print("완료. VM 대시보드·검사 이력에서 새 FAIL/PASS 행과 이미지를 확인하세요.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
