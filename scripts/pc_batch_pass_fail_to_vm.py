#!/usr/bin/env python3
"""
기판별 샘플 폴더에서 N장씩 검사: PASS용 정상 이미지 + FAIL용 검출 클래스 가림.

- gt125a → weights/GT_125A_bestV2.pt (board_profiles G_SERIES)
- gn948x → weights/gn948x_best.pt (board_profiles GN_948X)
- edge/.env SERVER_BASE_URL 로 VM 전송

사전: cd edge && uvicorn main:app --host 127.0.0.1 --port 8000

예:
  python scripts/pc_batch_pass_fail_to_vm.py
  python scripts/pc_batch_pass_fail_to_vm.py --wait 55 --per-board 10
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import cv2
import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
EDGE_DIR = REPO_ROOT / "edge"
sys.path.insert(0, str(EDGE_DIR))

from inference.yolo_detector import YoloDetector  # noqa: E402

IMAGE_SUFFIX = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# FAIL 5장마다 가릴 클래스 (1~2종). mount_hole 2회 항목은 해당 클래스 박스 2개 가림.
FAIL_PLANS_GT125A: list[list[str]] = [
    ["mount_hole"],
    ["mount_hole"],  # 2개 박스
    ["ic_chip"],
    ["mount_hole", "edge_connector_zone"],
    ["smd_array_block", "ic_chip"],
]

FAIL_PLANS_GN948X: list[list[str]] = [
    ["mount_hole"],
    ["mount_hole"],
    ["connector"],
    ["mount_hole", "fiducial"],
    ["group_connector", "connector"],
]

BOARD_CONFIG = {
    "gt125a": {
        "label": "GT-125A",
        "weights": "weights/GT_125A_bestV2.pt",
        "fail_plans": FAIL_PLANS_GT125A,
    },
    "gn948x": {
        "label": "GN-948X",
        "weights": "weights/gn948x_best.pt",
        "fail_plans": FAIL_PLANS_GN948X,
    },
}


def _list_images(folder: Path, limit: int) -> list[Path]:
    if not folder.is_dir():
        raise FileNotFoundError(f"폴더 없음: {folder}")
    files = sorted(
        p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_SUFFIX
    )
    if len(files) < limit:
        raise FileNotFoundError(f"{folder} 에 이미지 {len(files)}장뿐 (필요 {limit}장)")
    return files[:limit]


def _check_edge(edge_url: str) -> None:
    url = f"{edge_url.rstrip('/')}/edge/health"
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
    except requests.RequestException as e:
        raise SystemExit(
            f"Edge API 연결 실패 ({url}).\n"
            "  cd edge && uvicorn main:app --host 127.0.0.1 --port 8000\n"
            f"  {e}"
        ) from e


def _detect_boxes(frame, weights: str) -> dict[str, list[tuple[int, int, int, int]]]:
    det = YoloDetector(weights_path=weights)
    det.load()
    items, _ = det.detect(frame, target_class=None)
    h, w = frame.shape[:2]
    by_class: dict[str, list[tuple[int, int, int, int]]] = {}
    for d in items:
        cls = d.defect_type.lower().strip()
        x1 = max(0, int(d.bbox.x))
        y1 = max(0, int(d.bbox.y))
        x2 = min(w, int(d.bbox.x + d.bbox.width))
        y2 = min(h, int(d.bbox.y + d.bbox.height))
        by_class.setdefault(cls, []).append((x1, y1, x2, y2))
    for cls in by_class:
        by_class[cls].sort(key=lambda b: (b[1], b[0]))
    return by_class


def _occlude_box(frame, box: tuple[int, int, int, int], pad: int = 14) -> None:
    x1, y1, x2, y2 = box
    x1 = max(0, x1 - pad)
    y1 = max(0, y1 - pad)
    x2 = min(frame.shape[1], x2 + pad)
    y2 = min(frame.shape[0], y2 + pad)
    cv2.rectangle(frame, (x1, y1), (x2, y2), (28, 28, 28), thickness=-1)


def _apply_fail_plan(
    frame,
    weights: str,
    plan: list[str],
    plan_index: int,
):
    """가림 적용 후 이미지와 적용 요약 문자열 반환."""
    boxes = _detect_boxes(frame, weights)
    out = frame.copy()
    notes: list[str] = []

    for cls in plan:
        cls_l = cls.lower()
        candidates = boxes.get(cls_l, [])
        if not candidates:
            raise RuntimeError(f"검출 없음: {cls_l} (plan={plan})")

        # 동일 plan에서 mount_hole만 2번째 FAIL 슬롯이면 홀 2개 가림
        n_hide = 2 if cls_l == "mount_hole" and plan == ["mount_hole"] and plan_index == 1 else 1
        n_hide = min(n_hide, len(candidates))

        for box in candidates[:n_hide]:
            _occlude_box(out, box)
            notes.append(cls_l)

    return out, notes


def _upload(edge_url: str, image_path: Path, kiosk_preset: str) -> str:
    url = f"{edge_url.rstrip('/')}/edge/inspect/upload"
    with image_path.open("rb") as f:
        r = requests.post(
            url,
            files={"image": (image_path.name, f, "image/jpeg")},
            params={"kioskPreset": kiosk_preset},
            timeout=180,
        )
    if r.status_code >= 400:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:500]}")
    return str(r.json().get("message", r.text))


def _run_board(
    edge_url: str,
    folder: Path,
    preset: str,
    per_board: int,
    pass_count: int,
    fail_count: int,
    wait: float,
    captures_dir: Path,
) -> list[tuple[str, str, str]]:
    """(파일명, 의도 pass|fail, 결과 메시지) 목록."""
    cfg = BOARD_CONFIG[preset]
    paths = _list_images(folder, per_board)
    pass_paths = paths[:pass_count]
    fail_paths = paths[pass_count : pass_count + fail_count]
    plans = cfg["fail_plans"]
    if len(fail_paths) != len(plans):
        raise ValueError(f"{preset}: FAIL {len(fail_paths)}장 vs plan {len(plans)}개")

    results: list[tuple[str, str, str]] = []
    captures_dir.mkdir(parents=True, exist_ok=True)
    weights = cfg["weights"]

    print(f"\n=== {cfg['label']} | PASS {len(pass_paths)} + FAIL {len(fail_paths)} (kioskPreset={preset}) ===")

    for p in pass_paths:
        print(f"  [PASS] {p.name}")
        msg = _upload(edge_url, p, preset)
        print(f"    → {msg}")
        results.append((p.name, "pass", msg))
        if wait > 0:
            time.sleep(wait)

    for i, (p, plan) in enumerate(zip(fail_paths, plans)):
        print(f"  [FAIL] {p.name} | 가림: {', '.join(plan)}")
        frame = cv2.imread(str(p))
        if frame is None:
            raise RuntimeError(f"이미지 읽기 실패: {p}")
        try:
            occluded, notes = _apply_fail_plan(frame, weights, plan, i)
        except RuntimeError as e:
            print(f"    [WARN] {e} — mount_hole 단일 가림으로 대체")
            occluded, notes = _apply_fail_plan(frame, weights, ["mount_hole"], 0)

        out_name = f"occluded_{preset}_{i:02d}_{p.stem}.jpg"
        out_path = captures_dir / out_name
        cv2.imwrite(str(out_path), occluded, [cv2.IMWRITE_JPEG_QUALITY, 95])
        print(f"    저장: {out_path.name} ({', '.join(notes)})")

        msg = _upload(edge_url, out_path, preset)
        print(f"    → {msg}")
        results.append((p.name, "fail", msg))
        if wait > 0:
            time.sleep(wait)

    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="PASS/FAIL 혼합 배치 검사 → VM")
    parser.add_argument("--edge-url", default="http://127.0.0.1:8000")
    parser.add_argument("--gn948x-dir", type=Path, default=REPO_ROOT / "gn948x")
    parser.add_argument("--gt125a-dir", type=Path, default=REPO_ROOT / "GT125A")
    parser.add_argument("--per-board", type=int, default=10)
    parser.add_argument("--pass-count", type=int, default=5)
    parser.add_argument("--fail-count", type=int, default=5)
    parser.add_argument("--wait", type=float, default=50.0)
    parser.add_argument("--skip-gn948x", action="store_true")
    parser.add_argument("--skip-gt125a", action="store_true")
    parser.add_argument(
        "--captures-dir",
        type=Path,
        default=EDGE_DIR / "captures",
    )
    args = parser.parse_args()

    if args.pass_count + args.fail_count != args.per_board:
        raise SystemExit(
            f"--pass-count({args.pass_count}) + --fail-count({args.fail_count}) "
            f"= {args.pass_count + args.fail_count}, --per-board({args.per_board}) 와 같아야 합니다."
        )

    _check_edge(args.edge_url)

    boards: list[tuple[Path, str]] = []
    if not args.skip_gn948x:
        boards.append((args.gn948x_dir.resolve(), "gn948x"))
    if not args.skip_gt125a:
        boards.append((args.gt125a_dir.resolve(), "gt125a"))

    total = len(boards) * args.per_board
    print(f"Edge: {args.edge_url} | 총 {total}장 (장당 {args.wait}s 대기)")

    all_results: list[tuple[str, str, str, str]] = []
    for folder, preset in boards:
        rows = _run_board(
            args.edge_url,
            folder,
            preset,
            args.per_board,
            args.pass_count,
            args.fail_count,
            args.wait,
            args.captures_dir,
        )
        label = BOARD_CONFIG[preset]["label"]
        for name, intent, msg in rows:
            all_results.append((label, name, intent, msg))

    print("\n======== 요약 ========")
    for label, name, intent, msg in all_results:
        print(f"  [{label}] {intent.upper():4} {name}: {msg[:80]}")
    print("\n완료. VM 대시보드(검사 이력)에서 PASS/FAIL·이미지를 확인하세요.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
