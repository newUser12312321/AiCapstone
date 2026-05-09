"""
폴더별 이미지에 대해 지정 YOLO 가중치로 피듀셜 2점을 검출하고,
두 피듀셜 중심 간 거리(px) 통계와 실측(mm) 기준 스케일(mm/px, px/mm)을 산출한다.

  cd edge
  python tools/fiducial_distance_stats.py

프로젝트 검사 파이프라인과 동일하게 `YoloDetector.detect_fiducials` +
`compute_alignment`(좌→우 두 점) 로 거리를 계산한다.
"""

from __future__ import annotations

import argparse
import logging
import math
import sys
from pathlib import Path

_EDGE_ROOT = Path(__file__).resolve().parent.parent
if str(_EDGE_ROOT) not in sys.path:
    sys.path.insert(0, str(_EDGE_ROOT))

import cv2  # noqa: E402
import numpy as np  # noqa: E402

from inference.alignment import compute_alignment  # noqa: E402
from inference.yolo_detector import YoloDetector  # noqa: E402


def _iter_images(folder: Path) -> list[Path]:
    exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    return sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in exts)


def _fiducial_pair_distance_px(
    detector: YoloDetector,
    bgr: np.ndarray,
    conf_override: float | None,
) -> tuple[float | None, str]:
    """
    Returns:
        (거리 px 또는 None, 에러 메시지 또는 "")
    """
    fids, _ms = detector.detect_fiducials(bgr, conf_override=conf_override)
    al = compute_alignment(fids)
    if al.fiducial1 is None or al.fiducial2 is None:
        return None, f"피듀셜 부족: {len(fids)}건"
    ax = al.fiducial1.center_x_subpx
    ay = al.fiducial1.center_y_subpx
    bx = al.fiducial2.center_x_subpx
    by = al.fiducial2.center_y_subpx
    dist = float(math.hypot(bx - ax, by - ay))
    return dist, ""


def _run_folder(
    name: str,
    image_dir: Path,
    weights_rel: str,
    truth_mm: float,
    fiducial_conf: float | None,
) -> dict:
    # 가중치 경로만 사용; 피듀셜 conf는 detect_fiducials(..., conf_override=)로 전달 (settings 기본 가능)
    detector = YoloDetector(weights_path=weights_rel)
    detector.load()

    paths = _iter_images(image_dir)
    distances: list[float] = []
    failures: list[tuple[str, str]] = []

    for p in paths:
        img = cv2.imread(str(p))
        if img is None:
            failures.append((p.name, "이미지 로드 실패"))
            continue
        dist_px, err = _fiducial_pair_distance_px(detector, img, fiducial_conf)
        if dist_px is None:
            failures.append((p.name, err))
            continue
        distances.append(dist_px)

    arr = np.asarray(distances, dtype=np.float64) if distances else np.array([], dtype=np.float64)

    out: dict = {
        "name": name,
        "image_dir": str(image_dir),
        "weights": weights_rel,
        "truth_mm": truth_mm,
        "n_images": len(paths),
        "n_ok": len(distances),
        "n_fail": len(failures),
        "failures": failures[:20],
        "failures_truncated": max(0, len(failures) - 20),
    }

    if len(arr) == 0:
        out["mean_px"] = None
        out["std_px"] = None
        out["mm_per_px_mean"] = None
        out["px_per_mm_mean"] = None
        return out

    mean_px = float(arr.mean())
    std_px = float(arr.std(ddof=1)) if len(arr) > 1 else 0.0
    out["mean_px"] = mean_px
    out["std_px"] = std_px
    out["min_px"] = float(arr.min())
    out["max_px"] = float(arr.max())
    # 스케일: 동일 기판·동일 카메라 거리라면 mean_px 가 실측 truth_mm 에 대응
    out["mm_per_px_mean"] = truth_mm / mean_px
    out["px_per_mm_mean"] = mean_px / truth_mm
    # 이미지별 mm_per_px (점수 분포)
    out["mm_per_px_std_propagation"] = (
        float(truth_mm / (mean_px**2) * std_px) if mean_px > 0 else None
    )

    return out


def main() -> int:
    logging.basicConfig(level=logging.WARNING)

    ap = argparse.ArgumentParser(description="피듀셜 간 거리(px) 통계 및 mm 스케일")
    ap.add_argument(
        "--gt125a-dir",
        type=Path,
        default=Path(r"C:\Projects\AiCapstoneV2\GT125A"),
        help="GT125A 이미지 폴더",
    )
    ap.add_argument(
        "--gn948x-dir",
        type=Path,
        default=Path(r"C:\Projects\AiCapstoneV2\gn948x"),
        help="gn948x 이미지 폴더",
    )
    ap.add_argument(
        "--weights-gt125a",
        default="weights/GT_125A_bestV2.pt",
        help="GT125A 폴더 검출용 가중치 (edge 기준 상대 경로)",
    )
    ap.add_argument(
        "--weights-gn948x",
        default="weights/gn948x_best.pt",
        help="gn948x 폴더 검출용 가중치",
    )
    ap.add_argument("--mm-gt125a", type=float, default=140.0, help="GT125A 실측 피듀셜 간 거리 (mm)")
    ap.add_argument("--mm-gn948x", type=float, default=117.0, help="gn948x 실측 피듀셜 간 거리 (mm)")
    ap.add_argument(
        "--fiducial-conf",
        type=float,
        default=None,
        help="YOLO 피듀셜 conf 임계값 (미지정 시 .env / settings 의 effective_fiducial)",
    )
    ap.add_argument("--skip-gt125a", action="store_true")
    ap.add_argument("--skip-gn948x", action="store_true")
    args = ap.parse_args()

    rows = []
    if not args.skip_gt125a:
        if not args.gt125a_dir.is_dir():
            print(f"[ERR] GT125A 폴더 없음: {args.gt125a_dir}", file=sys.stderr)
            return 1
        rows.append(
            _run_folder("GT125A", args.gt125a_dir, args.weights_gt125a, args.mm_gt125a, args.fiducial_conf)
        )

    if not args.skip_gn948x:
        if not args.gn948x_dir.is_dir():
            print(f"[ERR] gn948x 폴더 없음: {args.gn948x_dir}", file=sys.stderr)
            return 1
        rows.append(
            _run_folder("gn948x", args.gn948x_dir, args.weights_gn948x, args.mm_gn948x, args.fiducial_conf)
        )

    def print_block(r: dict) -> None:
        print()
        print(f"=== {r['name']} ===")
        print(f"  폴더     : {r['image_dir']}")
        print(f"  가중치   : {r['weights']}")
        print(f"  실측 간격: {r['truth_mm']} mm")
        print(f"  이미지 수: {r['n_images']} (성공 {r['n_ok']} / 실패 {r['n_fail']})")
        if r["mean_px"] is None:
            print("  거리(px): (성공 없음)")
            if r["failures"]:
                for fn, msg in r["failures"][:10]:
                    print(f"    - {fn}: {msg}")
            return
        print(f"  거리(px): mean={r['mean_px']:.4f}, std={r['std_px']:.4f}, min={r['min_px']:.4f}, max={r['max_px']:.4f}")
        print(f"  스케일   : mm/px = {r['mm_per_px_mean']:.6f}  |  px/mm = {r['px_per_mm_mean']:.6f}")
        if r.get("mm_per_px_std_propagation") is not None:
            print(f"  (참고) mean 기준 mm/px 의 표준편차 추정 ≈ {r['mm_per_px_std_propagation']:.8f}")
        if r["failures"]:
            print(f"  실패 샘플 (최대 10개, 전체 {r['n_fail']}건):")
            for fn, msg in r["failures"][:10]:
                print(f"    - {fn}: {msg}")

    for r in rows:
        print_block(r)

    print()
    print("요약: 동일 카메라·동일 거리라면 mm/px는 기판과 무관하게 같아야 하며,")
    print("      서로 다른 실측 간격(mm)은 픽셀 거리(px)에 비례해 나타나야 한다.")
    print("      위 두 행의 mm/px 차이는 초점·조명·탐지 지터 등으로 생길 수 있다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
