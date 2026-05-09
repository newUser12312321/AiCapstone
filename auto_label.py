from pathlib import Path

from ultralytics import YOLO

# === config ===
IMAGES_DIR = Path(r"C:\Projects\AiCapstoneV2\PCB_IMG")
OUT_ROOT = Path(r"C:\Projects\AiCapstoneV2\auto_labels")
OUT_LABELS_DIR = OUT_ROOT / "labels"
MODEL_PATH = Path(r"C:\Projects\AiCapstoneV2\edge\weights\best.pt")
CONF = 0.25

# Must match CVAT label order exactly.
CLASS_ORDER = [
    "mount_hole",
    "gold_finger_row",
    "fiducial",
    "smd_array_block",
    "ic_chip",
    "edge_connector_zone",
]
CLASS_TO_ID = {name: i for i, name in enumerate(CLASS_ORDER)}
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def main() -> None:
    OUT_LABELS_DIR.mkdir(parents=True, exist_ok=True)

    if not IMAGES_DIR.exists():
        raise FileNotFoundError(f"Images directory not found: {IMAGES_DIR}")
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

    model = YOLO(str(MODEL_PATH))
    image_paths = sorted(p for p in IMAGES_DIR.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES)

    if not image_paths:
        raise RuntimeError(f"No image files found in: {IMAGES_DIR}")

    for image_path in image_paths:
        results = model.predict(source=str(image_path), conf=CONF, verbose=False)
        result = results[0]
        lines: list[str] = []

        if result.boxes is not None and len(result.boxes) > 0:
            for box in result.boxes:
                cls_idx = int(box.cls[0].item())
                cls_name = model.names.get(cls_idx, str(cls_idx))
                if cls_name not in CLASS_TO_ID:
                    continue

                x, y, w, h = box.xywhn[0].tolist()
                label_id = CLASS_TO_ID[cls_name]
                lines.append(f"{label_id} {x:.6f} {y:.6f} {w:.6f} {h:.6f}")

        out_txt_path = OUT_LABELS_DIR / f"{image_path.stem}.txt"
        out_txt_path.write_text("\n".join(lines), encoding="utf-8")

    (OUT_ROOT / "obj.names").write_text("\n".join(CLASS_ORDER), encoding="utf-8")
    print(f"Auto-labeling complete. Files written to: {OUT_ROOT}")


if __name__ == "__main__":
    main()
