"""
폴더 내 이미지에 카메라 캘리브레이션(npz) 기반 undistort를 적용한다.
`main._undistort_frame_if_enabled`와 동일하게 getOptimalNewCameraMatrix + cv2.undistort를 사용하며,
기본은 ROI 크롭을 끄어 입력과 같은 해상도(예: 1920×1080)를 유지한다.

  cd edge
  python tools/batch_undistort_folder.py ^
    --input-dir data/GT_125 --output-dir data/GT_125_undistorted ^
    --npz config/camera_calibration_c922_1920x1080.npz
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_EDGE_ROOT = Path(__file__).resolve().parent.parent
if str(_EDGE_ROOT) not in sys.path:
    sys.path.insert(0, str(_EDGE_ROOT))


def _resolve(path_str: str) -> Path:
    p = Path(path_str)
    return p if p.is_absolute() else (_EDGE_ROOT / p).resolve()


def _load_calibration(npz_path: Path) -> tuple:
    import numpy as np

    with np.load(str(npz_path), allow_pickle=False) as data:
        camera_matrix = np.asarray(data["camera_matrix"], dtype=np.float64)
        dist_coeffs = np.asarray(data["dist_coeffs"], dtype=np.float64)
        cal_w = int(data["image_width"]) if "image_width" in data else None
        cal_h = int(data["image_height"]) if "image_height" in data else None
    return camera_matrix, dist_coeffs, cal_w, cal_h


def undistort_bgr(
    frame,
    camera_matrix,
    dist_coeffs,
    *,
    alpha: float,
    crop_roi: bool,
):
    """main.py와 동일한 undistort 경로."""
    import cv2

    h, w = frame.shape[:2]
    new_camera_matrix, roi = cv2.getOptimalNewCameraMatrix(
        camera_matrix,
        dist_coeffs,
        (w, h),
        float(alpha),
        (w, h),
    )
    out = cv2.undistort(frame, camera_matrix, dist_coeffs, None, new_camera_matrix)
    if crop_roi:
        x, y, rw, rh = [int(v) for v in roi]
        if rw > 0 and rh > 0:
            out = out[y : y + rh, x : x + rw]
    return out


def _iter_images(folder: Path):
    exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    for p in sorted(folder.iterdir()):
        if p.is_file() and p.suffix.lower() in exts:
            yield p


def main() -> int:
    import cv2

    ap = argparse.ArgumentParser(description="Batch undistort folder (fixed output size = input size)")
    ap.add_argument("--input-dir", default="data/GT_125", help="edge 기준 입력 폴더")
    ap.add_argument(
        "--output-dir",
        default="data/GT_125_undistorted",
        help="edge 기준 출력 폴더 (기존 동일 이름 파일 덮어씀)",
    )
    ap.add_argument(
        "--npz",
        default="config/camera_calibration_c922_1920x1080.npz",
        help="camera_matrix, dist_coeffs 포함 npz",
    )
    ap.add_argument(
        "--alpha",
        type=float,
        default=1.0,
        help="getOptimalNewCameraMatrix 알파 (0~1). 1.0은 원 근처 끝까지 살림(어두운 테두리 가능)",
    )
    ap.add_argument(
        "--crop-roi",
        action="store_true",
        help="유효 ROI만 잘라 저장 (해상도가 입력과 달라질 수 있음). 1920×1080 유지 시 사용하지 않음.",
    )
    ap.add_argument("--jpeg-quality", type=int, default=95, help="50~100 (JPEG만)")
    args = ap.parse_args()
    jq = int(args.jpeg_quality)
    if not 50 <= jq <= 100:
        print("[ERR] --jpeg-quality must be 50..100", file=sys.stderr)
        return 1

    in_dir = _resolve(args.input_dir)
    out_dir = _resolve(args.output_dir)
    npz_path = _resolve(args.npz)

    if not in_dir.is_dir():
        print(f"[ERR] 입력 폴더 없음: {in_dir}", file=sys.stderr)
        return 1
    if not npz_path.is_file():
        print(f"[ERR] npz 없음: {npz_path}", file=sys.stderr)
        return 1

    cam, dist, cal_w, cal_h = _load_calibration(npz_path)
    out_dir.mkdir(parents=True, exist_ok=True)

    paths = list(_iter_images(in_dir))
    if not paths:
        print(f"[ERR] 이미지 없음: {in_dir}", file=sys.stderr)
        return 1

    print(f"[undistort] npz={npz_path}")
    if cal_w is not None and cal_h is not None:
        print(f"[undistort] calib reference size={cal_w}x{cal_h}")
    print(f"[undistort] images={len(paths)} -> {out_dir}")
    print(f"[undistort] alpha={args.alpha}, crop_roi={args.crop_roi}, jpeg_q={jq}")

    n_ok = 0
    for i, src in enumerate(paths, 1):
        img = cv2.imread(str(src))
        if img is None:
            print(f"[SKIP] read fail: {src.name}")
            continue
        h, w = img.shape[:2]
        if cal_w is not None and cal_h is not None and (w != cal_w or h != cal_h):
            print(
                f"[SKIP] size mismatch {w}x{h} (need {cal_w}x{cal_h}): {src.name}",
                file=sys.stderr,
            )
            continue
        out = undistort_bgr(img, cam, dist, alpha=args.alpha, crop_roi=args.crop_roi)
        dst = out_dir / src.name
        if dst.suffix.lower() in {".jpg", ".jpeg"}:
            cv2.imwrite(str(dst), out, [cv2.IMWRITE_JPEG_QUALITY, jq])
        else:
            cv2.imwrite(str(dst), out)
        oh, ow = out.shape[:2]
        if i <= 3 or i == len(paths):
            print(f"  [{i}/{len(paths)}] {src.name} -> {ow}x{oh}")
        n_ok += 1

    print(f"[undistort] done: {n_ok}/{len(paths)} written")
    return 0 if n_ok == len(paths) else 2


if __name__ == "__main__":
    raise SystemExit(main())
