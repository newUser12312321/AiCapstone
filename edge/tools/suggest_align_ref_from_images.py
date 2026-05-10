"""
폴더 JPEG/PNG에 대해 카메라 캘리브레이션 없이(원본 픽셀) Stage1과 동일하게
피듀셜 검출 + compute_alignment 후, F1/F2 서브픽셀 중심의 중앙값(median)으로
GN_948X용 ALIGN_REF_GN_948X_* 제안값을 산출한다.

  cd edge
  python tools/suggest_align_ref_from_images.py --image-dir ../gn948x

검사 로직: YoloDetector.detect_fiducials + compute_alignment (main.py Stage2-A와 동일 선행).
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import numpy as np

_EDGE_ROOT = Path(__file__).resolve().parent.parent
if str(_EDGE_ROOT) not in sys.path:
    sys.path.insert(0, str(_EDGE_ROOT))

import cv2  # noqa: E402

from inference.alignment import compute_alignment  # noqa: E402
from inference.yolo_detector import YoloDetector  # noqa: E402


def _iter_images(folder: Path) -> list[Path]:
    exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    return sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in exts)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--image-dir",
        type=Path,
        default=Path(r"C:\Projects\AiCapstoneV2\gn948x"),
        help="검사할 이미지 폴더",
    )
    ap.add_argument(
        "--weights",
        type=str,
        default="weights/gn948x_best.pt",
        help="edge 기준 상대 YOLO 가중치",
    )
    ap.add_argument(
        "--conf",
        type=float,
        default=0.4,
        help="피듀셜 conf (detect_fiducials conf_override)",
    )
    ap.add_argument(
        "--require-aligned",
        action="store_true",
        help="compute_alignment 가 is_aligned 인 샘플만 사용",
    )
    args = ap.parse_args()
    d = args.image_dir
    if not d.is_dir():
        print(f"[ERR] 폴더 없음: {d}", file=sys.stderr)
        return 1

    det = YoloDetector(weights_path=args.weights)
    det.load()

    f1xs: list[float] = []
    f1ys: list[float] = []
    f2xs: list[float] = []
    f2ys: list[float] = []
    fails: list[tuple[str, str]] = []

    paths = _iter_images(d)
    for p in paths:
        bgr = cv2.imread(str(p))
        if bgr is None:
            fails.append((p.name, "load"))
            continue
        fids, _ = det.detect_fiducials(bgr, conf_override=args.conf)
        al = compute_alignment(fids)
        if al.fiducial1 is None or al.fiducial2 is None:
            fails.append((p.name, f"fids={len(fids)}"))
            continue
        if args.require_aligned and not al.is_aligned:
            fails.append((p.name, "not_aligned_angle"))
            continue
        f1xs.append(float(al.fiducial1.center_x_subpx))
        f1ys.append(float(al.fiducial1.center_y_subpx))
        f2xs.append(float(al.fiducial2.center_x_subpx))
        f2ys.append(float(al.fiducial2.center_y_subpx))

    n = len(f1xs)
    print()
    print(f"folder:     {d.resolve()}")
    print(f"weights:    {args.weights}")
    print(f"conf:       {args.conf}")
    print(f"images:     {len(paths)}")
    print(f"ok:         {n}")
    print(f"fail:       {len(fails)}")
    if fails[:15]:
        for name, why in fails[:15]:
            print(f"  - {name}: {why}")
    if n == 0:
        return 2

    m1x = float(np.median(f1xs))
    m1y = float(np.median(f1ys))
    m2x = float(np.median(f2xs))
    m2y = float(np.median(f2ys))
    r1x, r1y = int(round(m1x)), int(round(m1y))
    r2x, r2y = int(round(m2x)), int(round(m2y))

    print()
    print("--- median F1/F2 in capture frame (subpixel centers, no undistort) ---")
    print(f"F1 median: ({m1x:.4f}, {m1y:.4f})")
    print(f"F2 median: ({m2x:.4f}, {m2y:.4f})")
    print()
    print("--- suggested .env (ALIGN_REF_GN_948X_* = median rounded to int) ---")
    print(f"ALIGN_REF_GN_948X_FIDUCIAL1_X={r1x}")
    print(f"ALIGN_REF_GN_948X_FIDUCIAL1_Y={r1y}")
    print(f"ALIGN_REF_GN_948X_FIDUCIAL2_X={r2x}")
    print(f"ALIGN_REF_GN_948X_FIDUCIAL2_Y={r2y}")
    print()
    print("(목표 좌표를 캡처 프레임 분포 중앙으로 두면, 유사 촬영 조건에서 정합 스냅이 안정적입니다.)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
