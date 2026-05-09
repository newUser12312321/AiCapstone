"""
대시보드「기판 기준 정보」용: 고정 경로 이미지 + 보드별 가중치로 전체 클래스 검출 후
바운딩 박스만 그린 JPEG 바이트 생성 (신뢰도 % 표시 없음).
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from inference.yolo_detector import YoloDetector, resolve_edge_weights_path

logger = logging.getLogger(__name__)

_EDGE_ROOT = Path(__file__).resolve().parent.parent
_REPO_ROOT = _EDGE_ROOT.parent

# frontend/src/types/inspection.ts DEFECT_LABEL 과 동기화
_CLASS_LABEL_KO: dict[str, str] = {
    "trace_open": "단선",
    "metal_damage": "까짐",
    "pinhole": "핀홀",
    "short": "단락",
    "mount_hole": "고정홀",
    "gold_finger_row": "금핑거 열",
    "fiducial": "피듀셜",
    "smd_array_block": "SMD 어레이",
    "ic_chip": "IC",
    "edge_connector_zone": "에지 커넥터",
    "connector": "커넥터",
    "group_connector": "그룹 커넥터",
    "model_name_zone": "모델명 영역",
    "g_series_name_zone": "G시리즈 명판",
    "gn-948x": "GN-948X",
}

# BGR — 기판 위에서 잘 보이도록 채도·명도 높은 팔레트
_PALETTE_BGR = [
    (0, 255, 255),
    (0, 180, 255),
    (255, 80, 220),
    (0, 255, 128),
    (255, 200, 0),
    (255, 96, 60),
    (180, 255, 255),
    (255, 255, 80),
    (120, 220, 255),
    (255, 128, 255),
]

_BOX_OUTLINE_BGR = (0, 0, 0)  # 바깥 검정 테두리로 대비


def _box_line_thickness_for_shape(h: int, w: int) -> int:
    m = min(h, w)
    return int(np.clip(m / 280.0, 4.0, 10.0))


def _label_ko(defect_type: str) -> str:
    raw = (defect_type or "").strip()
    k = raw.lower()
    return _CLASS_LABEL_KO.get(k) or _CLASS_LABEL_KO.get(raw) or raw


def _color_bgr(defect_type: str) -> tuple[int, int, int]:
    s = (defect_type or "x").lower()
    h = sum(ord(c) * (i + 1) for i, c in enumerate(s)) % len(_PALETTE_BGR)
    return _PALETTE_BGR[h]


def _pil_font(size_px: int):
    from PIL import ImageFont

    size_px = max(18, min(size_px, 52))
    for fp in (
        r"C:\Windows\Fonts\malgun.ttf",
        "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        try:
            return ImageFont.truetype(fp, size_px)
        except OSError:
            continue
    return ImageFont.load_default()


def _label_font_size_px(h: int, w: int) -> int:
    """크롭 후에도 읽기 쉽도록 짧은 변 기준 스케일."""
    return int(np.clip(min(h, w) * 0.038, 22, 46))


def _crop_to_board_content(
    vis_bgr: np.ndarray,
    detections: list[Any],
    *,
    margin_ratio: float = 0.065,
    min_margin_px: int = 42,
    max_margin_px: int = 130,
    extra_top_for_labels_px: int = 88,
) -> np.ndarray:
    """
    검출 박스들의 외접 사각형 + 라벨이 올라갈 위쪽 여유 + 비율 기반 마진으로 크롭.
    배경(검은 테두리)을 줄여 대시보드에서 기판이 크게 보이게 한다.
    """
    h, w = vis_bgr.shape[:2]
    if not detections:
        return vis_bgr

    xs1: list[int] = []
    ys1: list[int] = []
    xs2: list[int] = []
    ys2: list[int] = []
    for det in detections:
        b = det.bbox
        x1 = int(round(float(b.x)))
        y1 = int(round(float(b.y)))
        x2 = int(round(float(b.x + b.width)))
        y2 = int(round(float(b.y + b.height)))
        xs1.append(x1)
        ys1.append(max(0, y1 - extra_top_for_labels_px))
        xs2.append(x2)
        ys2.append(y2)

    ux1, uy1 = min(xs1), min(ys1)
    ux2, uy2 = max(xs2), max(ys2)
    bw, bh = max(1, ux2 - ux1), max(1, uy2 - uy1)
    m = int(np.clip(margin_ratio * float(max(bw, bh)), min_margin_px, max_margin_px))

    cx1 = max(0, ux1 - m)
    cy1 = max(0, uy1 - m)
    cx2 = min(w, ux2 + m)
    cy2 = min(h, uy2 + m)

    # 거의 전 프레임이면(배경이 매우 얇음) 원본 유지
    cropped_ratio = ((cx2 - cx1) * (cy2 - cy1)) / float(max(1, w * h))
    if cropped_ratio > 0.97:
        return vis_bgr

    if cx2 <= cx1 + 8 or cy2 <= cy1 + 8:
        return vis_bgr

    return vis_bgr[cy1:cy2, cx1:cx2]


def _draw_labels_pil(
    vis_bgr: np.ndarray,
    items: list[tuple[int, int, str, tuple[int, int, int]]],
) -> np.ndarray:
    """박스가 그려진 BGR 이미지 위에 한글 라벨 — 큰 글자·검정 스트로크·어두운 배너."""
    try:
        from PIL import Image, ImageDraw

        h_img, w_img = vis_bgr.shape[:2]
        fs = _label_font_size_px(h_img, w_img)
        pad = max(6, fs // 5)
        stroke_w = max(2, fs // 12)

        img_rgb = cv2.cvtColor(vis_bgr, cv2.COLOR_BGR2RGB)
        pil = Image.fromarray(img_rgb)
        draw = ImageDraw.Draw(pil)
        font = _pil_font(fs)

        for x, y_base, text, color_bgr in items:
            rgb = (int(color_bgr[2]), int(color_bgr[1]), int(color_bgr[0]))
            bbox = draw.textbbox((0, 0), text, font=font, stroke_width=stroke_w)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
            ty_text = y_base - th - pad * 2 - stroke_w * 2
            if ty_text < 0:
                ty_text = min(y_base + 8, max(0, h_img - th - pad * 2 - stroke_w * 2))

            bx0 = max(0, x)
            by0 = max(0, ty_text)
            bx1 = min(w_img - 1, x + tw + pad * 2 + stroke_w * 4)
            by1 = min(h_img - 1, ty_text + th + pad * 2 + stroke_w * 4)

            draw.rectangle([bx0, by0, bx1, by1], fill=(22, 22, 22), outline=(255, 255, 255), width=2)

            tx = bx0 + pad + stroke_w
            ty_draw = by0 + pad + stroke_w
            draw.text(
                (tx, ty_draw),
                text,
                font=font,
                fill=rgb,
                stroke_width=stroke_w,
                stroke_fill=(0, 0, 0),
            )

        return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    except Exception as e:
        logger.warning("[board-ref] PIL 라벨 실패: %s", e)
        return vis_bgr


BOARD_REFERENCE_SOURCES: dict[str, dict[str, Any]] = {
    "GT_125A": {
        "image_path": _REPO_ROOT / "GT125A" / "2026-05-06_10-59-43.jpg",
        "weights": "weights/GT_125A_bestV2.pt",
    },
    "GN_948X": {
        "image_path": _REPO_ROOT / "gn948x" / "2026-05-06_11-21-06.jpg",
        "weights": "weights/gn948x_best.pt",
    },
}


def render_board_reference_overlay_jpeg(board_key: str, *, conf: float = 0.15) -> bytes:
    """
    board_key: GT_125A | GN_948X
    전체 클래스 검출(conf), 박스 + 클래스명(한글)만 — 신뢰도 숫자 미표시.
    """
    key = (board_key or "").strip().upper().replace("-", "_")
    if key == "GN948X":
        key = "GN_948X"
    cfg = BOARD_REFERENCE_SOURCES.get(key)
    if cfg is None:
        raise ValueError(f"지원하지 않는 board: {board_key}")

    img_path: Path = cfg["image_path"]
    if not img_path.is_file():
        raise FileNotFoundError(f"기준 이미지 없음: {img_path}")

    weights_rel = str(cfg["weights"])
    wpath = resolve_edge_weights_path(weights_rel)
    if not wpath.is_file():
        raise FileNotFoundError(f"가중치 없음: {wpath}")

    frame = cv2.imread(str(img_path))
    if frame is None:
        raise ValueError(f"이미지 디코딩 실패: {img_path}")

    detector = YoloDetector(weights_path=weights_rel, confidence_threshold=conf)
    detector.load()
    detections, _ms = detector.detect(frame, target_class=None, conf=conf)

    fh, fw = frame.shape[:2]
    line_t = _box_line_thickness_for_shape(fh, fw)
    vis = frame.copy()
    label_items: list[tuple[int, int, str, tuple[int, int, int]]] = []
    for det in detections:
        b = det.bbox
        x1 = int(round(float(b.x)))
        y1 = int(round(float(b.y)))
        x2 = int(round(float(b.x + b.width)))
        y2 = int(round(float(b.y + b.height)))
        color = _color_bgr(det.defect_type)
        cv2.rectangle(vis, (x1, y1), (x2, y2), _BOX_OUTLINE_BGR, line_t + 4)
        cv2.rectangle(vis, (x1, y1), (x2, y2), color, line_t)
        label = _label_ko(det.defect_type)
        ty = max(_label_font_size_px(fh, fw) + 8, y1 - 4)
        label_items.append((x1, ty, label, color))

    vis = _draw_labels_pil(vis, label_items)
    vis = _crop_to_board_content(vis, detections)

    ok, encoded = cv2.imencode(".jpg", vis, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    if not ok:
        raise RuntimeError("JPEG 인코딩 실패")
    return encoded.tobytes()


def load_fiducial_calibration_json() -> dict[str, Any]:
    path = _EDGE_ROOT / "config" / "fiducial_scale_calibration.json"
    if not path.is_file():
        raise FileNotFoundError(str(path))
    return json.loads(path.read_text(encoding="utf-8"))
