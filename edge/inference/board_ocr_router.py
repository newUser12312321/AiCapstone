"""
Gemini 실크 OCR로 얻은 전체 텍스트에서 board_profiles 키로 라우팅한다.

설정 JSON: BOARD_SILK_GATE_CONFIG_PATH (기본 vision_board_gate.json) 내
  "board_route_substrings": { "G_SERIES": ["gt-125a", ...], ... }
키는 board_profiles.json 최상위 키와 일치해야 한다.

매칭은 silk_gate_rules._normalize 과 동일 규칙(소문자·공백 정리) 부분 문자열 포함.
여러 키가 맞으면 **가장 긴 needle**이 이긴다(동률이면 JSON에 먼저 나온 보드 키).
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from config.settings import settings
from inference.silk_gate_rules import _normalize, resolve_silk_gate_config_path

logger = logging.getLogger(__name__)


def _load_board_route_map_raw() -> dict[str, list[str]]:
    path = resolve_silk_gate_config_path()
    if not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(raw, dict):
        return {}
    br = raw.get("board_route_substrings")
    if not isinstance(br, dict):
        return {}
    out: dict[str, list[str]] = {}
    for k, v in br.items():
        key = str(k).strip()
        if not key:
            continue
        if isinstance(v, str):
            needles = [v.strip()] if v.strip() else []
        elif isinstance(v, list):
            needles = [str(x).strip() for x in v if str(x).strip()]
        else:
            needles = []
        if needles:
            out[key] = needles
    return out


_route_map_cache: Optional[tuple[str, dict[str, list[str]]]] = None


def get_board_route_map() -> dict[str, list[str]]:
    """config 경로 문자열이 바뀌면 캐시 무효화."""
    global _route_map_cache
    p = str(resolve_silk_gate_config_path())
    if _route_map_cache is None or _route_map_cache[0] != p:
        loaded = _load_board_route_map_raw()
        _route_map_cache = (p, loaded)
        if loaded:
            logger.info("[OCR라우트] board_route_substrings 로드: %s", list(loaded.keys()))
    return dict(_route_map_cache[1])


def resolve_board_type_from_ocr_text(full_text: str) -> tuple[Optional[str], str]:
    """
    Returns:
        (board_profiles 키 또는 None, 디버그 문자열)
    """
    if not getattr(settings, "BOARD_OCR_ROUTING_ENABLED", False):
        return None, "routing disabled"
    text = (full_text or "").strip()
    if not text:
        return None, "empty ocr text"

    route_map = get_board_route_map()
    if not route_map:
        return None, "no board_route_substrings in config"

    hay = _normalize(text)
    best_key: Optional[str] = None
    best_needle_len = -1

    for board_key, needles in route_map.items():
        for needle in needles:
            n = _normalize(needle)
            if not n:
                continue
            if n not in hay:
                continue
            ln = len(n)
            if ln > best_needle_len:
                best_needle_len = ln
                best_key = board_key

    if best_key:
        return (
            best_key,
            f"matched board_route_substrings needle len={best_needle_len} → {best_key!r}",
        )
    return None, "no board_route_substrings matched"
