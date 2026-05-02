"""
Gemini 멀티모달 1회 호출 테스트 (PC에서 키·네트워크·모델명 확인용).

설정:
  PowerShell 예:
    $env:GEMINI_API_KEY="AIza..."
    python tools/gemini_multimodal_smoke_test.py --image ..\\captures\\sample.jpg

모델이 404면 AI Studio 또는 https://ai.google.dev/gemini-api/docs/models 표기로 --model 지정:
    python tools/gemini_multimodal_smoke_test.py --image sample.jpg --model gemini-2.5-flash
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def _mime(path: Path) -> str:
    s = path.suffix.lower()
    if s in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if s == ".png":
        return "image/png"
    if s == ".webp":
        return "image/webp"
    raise SystemExit(f"지원 확장자: .jpg .jpeg .png .webp 인데 {path.suffix}")


def main() -> int:
    p = argparse.ArgumentParser(description="Gemini generateContent 단발 테스트")
    p.add_argument("--image", type=Path, required=True, help="PCB 이미지 파일")
    p.add_argument(
        "--model",
        default=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
        help="모델 ID (환경변수 GEMINI_MODEL 으로 기본 변경 가능)",
    )
    args = p.parse_args()

    key = os.environ.get("GEMINI_API_KEY") or ""
    if not key.strip():
        print("GEMINI_API_KEY 환경변수를 설정하세요.", file=sys.stderr)
        return 2

    img_path = args.image.expanduser().resolve()
    if not img_path.is_file():
        print(f"파일 없음: {img_path}", file=sys.stderr)
        return 2

    mime = _mime(img_path)
    img_b64 = base64.standard_b64encode(img_path.read_bytes()).decode("ascii")

    body = {
        "contents": [
            {
                "parts": [
                    {
                        "text": (
                            "This is a photo of a printed circuit board. "
                            "List every readable silkscreen text string you can see, "
                            "one per line in plain UTF-8. If unsure, omit."
                        ),
                    },
                    {"inline_data": {"mime_type": mime, "data": img_b64}},
                ]
            }
        ]
    }

    safe_model = args.model.strip()
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{safe_model}:generateContent"
        f"?key={urllib.parse.quote(key)}"
    )
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        print(f"HTTP {e.code} {e.reason}", file=sys.stderr)
        print(err_body, file=sys.stderr)
        return 3
    except OSError as e:
        print(f"요청 실패: {e}", file=sys.stderr)
        return 3

    if "error" in raw:
        print(json.dumps(raw["error"], indent=2, ensure_ascii=False), file=sys.stderr)
        return 3

    try:
        text = raw["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as exc:
        print(json.dumps(raw, indent=2, ensure_ascii=False), file=sys.stderr)
        print(f"응답 파싱 실패: {exc}", file=sys.stderr)
        return 4

    print("=== Gemini 응답 텍스트 ===")
    print(text)
    print("=== RAW usage (있을 때만) ===")
    um = raw.get("usageMetadata")
    if um:
        print(json.dumps(um, indent=2, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
