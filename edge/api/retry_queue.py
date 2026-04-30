"""
로컬 재전송 큐(SQLite)

네트워크 단절 시 검사 결과 payload를 로컬 DB에 적재하고,
연결 복구 시 sender가 순차 재전송한다.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any


class LocalRetryQueue:
    """검사 결과 재전송용 SQLite 큐."""

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self._lock = threading.Lock()
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self._db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS inspection_retry_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    payload_json TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    last_error TEXT
                )
                """
            )
            conn.commit()

    def enqueue(self, payload: dict[str, Any], last_error: str | None = None) -> int:
        payload_json = json.dumps(payload, ensure_ascii=False)
        with self._lock, self._connect() as conn:
            cur = conn.execute(
                "INSERT INTO inspection_retry_queue (payload_json, last_error) VALUES (?, ?)",
                (payload_json, last_error),
            )
            conn.commit()
            return int(cur.lastrowid)

    def get_batch(self, limit: int = 20) -> list[dict[str, Any]]:
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                "SELECT id, payload_json FROM inspection_retry_queue ORDER BY id ASC LIMIT ?",
                (limit,),
            ).fetchall()
        out: list[dict[str, Any]] = []
        for row in rows:
            out.append(
                {
                    "id": int(row["id"]),
                    "payload": json.loads(row["payload_json"]),
                }
            )
        return out

    def mark_sent(self, row_id: int) -> None:
        with self._lock, self._connect() as conn:
            conn.execute("DELETE FROM inspection_retry_queue WHERE id = ?", (row_id,))
            conn.commit()

    def count(self) -> int:
        with self._lock, self._connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS c FROM inspection_retry_queue").fetchone()
        return int(row["c"] if row else 0)
