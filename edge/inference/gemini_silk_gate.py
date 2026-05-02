"""
Gemini generateContent(멀티모달)로 실크 텍스트를 받은 뒤
silk_gate_rules(JSON)와 동일한 규칙으로 검증한다.

API 키: 환경변수 GEMINI_API_KEY 또는 settings.GEMINI_API_KEY
"""

from __future__ import annotations

import base64
import json
import logging
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np

from config.settings import settings
from inference.silk_gate_rules import evaluate_gate, load_gate_config, resolve_silk_gate_config_path

logger = logging.getLogger(__name__)

# urllib generateContent 전체 응답 대기(초) — 설정으로 바꾸지 않고 고정
_GEMINI_HTTP_TIMEOUT_SEC = 120


@dataclass
class GeminiGateOutcome:
    ok: bool
    full_text: str
    latency_ms: int
    defect_type: Optional[str] = None
    detail: Optional[str] = None


def _gemini_api_key() -> str:
    k = getattr(settings, "GEMINI_API_KEY", None) or ""
    return str(k).strip()


def _is_transient_gemini_transport_error(e: BaseException) -> bool:
    """소켓 타임아웃·연결 끊김·일부 5xx 등 — 짧은 대기 후 재시도할 만한 오류."""
    if isinstance(e, TimeoutError):
        return True
    if isinstance(e, (BrokenPipeError, ConnectionResetError, ConnectionAbortedError)):
        return True
    if isinstance(e, ssl.SSLError):
        return True
    if isinstance(e, urllib.error.HTTPError):
        return e.code in (408, 429, 500, 502, 503, 504)
    if isinstance(e, urllib.error.URLError):
        return True
    lowered = str(e).lower()
    if "timed out" in lowered or "timeout" in lowered:
        return True
    # _generate_content_text 가 HTTP 오류를 RuntimeError 로 감싼 경우
    if isinstance(e, RuntimeError):
        s = str(e)
        return bool(
            any(x in s for x in ("HTTP 408", "HTTP 429", "HTTP 500", "HTTP 502", "HTTP 503", "HTTP 504"))
        )
    return False


def _generate_content_text(jpeg_bytes: bytes, api_key: str, model: str) -> tuple[str, int]:
    """REST v1beta generateContent → 본문 텍스트, 지연 ms. (HTTP 읽기 타임아웃 120초 고정)"""
    img_b64 = base64.standard_b64encode(jpeg_bytes).decode("ascii")
    body = {
        "contents": [
            {
                "parts": [
                    {
                        "text": (
                            "You are assisting an automated PCB silkscreen OCR gate. "
                            "Transcribe every readable silkscreen / label text on this "
                            "PCB photo. Output plain text only — one logical line per line, "
                            "UTF-8, no markdown."
                        )
                    },
                    {"inline_data": {"mime_type": "image/jpeg", "data": img_b64}},
                ]
            }
        ]
    }

    safe_model = (model or "gemini-2.5-flash").strip()
    quoted_key = urllib.parse.quote(api_key, safe="")
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{safe_model}:generateContent?key={quoted_key}"
    )
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=_GEMINI_HTTP_TIMEOUT_SEC) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_txt = e.read().decode("utf-8", errors="replace") if e.fp else ""
        raise RuntimeError(f"HTTP {e.code}: {err_txt}") from e
    elapsed_ms = int((time.perf_counter() - t0) * 1000)

    if "error" in raw:
        raise RuntimeError(json.dumps(raw["error"], ensure_ascii=False))

    try:
        text = raw["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"unexpected response: {raw!r}") from e

    return str(text or ""), elapsed_ms


def run_gemini_silk_gate(bgr_frame: np.ndarray) -> GeminiGateOutcome:
    """Gemini 호출 후 실크 검증 JSON 규칙 적용."""

    if not getattr(settings, "GEMINI_GATE_ENABLED", False):
        return GeminiGateOutcome(ok=True, full_text="", latency_ms=0)

    api_key = _gemini_api_key()
    if not api_key:
        logger.error("[Gemini게이트] GEMINI_API_KEY 미설정")
        return GeminiGateOutcome(
            ok=False,
            full_text="",
            latency_ms=0,
            defect_type="GEMINI_GATE_NO_API_KEY",
            detail="Set GEMINI_API_KEY in edge/.env or environment",
        )

    cfg_path = resolve_silk_gate_config_path()
    try:
        cfg = load_gate_config(cfg_path)
    except (OSError, ValueError, json.JSONDecodeError) as e:
        logger.error("[Gemini게이트] 설정 로드 실패: %s", e)
        return GeminiGateOutcome(
            ok=False,
            full_text="",
            latency_ms=0,
            defect_type="GEMINI_GATE_CONFIG_ERROR",
            detail=str(e),
        )

    try:
        q = int(getattr(settings, "GEMINI_GATE_JPEG_QUALITY", 92))
        q = max(50, min(100, q))
        ok_img, buf = cv2.imencode(".jpg", bgr_frame, [cv2.IMWRITE_JPEG_QUALITY, q])
        if not ok_img:
            raise RuntimeError("JPEG 인코딩 실패")
        jpeg = bytes(buf)
        model = str(getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash")).strip()
        extra_retries = max(0, int(getattr(settings, "GEMINI_GATE_HTTP_RETRIES", 2)))
        full_text = ""
        ms = 0
        for attempt in range(extra_retries + 1):
            try:
                full_text, ms = _generate_content_text(jpeg, api_key, model)
                break
            except RuntimeError as e:
                if attempt < extra_retries and _is_transient_gemini_transport_error(e):
                    delay = min(30.0, 2.0**attempt)
                    logger.warning(
                        "[Gemini게이트] API 일시 오류 (%s) — %.0fs 후 재시도 [%d/%d]",
                        e,
                        delay,
                        attempt + 2,
                        extra_retries + 1,
                    )
                    time.sleep(delay)
                    continue
                raise
            except Exception as e:
                if attempt < extra_retries and _is_transient_gemini_transport_error(e):
                    delay = min(30.0, 2.0**attempt)
                    logger.warning(
                        "[Gemini게이트] 전송 예외 (%s) — %.0fs 후 재시도 [%d/%d]",
                        e,
                        delay,
                        attempt + 2,
                        extra_retries + 1,
                    )
                    time.sleep(delay)
                    continue
                raise

    except RuntimeError as e:
        logger.warning("[Gemini게이트] API 오류: %s", e)
        return GeminiGateOutcome(
            ok=False,
            full_text="",
            latency_ms=0,
            defect_type="GEMINI_OCR_GATE_SERVICE_ERROR",
            detail=str(e),
        )
    except Exception as e:
        logger.warning("[Gemini게이트] 예외: %s", e, exc_info=True)
        return GeminiGateOutcome(
            ok=False,
            full_text="",
            latency_ms=0,
            defect_type="GEMINI_OCR_GATE_SERVICE_ERROR",
            detail=str(e),
        )

    ok_rule, hint = evaluate_gate(full_text, cfg)
    snippet = full_text.replace("\n", " ")[:200]
    logger.info("[Gemini게이트] %d ms, 규칙=%s (%s)", ms, ok_rule, snippet)

    if not ok_rule:
        return GeminiGateOutcome(
            ok=False,
            full_text=full_text,
            latency_ms=ms,
            defect_type="GEMINI_OCR_GATE_FAIL",
            detail=hint,
        )

    return GeminiGateOutcome(ok=True, full_text=full_text, latency_ms=ms)
