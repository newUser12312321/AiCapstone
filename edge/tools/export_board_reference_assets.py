"""
대시보드용 정적 오버레이 JPEG 생성 → frontend/public/board-reference/

  cd edge
  python tools/export_board_reference_assets.py

로컬에 GT125A/gn948x 원본·가중치가 있어야 하며, 클라우드 배포 전 재생성 시 사용한다.
"""

from __future__ import annotations

import sys
from pathlib import Path

_EDGE_ROOT = Path(__file__).resolve().parent.parent
if str(_EDGE_ROOT) not in sys.path:
    sys.path.insert(0, str(_EDGE_ROOT))

from api.board_reference_overlay import render_board_reference_overlay_jpeg  # noqa: E402


def main() -> int:
    repo = _EDGE_ROOT.parent
    out_dir = repo / "frontend" / "public" / "board-reference"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "gt125a_overlay.jpg").write_bytes(render_board_reference_overlay_jpeg("GT_125A"))
    (out_dir / "gn948x_overlay.jpg").write_bytes(render_board_reference_overlay_jpeg("GN_948X"))
    print(f"[OK] {out_dir}/gt125a_overlay.jpg, gn948x_overlay.jpg")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
