#!/usr/bin/env python3
"""GT125A 이미지에서 mount_hole 1개를 가려 FAIL 검사 후 VM 전송."""

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


def _find_mount_holes(frame, weights: str) -> list[tuple[int, int, int, int]]:
    det = YoloDetector(weights_path=weights)
    det.load()
    items, _ = det.detect(frame, target_class=None)
    boxes: list[tuple[int, int, int, int]] = []
    h, w = frame.shape[:2]
    for d in items:
        if d.defect_type.lower() != "mount_hole":
            continue
        x1 = max(0, int(d.bbox.x))
        y1 = max(0, int(d.bbox.y))
        x2 = min(w, int(d.bbox.x + d.bbox.width))
        y2 = min(h, int(d.bbox.y + d.bbox.height))
        boxes.append((x1, y1, x2, y2))
    return boxes


def _occlude_box(frame, box: tuple[int, int, int, int], pad: int = 12) -> None:
    x1, y1, x2, y2 = box
    x1 = max(0, x1 - pad)
    y1 = max(0, y1 - pad)
    x2 = min(frame.shape[1], x2 + pad)
    y2 = min(frame.shape[0], y2 + pad)
    cv2.rectangle(frame, (x1, y1), (x2, y2), (32, 32, 32), thickness=-1)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--image",
        type=Path,
        default=REPO_ROOT / "GT125A" / "2026-05-06_10-59-43.jpg",
    )
    ap.add_argument("--edge-url", default="http://127.0.0.1:8000")
    ap.add_argument("--weights", default="weights/GT_125A_bestV2.pt")
    ap.add_argument("--wait", type=float, default=45.0)
    args = ap.parse_args()

    src = args.image.resolve()
    if not src.is_file():
        raise SystemExit(f"image not found: {src}")

    frame = cv2.imread(str(src))
    if frame is None:
        raise SystemExit(f"cannot read image: {src}")

    boxes = _find_mount_holes(frame, args.weights)
    if not boxes:
        raise SystemExit("no mount_hole detected — pick another image or adjust weights")

    # 가장 왼쪽 상단 마운트홀 1개 가림 (재현성)
    target = min(boxes, key=lambda b: (b[1], b[0]))
    out = frame.copy()
    _occlude_box(out, target)

    out_dir = EDGE_DIR / "captures"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"occluded_{src.stem}.jpg"
    cv2.imwrite(str(out_path), out, [cv2.IMWRITE_JPEG_QUALITY, 95])
    print(f"occluded mount_hole at {target} -> {out_path}")

    url = f"{args.edge_url.rstrip('/')}/edge/inspect/upload"
    with out_path.open("rb") as f:
        r = requests.post(
            url,
            files={"image": (out_path.name, f, "image/jpeg")},
            params={"kioskPreset": "gt125a"},
            timeout=180,
        )
    r.raise_for_status()
    print("upload:", r.json().get("message", r.text))
    print(f"waiting {args.wait}s for pipeline + cloud...")
    time.sleep(args.wait)
    return 0


if __name__ == "__main__":
    sys.exit(main())
