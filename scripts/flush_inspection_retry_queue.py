#!/usr/bin/env python3
"""edge/data/inspection_retry_queue.db 에 쌓인 검사 결과를 VM으로 재전송."""

import sys
from pathlib import Path

EDGE_DIR = Path(__file__).resolve().parent.parent / "edge"
sys.path.insert(0, str(EDGE_DIR))

from api.sender import ServerSender  # noqa: E402
from config.settings import settings  # noqa: E402


def main() -> int:
    sender = ServerSender()
    before = sender._retry_queue.count()
    print(f"서버: {sender.endpoint} | 대기 {before}건")
    if before == 0:
        return 0
    sender.flush_retry_queue(batch_limit=max(before, 20))
    after = sender._retry_queue.count()
    print(f"done, remaining={after} (check firewall/VM if > 0)")
    return 0 if after == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
