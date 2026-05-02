"""
Gemini 실크 OCR 전체 텍스트에서 UI·이력 표시용 필드 추출.

설정은 BOARD_SILK_GATE_CONFIG_PATH(JSON) 의 silk_field_extract 섹션.
없거나 비면 기본 패턴으로 G-SERIES / GT-* / CREVIS / YYYY.MM.DD 를 시도한다.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from inference.silk_gate_rules import resolve_silk_gate_config_path

logger = logging.getLogger(__name__)

_DEFAULT_SERIES_SUBS = ["G-SERIES"]
_DEFAULT_BOARD_RE = r"(GT-\d+[A-Z]+)"
_DEFAULT_MFG_SUBS = ["CREVIS"]
_DEFAULT_DATE_RE = r"\d{4}\.\d{2}\.\d{2}"


@dataclass(frozen=True)
class SilkDisplayFields:
    series_name: Optional[str]
    board_name: Optional[str]
    manufacturer: Optional[str]
    manufacture_date: Optional[str]


def _first_needle_preserving_case(hay_raw: str, needles: list[str]) -> Optional[str]:
    """대소문자 무시 검색 후 원문 슬라이스(실크 문자열 형태 유지)."""
    low = hay_raw.lower()
    for n in needles:
        n_strip = str(n).strip()
        if not n_strip:
            continue
        j = low.find(n_strip.lower())
        if j >= 0:
            return hay_raw[j : j + len(n_strip)]
    return None


def _load_extract_cfg(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(raw, dict):
        return {}
    ex = raw.get("silk_field_extract")
    return ex if isinstance(ex, dict) else {}


def extract_silk_display_fields(full_text: str) -> SilkDisplayFields:
    """
    full_text 예:
      "A G-SERIES GT-125A/126A(DI32), rev... CREVIS 2024.04.18 ..." → 기판명은 GT-125A만 추출
    """
    text = (full_text or "").strip()
    if not text:
        return SilkDisplayFields(None, None, None, None)

    cfg_path = resolve_silk_gate_config_path()
    cfg = _load_extract_cfg(cfg_path)

    series_list = cfg.get("series_substrings")
    if not isinstance(series_list, list):
        series_list = _DEFAULT_SERIES_SUBS
    series_needles = [str(x).strip() for x in series_list if str(x).strip()]

    mfg_list = cfg.get("manufacturer_substrings")
    if not isinstance(mfg_list, list):
        mfg_list = _DEFAULT_MFG_SUBS
    mfg_needles = [str(x).strip() for x in mfg_list if str(x).strip()]

    board_re_s = cfg.get("board_regex")
    board_pattern = (
        str(board_re_s).strip()
        if isinstance(board_re_s, str) and str(board_re_s).strip()
        else _DEFAULT_BOARD_RE
    )

    date_re_s = cfg.get("manufacture_date_regex")
    date_pattern = (
        str(date_re_s).strip()
        if isinstance(date_re_s, str) and str(date_re_s).strip()
        else _DEFAULT_DATE_RE
    )

    series = _first_needle_preserving_case(text, series_needles)
    manufacturer = _first_needle_preserving_case(text, mfg_needles)

    board_name: Optional[str] = None
    try:
        bm = re.search(board_pattern, text, re.IGNORECASE)
        if bm:
            gs = bm.groups()
            raw = bm.group(1).strip() if gs and bm.group(1) is not None else bm.group(0).strip()
            board_name = raw
    except re.error as e:
        logger.warning("[실크추출] board_regex 무효, 기본 사용: %s", e)

    manufacture_date: Optional[str] = None
    try:
        dm = re.search(date_pattern, text)
        if dm:
            manufacture_date = dm.group(0).strip()
    except re.error as e:
        logger.warning("[실크추출] manufacture_date_regex 무효: %s", e)

    return SilkDisplayFields(
        series_name=series or None,
        board_name=board_name or None,
        manufacturer=manufacturer or None,
        manufacture_date=manufacture_date or None,
    )


def _nonblank(x: Optional[str]) -> bool:
    return bool(x and str(x).strip())


def silk_display_fields_complete(sf: SilkDisplayFields) -> bool:
    """시리즈·기판명·제조사·제조일 4항 모두 문자열 검출되어야 True."""
    return (
        _nonblank(sf.series_name)
        and _nonblank(sf.board_name)
        and _nonblank(sf.manufacturer)
        and _nonblank(sf.manufacture_date)
    )


def silk_missing_field_summary_ko(sf: SilkDisplayFields) -> str:
    """실크 OCR 4필드 중 비어 있는 항목만 한글로 나열한다."""
    parts: list[str] = []
    if not _nonblank(sf.series_name):
        parts.append("시리즈명")
    if not _nonblank(sf.board_name):
        parts.append("기판명")
    if not _nonblank(sf.manufacturer):
        parts.append("제조사명")
    if not _nonblank(sf.manufacture_date):
        parts.append("제조일자")
    if not parts:
        return ""
    joined = ", ".join(parts)
    return f"{joined} 실크 미검출"
