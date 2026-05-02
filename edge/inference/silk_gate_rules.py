"""
실크 검증 JSON 규칙(shared): required_substrings, required_regexes, OCR 라우트용 경로 헬퍼.

Gemini 실크 게이트·board_ocr_router 에서 공통 사용.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional

from config.settings import settings

_EDGE_ROOT = Path(__file__).resolve().parent.parent


def resolve_silk_gate_config_path() -> Path:
    p = getattr(settings, "BOARD_SILK_GATE_CONFIG_PATH", None) or "config/vision_board_gate.json"
    pl = Path(str(p))
    if pl.is_absolute():
        return pl
    return (_EDGE_ROOT / pl).resolve()


def _normalize(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def load_gate_config(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(f"silk gate config not found: {path}")
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("silk gate config must be a JSON object")
    subs = raw.get("required_substrings") or []
    regs = raw.get("required_regexes") or []
    if not isinstance(subs, list) or not isinstance(regs, list):
        raise ValueError("required_substrings / required_regexes must be arrays")
    return {
        "required_substrings": [str(x) for x in subs if str(x).strip()],
        "required_regexes": [str(x) for x in regs if str(x).strip()],
        "normalize_before_substrings": bool(raw.get("normalize_before_substrings", True)),
    }


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
