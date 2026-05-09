"""
CVAT for images 1.1 annotations.xml → Ultralytics YOLO 디렉터리 구조.

- images/train, images/val, labels/train, labels/val
- data.yaml (path 기준은 out_dir)
- 박스는 축정렬: xtl,ytl,xbr,ybr → YOLO normalized xywh (rotation 속성 무시)
"""

from __future__ import annotations

import argparse
import random
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

import yaml


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Convert CVAT 1.1 image XML to YOLO dataset.")
    p.add_argument("--xml", type=Path, required=True, help="Path to annotations.xml")
    p.add_argument("--images-dir", type=Path, required=True, help="Folder with source images")
    p.add_argument("--out-dir", type=Path, required=True, help="Output dataset root")
    p.add_argument("--val-ratio", type=float, default=0.2, help="Validation fraction")
    p.add_argument("--seed", type=int, default=42)
    return p.parse_args()


def box_to_yolo_line(cls_id: int, xtl: str, ytl: str, xbr: str, ybr: str, w: int, h: int) -> str:
    xtl_f, ytl_f, xbr_f, ybr_f = float(xtl), float(ytl), float(xbr), float(ybr)
    bw, bh = xbr_f - xtl_f, ybr_f - ytl_f
    cx, cy = xtl_f + bw / 2, ytl_f + bh / 2
    return f"{cls_id} {cx / w:.6f} {cy / h:.6f} {bw / w:.6f} {bh / h:.6f}\n"


def main() -> None:
    args = parse_args()
    xml_path = args.xml.resolve()
    img_dir = args.images_dir.resolve()
    out_dir = args.out_dir.resolve()

    if not xml_path.is_file():
        raise FileNotFoundError(xml_path)
    if not img_dir.is_dir():
        raise FileNotFoundError(img_dir)

    for sub in ("images/train", "images/val", "labels/train", "labels/val"):
        (out_dir / sub).mkdir(parents=True, exist_ok=True)

    tree = ET.parse(xml_path)
    root = tree.getroot()
    label_names = [lb.find("name").text for lb in root.findall(".//meta/task/labels/label")]
    label_names = sorted(set(label_names))
    name_to_id = {n: i for i, n in enumerate(label_names)}

    rng = random.Random(args.seed)
    missing: list[str] = []
    written_train = 0
    written_val = 0

    for image in root.findall("image"):
        fname = image.get("name")
        assert fname is not None
        w = int(image.get("width", 0))
        h = int(image.get("height", 0))
        src = img_dir / fname
        if not src.is_file():
            missing.append(fname)
            continue

        lines: list[str] = []
        for box in image.findall("box"):
            lab = box.get("label")
            if lab not in name_to_id:
                continue
            lines.append(
                box_to_yolo_line(
                    name_to_id[lab],
                    box.get("xtl", "0"),
                    box.get("ytl", "0"),
                    box.get("xbr", "0"),
                    box.get("ybr", "0"),
                    w,
                    h,
                )
            )

        split = "val" if rng.random() < args.val_ratio else "train"
        shutil.copy2(src, out_dir / "images" / split / fname)
        lbl_name = Path(fname).stem + ".txt"
        (out_dir / "labels" / split / lbl_name).write_text("".join(lines), encoding="utf-8")
        if split == "val":
            written_val += 1
        else:
            written_train += 1

    data = {
        "path": str(out_dir.as_posix()),
        "train": "images/train",
        "val": "images/val",
        "nc": len(label_names),
        "names": {i: n for i, n in enumerate(label_names)},
    }
    (out_dir / "data.yaml").write_text(
        yaml.safe_dump(data, sort_keys=False, allow_unicode=False),
        encoding="utf-8",
    )

    report = [
        f"xml: {xml_path}",
        f"images_dir: {img_dir}",
        f"out_dir: {out_dir}",
        f"classes ({len(label_names)}): {label_names}",
        f"train images: {written_train}",
        f"val images: {written_val}",
        f"missing source files: {len(missing)}",
        *[f"  - {m}" for m in missing[:50]],
        *(["  ..."] if len(missing) > 50 else []),
    ]
    (out_dir / "convert_report.txt").write_text("\n".join(report), encoding="utf-8")

    print("\n".join(report))


if __name__ == "__main__":
    main()
