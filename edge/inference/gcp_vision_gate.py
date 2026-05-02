"""
Google Cloud Vision API로 촬영 이미지의 실크 텍스트를 읽고,
설정(JSON)의 필수 문자열·정규식을 만족하는지 검사한다.

credentials: 표준적으로 GOOGLE_APPLICATION_CREDENTIALS(서비스 계정 JSON 경로).
설정에서 GOOGLE_CLOUD_CREDENTIALS_PATH를 주면 시작 시 해당 경로로 덮어쓴다.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import cv2
import numpy as np

from config.settings import settings

logger = logging.getLogger(__name__)

_EDGE_ROOT = Path(__file__).resolve().parent.parent


def _resolve_edge_path(path_like: str) -> Path:
    p = Path(path_like)
    if p.is_absolute():
        return p
    return (_EDGE_ROOT / p).resolve()


_ANNOTATOR_CLIENT: Any = None


def _get_image_annotator_client():
    global _ANNOTATOR_CLIENT
    cred_path = getattr(settings, "GOOGLE_CLOUD_CREDENTIALS_PATH", None)
    if cred_path:
        resolved = _resolve_edge_path(str(cred_path))
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(resolved)

    if _ANNOTATOR_CLIENT is None:
        try:
            from google.cloud import vision_v1 as vision_v1_mod  # type: ignore
        except ImportError as e:
            raise RuntimeError(
                "google-cloud-vision 미설치: pip install google-cloud-vision"
            ) from e
        _ANNOTATOR_CLIENT = vision_v1_mod.ImageAnnotatorClient()

    return _ANNOTATOR_CLIENT


@dataclass
class VisionGateOutcome:
    ok: bool
    full_text: str
    latency_ms: int
    defect_type: Optional[str] = None
    detail: Optional[str] = None


def _normalize(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def load_gate_config(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(f"vision gate config not found: {path}")
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("vision gate config must be a JSON object")
    subs = raw.get("required_substrings") or []
    regs = raw.get("required_regexes") or []
    if not isinstance(subs, list) or not isinstance(regs, list):
        raise ValueError("required_substrings / required_regexes must be arrays")
    return {
        "required_substrings": [str(x) for x in subs if str(x).strip()],
        "required_regexes": [str(x) for x in regs if str(x).strip()],
        "normalize_before_substrings": bool(raw.get("normalize_before_substrings", True)),
    }


def _encode_jpeg(bgr: np.ndarray) -> bytes:
    q = int(getattr(settings, "GOOGLE_CLOUD_VISION_JPEG_QUALITY", 90))
    ok, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, q])
    if not ok:
        raise RuntimeError("JPEG 인코딩 실패")
    return bytes(buf)


def document_text_from_image(jpeg_bytes: bytes) -> tuple[str, int]:
    from google.cloud import vision_v1 as vision_v1_mod  # type: ignore

    client = _get_image_annotator_client()
    image = vision_v1_mod.Image(content=jpeg_bytes)
    t0 = time.perf_counter()
    response = client.document_text_detection(image=image)
    elapsed_ms = int((time.perf_counter() - t0) * 1000)

    err = getattr(response, "error", None)
    code = int(getattr(err, "code", 0) if err is not None else 0)
    if code != 0:
        msg = getattr(err, "message", None) or "unknown Vision API error"
        raise RuntimeError(f"Vision API error {code}: {msg}")

    text = ""
    if response.full_text_annotation and response.full_text_annotation.text:
        text = response.full_text_annotation.text
    return text, elapsed_ms


def evaluate_gate(full_text: str, cfg: dict[str, Any]) -> tuple[bool, Optional[str]]:
    subs: list[str] = cfg["required_substrings"]
    regs: list[str] = cfg["required_regexes"]
    use_norm = cfg["normalize_before_substrings"]
    hay = _normalize(full_text) if use_norm else full_text

    for sub in subs:
        needle = _normalize(sub) if use_norm else sub
        if needle not in hay:
            return False, f"missing substring: {sub!r}"

    for pattern in regs:
        try:
            if not re.search(pattern, full_text, flags=re.MULTILINE | re.DOTALL):
                return False, f"regex not matched: {pattern!r}"
        except re.error as e:
            return False, f"invalid regex {pattern!r}: {e}"

    return True, None


def run_vision_gate(bgr_frame: np.ndarray) -> VisionGateOutcome:
    """
    Vision DOCUMENT_TEXT_DETECTION 후 게이트 규칙 적용.

    설정 비활성화 시 즉시 ok=True (full_text 빈 문자열).
    """
    if not getattr(settings, "GOOGLE_CLOUD_VISION_GATE_ENABLED", False):
        return VisionGateOutcome(ok=True, full_text="", latency_ms=0)

    cfg_path = _resolve_edge_path(
        str(getattr(settings, "GOOGLE_CLOUD_VISION_GATE_CONFIG_PATH", "config/vision_board_gate.json"))
    )
    try:
        cfg = load_gate_config(cfg_path)
    except (OSError, ValueError, json.JSONDecodeError) as e:
        logger.error("[Vision게이트] 설정 로드 실패: %s", e)
        return VisionGateOutcome(
            ok=False,
            full_text="",
            latency_ms=0,
            defect_type="VISION_GATE_CONFIG_ERROR",
            detail=str(e),
        )

    try:
        jpeg = _encode_jpeg(bgr_frame)
        full_text, ms = document_text_from_image(jpeg)
    except RuntimeError as e:
        logger.warning("[Vision게이트] API/라이브러리 오류: %s", e)
        return VisionGateOutcome(
            ok=False,
            full_text="",
            latency_ms=0,
            defect_type="VISION_OCR_GATE_SERVICE_ERROR",
            detail=str(e),
        )
    except Exception as e:
        logger.warning("[Vision게이트] 예외: %s", e, exc_info=True)
        return VisionGateOutcome(
            ok=False,
            full_text="",
            latency_ms=0,
            defect_type="VISION_OCR_GATE_SERVICE_ERROR",
            detail=str(e),
        )

    ok_rule, hint = evaluate_gate(full_text, cfg)
    snippet = full_text.replace("\n", " ")[:200]
    logger.info("[Vision게이트] Vision %d ms, 규칙=%s (%s)", ms, ok_rule, snippet)

    if not ok_rule:
        return VisionGateOutcome(
            ok=False,
            full_text=full_text,
            latency_ms=ms,
            defect_type="VISION_OCR_GATE_FAIL",
            detail=hint,
        )

    return VisionGateOutcome(ok=True, full_text=full_text, latency_ms=ms)
