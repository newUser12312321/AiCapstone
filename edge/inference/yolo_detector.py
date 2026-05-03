"""
YOLOv8 / YOLO11 추론 모듈

Ultralytics 라이브러리를 사용하여 모델을 로드하고,
주어진 이미지에서 피듀셜 마크 또는 결함을 탐지한다.

검사 파이프라인:
  Stage 1: 전체 이미지에서 피듀셜 마크(FIDUCIAL) 탐지 → 정렬 판단
  Stage 2: 정렬된 이미지(또는 ROI)에서 클래스 탐지
"""

import time
import logging
from collections import Counter
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from config.settings import settings
from models.schemas import BoundingBox, DetectionItem

logger = logging.getLogger(__name__)

# edge/inference/ → edge/ (CWD와 무관하게 weights/ 경로 해석)
_EDGE_ROOT = Path(__file__).resolve().parent.parent


def resolve_edge_weights_path(weights_path: str | Path) -> Path:
    """`weights/best.pt` 등은 항상 edge/ 기준으로 해석한다 (프로세스 CWD 무관)."""
    p = Path(weights_path)
    if p.is_absolute():
        return p
    return (_EDGE_ROOT / p).resolve()


def _is_fiducial_class_name(class_name: str, num_model_classes: int) -> bool:
    """
    Stage1 피듀셜 필터: CVAT/팀마다 fiducial, FIDUCIAL, fiducial_mark 등 이름이 달라서
    'fiducial' 부분 문자열로도 매칭. 단일 클래스 모델은 그 한 클래스를 피듀셜로 간주.
    """
    n = class_name.lower().strip()
    if n == "fiducial" or "fiducial" in n:
        return True
    if num_model_classes == 1:
        return True
    return False


def _matches_target_class(class_name: str, target_class: str, num_model_classes: int) -> bool:
    if target_class != "FIDUCIAL":
        return class_name == target_class
    return _is_fiducial_class_name(class_name, num_model_classes)


# 가중치 파일이 없을 때 개발 환경에서 사용할 더미 클래스 레이블
DUMMY_CLASS_NAMES = {
    0: "FIDUCIAL",
    1: "TRACE_OPEN",
    2: "METAL_DAMAGE",
}


def _clip_rect_to_image(
    x: float, y: float, w: float, h: float, img_w: int, img_h: int
) -> tuple[int, int, int, int]:
    """실수 박스를 이미지 경계에 맞춘 뒤, numpy 슬라이스용 정수 ROI로 반환."""
    x0 = int(np.floor(max(0.0, min(x, float(img_w - 1)))))
    y0 = int(np.floor(max(0.0, min(y, float(img_h - 1)))))
    x1 = int(np.ceil(min(x + max(w, 1e-9), float(img_w))))
    y1 = int(np.ceil(min(y + max(h, 1e-9), float(img_h))))
    x1 = max(x0 + 1, x1)
    y1 = max(y0 + 1, y1)
    return x0, y0, (x1 - x0), (y1 - y0)


def _refine_fiducial_center_subpixel(
    image: np.ndarray,
    det: DetectionItem,
    *,
    pad_ratio: float = 0.35,
    canny_lo: int = 40,
    canny_hi: int = 120,
    blur_ksize: int = 5,
    axis_ratio_min: float = 0.4,
) -> tuple[float, float] | None:
    """
    YOLO bbox 주변 ROI에서 타원 피팅 기반으로 피듀셜 중심을 서브픽셀로 보정한다.
    실패 시 None 반환.

    pad_ratio·Canny·블러·axis_ratio_min 은 폴백 시도에서 바꿔 재호출한다.
    """
    h, w = image.shape[:2]
    b = det.bbox
    pr = max(0.15, min(0.75, float(pad_ratio)))
    pad_x = max(4, int(round(float(b.width) * pr)))
    pad_y = max(4, int(round(float(b.height) * pr)))
    rx, ry, rw, rh = _clip_rect_to_image(
        float(b.x) - pad_x,
        float(b.y) - pad_y,
        float(b.width) + 2 * pad_x,
        float(b.height) + 2 * pad_y,
        w,
        h,
    )
    roi = image[ry:ry + rh, rx:rx + rw]
    if roi.size == 0:
        return None

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    bk = int(blur_ksize) if int(blur_ksize) % 2 == 1 else int(blur_ksize) + 1
    bk = max(3, min(bk, 11))
    gray = cv2.GaussianBlur(gray, (bk, bk), 0)
    lo = max(1, int(canny_lo))
    hi = max(lo + 1, int(canny_hi))
    edge = cv2.Canny(gray, lo, hi)
    contours, _ = cv2.findContours(edge, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return None

    roi_cx = rw / 2.0
    roi_cy = rh / 2.0
    min_area = max(15.0, float(b.width * b.height) * 0.02)
    max_area = float(rw * rh) * 0.98
    arm = float(axis_ratio_min)

    best_score = float("inf")
    best_center: tuple[float, float] | None = None
    for cnt in contours:
        area = float(cv2.contourArea(cnt))
        if area < min_area or area > max_area:
            continue
        if len(cnt) < 5:
            continue
        try:
            (cx, cy), (axis_a, axis_b), _angle = cv2.fitEllipse(cnt)
        except cv2.error:
            continue
        if axis_a <= 1.0 or axis_b <= 1.0:
            continue
        axis_ratio = min(axis_a, axis_b) / max(axis_a, axis_b)
        if axis_ratio < arm:
            continue
        dist = float(np.hypot(cx - roi_cx, cy - roi_cy))
        circular_penalty = abs(1.0 - axis_ratio) * 6.0
        score = dist + circular_penalty
        if score < best_score:
            best_score = score
            best_center = (float(cx), float(cy))

    if best_center is None:
        return None

    gx = float(rx) + best_center[0]
    gy = float(ry) + best_center[1]
    return gx, gy


def _refine_fiducial_with_fallbacks(image: np.ndarray, det: DetectionItem) -> tuple[float, float] | None:
    """한 마크에 대해 파라미터 폴백을 순서대로 시도해 2점 모두 보정될 확률을 높인다."""
    attempts: list[dict[str, float | int]] = [
        {},  # 기본
        {"pad_ratio": 0.5},
        {"pad_ratio": 0.55, "canny_lo": 25, "canny_hi": 95},
        {"pad_ratio": 0.5, "canny_lo": 15, "canny_hi": 70},
        {"pad_ratio": 0.6, "canny_lo": 20, "canny_hi": 80, "axis_ratio_min": 0.28},
        {"pad_ratio": 0.45, "canny_lo": 50, "canny_hi": 150, "blur_ksize": 3},
        {"pad_ratio": 0.65, "canny_lo": 10, "canny_hi": 60, "axis_ratio_min": 0.25, "blur_ksize": 7},
    ]
    for kw in attempts:
        out = _refine_fiducial_center_subpixel(image, det, **kw)
        if out is not None:
            return out
    return None


class YoloDetector:
    """
    YOLOv8n / YOLO11n 모델 래퍼 클래스.

    모델 로드는 최초 1회만 수행하고 이후에는 캐시된 모델을 재사용한다.
    (애플리케이션 시작 시 한 번만 인스턴스화할 것)

    사용 예 — 단일 모델:
        detector = YoloDetector()
        items = detector.detect(frame, target_class="FIDUCIAL")

    사용 예 — 멀티보드 라우팅:
        board_detector = YoloDetector(weights_path="weights/g_series_best.pt")
    """

    def __init__(
        self,
        weights_path: str = settings.YOLO_WEIGHTS_PATH,
        confidence_threshold: float = settings.YOLO_CONFIDENCE_THRESHOLD,
    ) -> None:
        self.weights_path = resolve_edge_weights_path(weights_path)
        self.confidence_threshold = confidence_threshold
        self._model = None   # 지연 로드(Lazy Load)

    # ── 모델 로드 ─────────────────────────────────────────────────────────────

    def load(self) -> None:
        """
        YOLO 모델을 메모리에 로드한다.

        가중치 파일(.pt)이 없는 경우(개발 환경):
          - Ultralytics에서 YOLOv8n 기본 모델을 자동 다운로드한다.
          - 실제 클래스 레이블 대신 더미 레이블을 사용한다.
        """
        try:
            from ultralytics import YOLO

            if not self.weights_path.exists():
                logger.warning(
                    "[YOLO] 가중치 파일 없음: %s → YOLOv8n 기본 모델로 대체합니다.",
                    self.weights_path
                )
                self._model = YOLO("yolov8n.pt")
            else:
                self._model = YOLO(str(self.weights_path))
                logger.info("[YOLO] 커스텀 모델 로드 완료: %s", self.weights_path)

            names = getattr(self._model, "names", None)
            if names:
                logger.info("[YOLO] 클래스 맵(nc=%s): %s", len(names), dict(names))
            else:
                logger.warning("[YOLO] 모델에 names 속성 없음 — 가중치/버전 확인")

            logger.info("[YOLO] 모델 준비 완료 (confidence 임계값: %.2f)", self.confidence_threshold)

        except ImportError:
            # ultralytics 패키지가 설치되지 않은 경우 더미 모드로 동작
            logger.error("[YOLO] ultralytics 패키지가 없습니다. 더미 탐지 모드로 동작합니다.")
            self._model = None

    # ── 추론 ─────────────────────────────────────────────────────────────────

    def detect(
        self,
        image: np.ndarray,
        target_class: Optional[str] = None,
        conf: Optional[float] = None,
    ) -> tuple[list[DetectionItem], int]:
        """
        이미지에서 객체를 탐지하고 DetectionItem 목록을 반환한다.

        Args:
            image:        OpenCV BGR 이미지 (H, W, 3)
            target_class: 이 이름의 클래스만 필터링. None이면 전체 반환.
                          예: "FIDUCIAL" → 피듀셜 마크만 반환
            conf:         Ultralytics conf 임계값. None이면 인스턴스 기본값.

        Returns:
            (탐지 결과 목록, 추론 소요 시간 ms) 튜플
        """
        if self._model is None:
            # 더미 모드: 빈 결과 반환 (모델 없이 파이프라인 흐름 테스트 가능)
            logger.warning("[YOLO] 더미 모드 — 빈 탐지 결과 반환")
            return [], 0

        start_time = time.perf_counter()
        conf_threshold = self.confidence_threshold if conf is None else float(conf)

        # YOLO 추론 실행
        # verbose=False: 콘솔 출력 억제
        # conf: 신뢰도 임계값 이하는 자동으로 필터링
        results = self._model.predict(
            source=image,
            conf=conf_threshold,
            imgsz=settings.YOLO_PREDICT_IMGSZ,
            augment=settings.YOLO_PREDICT_AUGMENT,
            verbose=False,
        )

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        logger.debug("[YOLO] 추론 완료: %dms", elapsed_ms)

        detections: list[DetectionItem] = []

        num_cls = len(self._model.names) if getattr(self._model, "names", None) else 0

        # results[0]: 단일 이미지 추론 결과
        # .boxes: 탐지된 박스 목록 (없으면 빈 텐서)
        if results and results[0].boxes is not None:
            img_h, img_w = image.shape[:2]
            for box in results[0].boxes:
                # 클래스 인덱스 및 이름 추출
                class_idx = int(box.cls[0])
                class_name: str = self._model.names.get(class_idx, f"CLASS_{class_idx}")
                conf: float = float(box.conf[0])

                # target_class 필터 적용 (None이면 전체)
                if target_class and not _matches_target_class(class_name, target_class, num_cls):
                    continue

                # YOLO xywh → 좌상단 기준 float XYWH (양자화 없이 유지)
                # box.xywh: [center_x, center_y, width, height] (float)
                xywh = box.xywh[0].tolist()
                cx, cy, bw, bh = map(float, xywh)
                x = cx - bw / 2.0
                y = cy - bh / 2.0
                w_box = max(1e-9, bw)
                h_box = max(1e-9, bh)
                x = max(0.0, min(x, float(img_w) - 1e-9))
                y = max(0.0, min(y, float(img_h) - 1e-9))
                w_box = max(1e-9, min(w_box, float(img_w) - x))
                h_box = max(1e-9, min(h_box, float(img_h) - y))

                detection = DetectionItem(
                    defect_type=class_name,
                    confidence=round(conf, 4),
                    bbox=BoundingBox(
                        x=x,
                        y=y,
                        width=w_box,
                        height=h_box,
                    ),
                )
                detections.append(detection)

        logger.info("[YOLO] 탐지 수: %d건 (필터: %s)", len(detections), target_class or "전체")
        return detections, elapsed_ms

    def detect_fiducials(self, image: np.ndarray) -> tuple[list[DetectionItem], int]:
        """
        Stage 1 전용: 이미지 전체에서 피듀셜 마크만 탐지한다.

        Returns:
            (피듀셜 마크 목록, 추론 ms)
        """
        fiducials, ms = self.detect(
            image,
            target_class="FIDUCIAL",
            conf=settings.effective_fiducial_confidence(),
        )
        refined_count = 0
        for i, det in enumerate(fiducials):
            bbox_cx = float(det.bbox.x) + float(det.bbox.width) / 2.0
            bbox_cy = float(det.bbox.y) + float(det.bbox.height) / 2.0
            yolo_cx = round(bbox_cx, 4)
            yolo_cy = round(bbox_cy, 4)
            refined = _refine_fiducial_with_fallbacks(image, det)
            upd: dict = {
                "yolo_center_x": yolo_cx,
                "yolo_center_y": yolo_cy,
            }
            if refined is not None:
                refined_count += 1
                upd["refined_center_x"] = round(refined[0], 4)
                upd["refined_center_y"] = round(refined[1], 4)
            fiducials[i] = det.model_copy(update=upd)
        if fiducials:
            logger.info("[YOLO] 피듀셜 서브픽셀 보정: %d/%d", refined_count, len(fiducials))
        return fiducials, ms

    def detect_defects(self, roi: np.ndarray) -> tuple[list[DetectionItem], int]:
        """
        Stage 2 전용: ROI 크롭 이미지에서 결함(단선, 까짐)을 탐지한다.

        Args:
            roi: Stage 1 정렬 후 크롭한 관심 영역 이미지

        Returns:
            (결함 목록, 추론 ms)
        """
        # 결함 클래스 중 하나라도 탐지되면 반환 (target_class=None → 전체)
        defects, ms = self.detect(
            roi,
            target_class=None,
            conf=settings.effective_defect_confidence(),
        )
        logger.info(
            "[YOLO] Stage2 임계값 통과(피듀셜 제거 전) 클래스별: %s",
            dict(Counter(d.defect_type for d in defects)),
        )
        # 피듀셜 마크 결과는 결함 목록에서 제외
        defects = [d for d in defects if "fiducial" not in d.defect_type.lower()]
        logger.info(
            "[YOLO] Stage2 전송용(피듀셜 제외) 클래스별: %s",
            dict(Counter(d.defect_type for d in defects)),
        )
        return defects, ms
