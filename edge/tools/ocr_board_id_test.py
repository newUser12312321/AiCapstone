"""
PCB 기판명(silkscreen) OCR 실험 스크립트 - 검사 파이프라인과 분리.

현재 운영 로직은 main._select_board_type() 의 YOLO 클래스 매칭이다.
OCR로 교체하기 전에 동일 이미지로 후보 엔진·전처리 조합을 비교한다.

설치 (한 번):
    cd edge
    pip install -r requirements-ocr.txt

예시:
    python tools/ocr_board_id_test.py --image demo_samples/sample.jpg --backend paddle --preprocess clahe_upscale
    python tools/ocr_board_id_test.py --dir captures --glob "*.jpg" --backend paddle --match-profiles config/board_profiles.json

백엔드가 없으면 안내 후 종료한다. Tesseract/EasyOCR은 PCB 실크에서 자주 실패하므로
PaddleOCR + ROI·전처리(대비·확대) 조합을 우선 시험하는 것을 권장한다.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Optional

import cv2
import numpy as np

_EDGE_ROOT = Path(__file__).resolve().parent.parent


def _normalize_label(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[\s_\-]+", "", s)
    return s


def preprocess(
    bgr: np.ndarray,
    mode: str,
    roi_norm: Optional[tuple[float, float, float, float]] = None,
) -> np.ndarray:
    """
    roi_norm: (x0,y0,x1,y1) 비율 0~1, 실크 영역만 잘라 OCR 안정화에 사용.
    """
    img = bgr
    if roi_norm is not None:
        h, w = img.shape[:2]
        x0, y0, x1, y1 = roi_norm
        xi0, yi0 = int(w * x0), int(h * y0)
        xi1, yi1 = int(w * x1), int(h * y1)
        xi0, xi1 = max(0, xi0), min(w, xi1)
        yi0, yi1 = max(0, yi0), min(h, yi1)
        if xi1 > xi0 and yi1 > yi0:
            img = img[yi0:yi1, xi0:xi1]

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    if mode == "none":
        out = gray
    elif mode == "clahe":
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        out = clahe.apply(gray)
    elif mode == "adaptive":
        blur = cv2.GaussianBlur(gray, (3, 3), 0)
        out = cv2.adaptiveThreshold(
            blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 10
        )
    elif mode == "clahe_upscale":
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        cl = clahe.apply(gray)
        out = cv2.resize(cl, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    elif mode == "unsharp_clahe":
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        cl = clahe.apply(gray)
        blur = cv2.GaussianBlur(cl, (0, 0), sigmaX=1.2)
        out = cv2.addWeighted(cl, 1.5, blur, -0.5, 0)
    else:
        raise ValueError(f"unknown preprocess mode: {mode}")

    # Paddle 등은 RGB 3채널을 기대하는 경우가 많음
    return cv2.cvtColor(out, cv2.COLOR_GRAY2BGR)


def build_paddle_reader():
    try:
        from paddleocr import PaddleOCR  # type: ignore
    except ImportError as e:
        raise RuntimeError("paddleocr 미설치: pip install -r requirements-ocr.txt") from e

    # PaddleOCR 3.x: 기본 파이프라인(lang만). show_log 등 예전 인자는 미지원.
    try:
        return PaddleOCR(lang="en")
    except Exception:
        return PaddleOCR(use_angle_cls=True, lang="en")


def run_paddleocr(ocr: Any, rgb: np.ndarray) -> list[tuple[str, float]]:
    lines: list[tuple[str, float]] = []
    predict_fn = getattr(ocr, "predict", None) or getattr(ocr, "ocr", None)
    if predict_fn is None:
        return lines
    raw = predict_fn(rgb)

    # PaddleOCR 2.x: [ [ [box,(text,conf)], ... ] ]
    if raw and isinstance(raw[0], list) and raw[0] and len(raw[0]) >= 2:
        first = raw[0][0]
        if isinstance(first, (list, tuple)) and len(first) >= 2:
            if isinstance(first[1], (list, tuple)) and len(first[1]) >= 2:
                for item in raw[0]:
                    if item is None or len(item) < 2:
                        continue
                    _box, pair = item[0], item[1]
                    text, conf = pair[0], pair[1]
                    try:
                        c = float(conf)
                    except (TypeError, ValueError):
                        c = 0.0
                    lines.append((str(text).strip(), c))
                return lines

    # PaddleOCR 3.x / PaddleX: 결과가 dict 또는 객체인 경우
    for block in raw or []:
        if isinstance(block, dict):
            texts = block.get("rec_texts") or block.get("texts") or []
            scores = block.get("rec_scores") or block.get("scores") or []
            for i, t in enumerate(texts):
                sc = float(scores[i]) if i < len(scores) else 0.0
                lines.append((str(t).strip(), sc))
        elif hasattr(block, "rec_texts"):
            texts = getattr(block, "rec_texts", []) or []
            scores = getattr(block, "rec_scores", []) or []
            for i, t in enumerate(texts):
                sc = float(scores[i]) if i < len(scores) else 0.0
                lines.append((str(t).strip(), sc))
    return lines


def build_easy_reader():
    try:
        import easyocr  # type: ignore
    except ImportError as e:
        raise RuntimeError("easyocr 미설치") from e

    return easyocr.Reader(["en"], gpu=False, verbose=False)


def run_easyocr(reader: Any, rgb: np.ndarray) -> list[tuple[str, float]]:
    # RGB
    result = reader.readtext(rgb)
    out: list[tuple[str, float]] = []
    for _bbox, text, conf in result:
        out.append((str(text).strip(), float(conf)))
    return out


def run_tesseract(bgr: np.ndarray) -> list[tuple[str, float]]:
    try:
        import pytesseract  # type: ignore
    except ImportError as e:
        raise RuntimeError("pytesseract 미설치") from e

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    config = "--oem 3 --psm 6"
    text = pytesseract.image_to_string(gray, config=config)
    conf_data = pytesseract.image_to_data(gray, config=config, output_type=pytesseract.Output.DICT)
    scores = [int(c) for c in conf_data.get("conf", []) if str(c).lstrip("-").isdigit()]
    avg_conf = (sum(scores) / len(scores) / 100.0) if scores else 0.0
    blob = " ".join(text.split())
    return [(blob, avg_conf)] if blob else []


def match_profiles(ocr_lines: list[tuple[str, float]], profiles_path: Path) -> list[tuple[str, float, str]]:
    """프로파일 키와 OCR 라인 유사도: (키, 점수, 매칭된 OCR 텍스트)."""
    raw = json.loads(profiles_path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        return []
    keys = list(raw.keys())
    scored: list[tuple[str, float, str]] = []
    joined = " ".join(t for t, _ in ocr_lines)
    joined_n = _normalize_label(joined)

    for key in keys:
        kn = _normalize_label(key)
        best = 0.0
        best_txt = ""
        for txt, conf in ocr_lines:
            tn = _normalize_label(txt)
            if not kn:
                continue
            if kn in tn:
                score = float(conf) * 1.1
            elif kn in joined_n:
                score = float(conf)
            elif tn and tn in kn:
                score = float(conf) * 0.9
            else:
                score = 0.0
            if score > best:
                best = score
                best_txt = txt
        if best > 0:
            scored.append((key, best, best_txt))

    scored.sort(key=lambda x: -x[1])
    return scored


def main() -> int:
    parser = argparse.ArgumentParser(description="PCB 기판명 OCR 오프라인 테스트")
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--image", type=Path, help="단일 이미지 경로")
    src.add_argument("--dir", type=Path, help="디렉터리")
    parser.add_argument("--glob", default="*.jpg", help="--dir 과 함께 사용")
    parser.add_argument(
        "--backend",
        choices=("paddle", "easyocr", "tesseract"),
        default="paddle",
        help="OCR 엔진",
    )
    parser.add_argument(
        "--preprocess",
        choices=("none", "clahe", "adaptive", "clahe_upscale", "unsharp_clahe"),
        default="clahe_upscale",
        help="전처리 파이프라인",
    )
    parser.add_argument(
        "--roi",
        nargs=4,
        type=float,
        metavar=("X0", "Y0", "X1", "Y1"),
        default=None,
        help="ROI 정규화 좌표 0~1 (예: 실크가 우상단이면 0.55 0 1 0.35)",
    )
    parser.add_argument(
        "--match-profiles",
        type=Path,
        default=None,
        help="board_profiles.json 경로, OCR 결과와 보드 키 매칭 점수 출력",
    )
    args = parser.parse_args()

    roi_tuple: Optional[tuple[float, float, float, float]] = None
    if args.roi is not None:
        roi_tuple = (args.roi[0], args.roi[1], args.roi[2], args.roi[3])

    images: list[Path] = []
    if args.image:
        images = [args.image.resolve()]
    else:
        g = args.glob
        images = sorted(args.dir.expanduser().resolve().glob(g))

    if not images:
        print("이미지가 없습니다.", file=sys.stderr)
        return 1

    paddle_ocr = easy_reader = None
    try:
        if args.backend == "paddle":
            paddle_ocr = build_paddle_reader()
        elif args.backend == "easyocr":
            easy_reader = build_easy_reader()
    except RuntimeError as e:
        print(e, file=sys.stderr)
        return 2

    def run_backend(bgr_proc: np.ndarray) -> list[tuple[str, float]]:
        rgb = cv2.cvtColor(bgr_proc, cv2.COLOR_BGR2RGB)
        if args.backend == "paddle":
            assert paddle_ocr is not None
            return run_paddleocr(paddle_ocr, rgb)
        if args.backend == "easyocr":
            assert easy_reader is not None
            return run_easyocr(easy_reader, rgb)
        return run_tesseract(bgr_proc)

    for path in images:
        if not path.is_file():
            print(f"[skip] 없음: {path}", file=sys.stderr)
            continue
        bgr = cv2.imread(str(path))
        if bgr is None:
            print(f"[skip] 읽기 실패: {path}", file=sys.stderr)
            continue

        proc = preprocess(bgr, args.preprocess, roi_tuple)
        lines = run_backend(proc)

        print(f"\n=== {path.name} ===")
        for txt, conf in lines:
            print(f"  {conf:.3f}  {txt!r}")

        mp = args.match_profiles
        if mp:
            p = mp if mp.is_absolute() else (_EDGE_ROOT / mp).resolve()
            if p.exists():
                ranked = match_profiles(lines, p)
                if ranked:
                    print("  [profile match]")
                    for key, sc, hit in ranked[:5]:
                        print(f"    {key}: score={sc:.3f} (via {hit!r})")
                else:
                    print("  [profile match] 없음 - OCR 문자열을 profiles 키와 맞춰 보정 필요")
            else:
                print(f"  [warn] profiles 없음: {p}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
