"""
체스보드 이미지 폴더로부터 카메라 캘리브레이션(npz) 파일을 생성한다.

예시:
    python tools/calibrate_from_images.py ^
        --images-dir data/calib_images ^
        --pattern-cols 9 --pattern-rows 6 ^
        --square-size-mm 12 ^
        --output config/camera_calibration_c922_1920x1080.npz
"""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Calibrate camera from chessboard images")
    p.add_argument("--images-dir", default="data/calib_images", help="입력 이미지 폴더")
    p.add_argument("--glob", default="*.jpg", help="이미지 glob 패턴 (예: *.jpg)")
    p.add_argument("--pattern-cols", type=int, default=9, help="체스보드 내부 코너 열 수")
    p.add_argument("--pattern-rows", type=int, default=6, help="체스보드 내부 코너 행 수")
    p.add_argument("--square-size-mm", type=float, default=12.0, help="체스보드 한 칸 크기(mm)")
    p.add_argument(
        "--output",
        default="config/camera_calibration_c922_1920x1080.npz",
        help="출력 npz 경로",
    )
    p.add_argument(
        "--min-valid",
        type=int,
        default=12,
        help="최소 유효 이미지 수(권장 15 이상)",
    )
    return p


def main() -> int:
    args = _build_parser().parse_args()
    images_dir = Path(args.images_dir)
    output = Path(args.output)

    if not images_dir.exists():
        raise FileNotFoundError(f"입력 폴더가 없습니다: {images_dir}")

    images = sorted(images_dir.glob(args.glob))
    if not images:
        raise RuntimeError(f"이미지를 찾지 못했습니다: {images_dir / args.glob}")

    pattern_size = (int(args.pattern_cols), int(args.pattern_rows))
    objp = np.zeros((pattern_size[0] * pattern_size[1], 3), np.float32)
    objp[:, :2] = np.mgrid[0:pattern_size[0], 0:pattern_size[1]].T.reshape(-1, 2)
    objp *= float(args.square_size_mm)

    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.001)

    objpoints: list[np.ndarray] = []
    imgpoints: list[np.ndarray] = []
    image_size: tuple[int, int] | None = None

    print(f"[CAL] images={len(images)} pattern={pattern_size} square_mm={args.square_size_mm}")
    for path in images:
        img = cv2.imread(str(path))
        if img is None:
            print(f"[SKIP] read fail: {path.name}")
            continue

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        image_size = (gray.shape[1], gray.shape[0])
        ok, corners = cv2.findChessboardCorners(gray, pattern_size)
        if not ok:
            print(f"[SKIP] corner fail: {path.name}")
            continue

        corners2 = cv2.cornerSubPix(gray, corners, (11, 11), (-1, -1), criteria)
        objpoints.append(objp.copy())
        imgpoints.append(corners2)
        print(f"[OK] {path.name}")

    if image_size is None:
        raise RuntimeError("유효한 이미지를 읽지 못했습니다.")
    if len(objpoints) < int(args.min_valid):
        raise RuntimeError(
            f"유효 이미지 부족: {len(objpoints)}장 (최소 {args.min_valid}장 필요)"
        )

    rms, camera_matrix, dist_coeffs, rvecs, tvecs = cv2.calibrateCamera(
        objpoints, imgpoints, image_size, None, None
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    np.savez(
        str(output),
        camera_matrix=camera_matrix,
        dist_coeffs=dist_coeffs,
        image_width=image_size[0],
        image_height=image_size[1],
        pattern_cols=pattern_size[0],
        pattern_rows=pattern_size[1],
        square_size_mm=float(args.square_size_mm),
        rms=float(rms),
        valid_images=int(len(objpoints)),
        total_images=int(len(images)),
        rvecs=np.array(rvecs, dtype=object),
        tvecs=np.array(tvecs, dtype=object),
    )

    print("\n=== Calibration Result ===")
    print(f"RMS: {rms:.6f}")
    print(f"valid/total: {len(objpoints)}/{len(images)}")
    print(f"image_size: {image_size[0]}x{image_size[1]}")
    print("camera_matrix:")
    print(camera_matrix)
    print("dist_coeffs:")
    print(dist_coeffs.ravel())
    print(f"\nSaved: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
