"""
엣지 디바이스 전역 설정 모듈

pydantic-settings를 사용하여 .env 파일 또는 OS 환경변수에서
설정값을 자동으로 로드하고 타입을 검증한다.

사용법:
    from config.settings import settings
    print(settings.SERVER_BASE_URL)
"""

from pathlib import Path
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# edge/config/ → edge/.env (CWD와 무관하게 항상 이 파일을 읽음)
_EDGE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """
    애플리케이션 전체에서 사용하는 설정값 클래스.
    .env 파일이 있으면 우선 적용하고, 없으면 아래 default 값을 사용한다.
    """

    # ── 중앙 서버 연결 정보 ──────────────────────────────────────────────────
    # Spring Boot 서버 주소 (같은 LAN 내 IP 또는 hostname)
    SERVER_BASE_URL: str = Field(default="http://192.168.0.10:8080")
    # 검사 결과 업로드 API 경로 (v1 고정)
    SERVER_INSPECTION_API_PATH: str = Field(default="/api/v1/inspections")
    # 전송 실패 시 로컬 SQLite 큐 파일 경로 (edge 기준 상대경로 허용)
    EDGE_RETRY_QUEUE_DB_PATH: str = Field(default="data/inspection_retry_queue.db")
    # True면 이미지 파일을 Base64로 함께 전송해 클라우드에서 원본 확인 가능
    SEND_IMAGE_BASE64_TO_CLOUD: bool = Field(default=True)

    # ── 카메라 설정 ──────────────────────────────────────────────────────────
    # /dev/video0 → 0, C922가 video1·video2만 있으면 1 또는 2
    CAMERA_DEVICE_INDEX: int = Field(default=0)
    CAMERA_WIDTH: int = Field(default=1920)
    CAMERA_HEIGHT: int = Field(default=1080)
    # False: 예전 기본과 동일 — 오토포커스 끄고 focus_absolute만 사용(거리 고정 스테이션에 맞으면 유지)
    # True: 거리가 자주 바뀔 때 v4l2 오토포커스
    CAMERA_FOCUS_AUTO: bool = Field(default=False)
    # 수동 초점일 때만 사용 (0~255). 과거 하드코드 30과 동일 기본값
    CAMERA_FOCUS_ABSOLUTE: int = Field(default=30, ge=0, le=255)
    # USB 재연결·전원 리셋 후 펌웨어가 focus_absolute 한 번만으로는 안 먹는 경우가 있어 재적용
    CAMERA_FOCUS_MANUAL_DOUBLE_APPLY: bool = Field(default=True)
    CAMERA_FOCUS_MANUAL_REAPPLY_DELAY_SEC: float = Field(default=0.25, ge=0.0, le=2.0)
    # 수동 모드에서도 0보다 크면: 연속 AF를 이 시간(ms)만 돌린 뒤 AF 끄고 focus_absolute 적용 (재연결 후 흐림 완화)
    CAMERA_FOCUS_POST_PLUG_AF_MS: int = Field(default=0, ge=0, le=10000)
    # 캘리브레이션(npz) 로딩 및 라이브 캡처 시 undistort 적용 여부 (.env 에서 false 가능)
    CAMERA_CALIBRATION_ENABLED: bool = Field(default=True)
    # npz 키: camera_matrix, dist_coeffs 를 포함해야 함
    CAMERA_CALIBRATION_FILE: str = Field(default="config/camera_calibration_c922_1920x1080.npz")
    # getOptimalNewCameraMatrix alpha (0.0~1.0)
    CAMERA_CALIBRATION_ALPHA: float = Field(default=1.0, ge=0.0, le=1.0)
    # True면 undistort 후 ROI로 검은 테두리를 제거
    CAMERA_CALIBRATION_CROP_ROI: bool = Field(default=False)

    # ── YOLO 추론 설정 ───────────────────────────────────────────────────────
    # 단일 통합 모델 (best.pt) 사용
    YOLO_WEIGHTS_PATH: str = Field(default="weights/best.pt")

    # 이 값 이상의 confidence (Stage 전용 값이 없을 때 피듀셜·결함 공통 기본)
    YOLO_CONFIDENCE_THRESHOLD: float = Field(default=0.5, ge=0.0, le=1.0)

    # Stage별 덮어쓰기 — None이면 YOLO_CONFIDENCE_THRESHOLD 사용
    # 피듀셜은 낮게(0.25~0.4) 권장
    YOLO_FIDUCIAL_CONFIDENCE_THRESHOLD: Optional[float] = Field(default=None)
    # Stage 2(다클래스 PCB): 0.5면 약한 클래스 누락 다수 — 0.15~0.25 권장
    YOLO_DEFECT_CONFIDENCE_THRESHOLD: Optional[float] = Field(default=0.15)

    # predict() 입력 크기 — 학습 imgsz 와 맞출 것 (1024 학습 시 640 추론이면 탐지 수 급감)
    YOLO_PREDICT_IMGSZ: int = Field(default=1024, ge=320, le=1280)
    # True: TTA(증강 추론) — 약한 클래스 재현율 소폭↑, 추론 시간↑
    YOLO_PREDICT_AUGMENT: bool = Field(default=False)

    # True: Stage 2를 피듀셜 사이 좁은 ROI가 아니라 정합(또는 raw) **전체 프레임**에 수행.
    # PCB 다클래스(mount_hole, gold_finger_row 등)는 ROI 밖이 대부분이라 True 권장.
    DEFECT_INFER_ON_FULL_DESKEW: bool = Field(default=True)
    # Stage 2 입력 소스:
    # - "aligned": Stage1 좌표 정합 후 이미지 기준(권장)
    # - "deskew": 하위 호환 alias (내부적으로 aligned와 동일 처리)
    # - "raw": Stage1 보정 전 원본 이미지 기준
    STAGE2_SOURCE_MODE: str = Field(default="aligned")

    # ── 좌표 정합(Similarity: translation/rotation/scale) ────────────────────
    # 정합 기준 피듀셜 좌표 (정합 결과 이미지 좌표계)
    ALIGN_REF_FIDUCIAL1_X: int = Field(default=278, ge=0)
    ALIGN_REF_FIDUCIAL1_Y: int = Field(default=908, ge=0)
    ALIGN_REF_FIDUCIAL2_X: int = Field(default=1528, ge=0)
    ALIGN_REF_FIDUCIAL2_Y: int = Field(default=202, ge=0)
    # GN_948X 멀티보드 선택 시에만 사용 (ALIGN_REF_* 는 그 외 보드·미확정 시)
    ALIGN_REF_GN_948X_FIDUCIAL1_X: int = Field(default=278, ge=0)
    ALIGN_REF_GN_948X_FIDUCIAL1_Y: int = Field(default=908, ge=0)
    ALIGN_REF_GN_948X_FIDUCIAL2_X: int = Field(default=1528, ge=0)
    ALIGN_REF_GN_948X_FIDUCIAL2_Y: int = Field(default=202, ge=0)
    # 정합 출력 캔버스 크기
    ALIGN_OUTPUT_WIDTH: int = Field(default=1920, ge=320, le=4096)
    ALIGN_OUTPUT_HEIGHT: int = Field(default=1080, ge=240, le=4096)

    # True(기본): YOLO가 1건이라도 잡으면 FAIL (단선/까짐 전용 모델).
    # False: 정렬 성공 시 PASS — 탐지 박스는 그대로 서버·대시보드에 보냄(부품 검출·표시용).
    FAIL_ON_ANY_YOLO_DETECTION: bool = Field(default=True)

    # ── 멀티보드 라우팅 설정 ──────────────────────────────────────────────────
    MULTI_BOARD_ENABLED: bool = Field(default=False)
    # 보드 식별용 모델 (board-name-zone 클래스 탐지 전용, 기본은 현재 best.pt)
    BOARD_ID_WEIGHTS_PATH: str = Field(default="weights/best.pt")
    # 보드 프로파일(JSON) 파일 경로. edge/ 기준 상대 경로 허용.
    BOARD_PROFILES_PATH: str = Field(default="config/board_profiles.json")
    BOARD_ID_MIN_CONFIDENCE: float = Field(default=0.4, ge=0.0, le=1.0)
    # False(기본): 멀티보드 시 board_id 전용 가중치로 식별하지 않음 → OCR 라우팅·fallback 만 사용.
    BOARD_IDENTIFIER_YOLO_ENABLED: bool = Field(default=False)
    # unknown 처리 정책: abort | fallback_default
    BOARD_UNKNOWN_POLICY: str = Field(default="abort")
    # fallback_default 정책에서 사용할 기본 보드 타입 키
    DEFAULT_BOARD_TYPE: Optional[str] = Field(default=None)

    # ── 실크 검증 JSON (required_substrings, board_route 등). edge/ 기준 상대 경로 허용.
    BOARD_SILK_GATE_CONFIG_PATH: str = Field(default="config/vision_board_gate.json")
    # True면 MULTI_BOARD_ENABLED 일 때만 실크 Gemini 게이트 실행. False면 단일·멀티 모두 게이트 실행 가능.
    BOARD_SILK_GATE_REQUIRE_MULTIBOARD: bool = Field(default=False)

    # ── Gemini API — 실크 OCR 게이트 ────────────────────────────────────────
    GEMINI_GATE_ENABLED: bool = Field(default=True)
    GEMINI_API_KEY: Optional[str] = Field(
        default=None,
        description="AI Studio Gemini API 키 — .env GEMINI_API_KEY",
    )
    GEMINI_MODEL: str = Field(default="gemini-2.5-flash")
    GEMINI_GATE_JPEG_QUALITY: int = Field(default=92, ge=50, le=100)
    # 소켓 타임아웃·일시적 5xx 등에 대해 추가 시도 횟수(0이면 1회만).
    # generateContent HTTP 타임아웃은 gemini_silk_gate 에서 120초 고정.
    GEMINI_GATE_HTTP_RETRIES: int = Field(default=2, ge=0, le=6)

    # 멀티보드 시 BOARD_SILK_GATE JSON 의 board_route_substrings 로 OCR→보드 키 (YOLO보다 우선)
    BOARD_OCR_ROUTING_ENABLED: bool = Field(default=True)

    # ── FastAPI 서버 포트 ────────────────────────────────────────────────────
    EDGE_API_PORT: int = Field(default=8000)

    # ── 실행 환경 ────────────────────────────────────────────────────────────
    # "production": 실제 라즈베리파이에서 GPIO/YOLO 실제 동작
    # "development": 개발 PC에서 더미 데이터로 동작
    ENVIRONMENT: str = Field(default="development")

    # ── 정렬 / 각도 보정 ───────────────────────────────────────────────────────
    # 피듀셜 2개로 측정한 기울기가 이 각도(°)를 넘으면 FAIL (오탐·이상 배치로 간주, 보정 안 함)
    MAX_DESKEW_ANGLE_DEG: float = Field(default=45.0)
    # 이보다 작으면 회전 보정 생략 (미세 보간 노이즈 감소)
    MIN_DESKEW_ANGLE_DEG: float = Field(default=0.05)
    # 하위 호환·문서용: 과거 "허용 오차 초과 시 FAIL" 모드에서 사용. 파이프라인은 MAX_DESKEW_* 기준.
    MAX_ANGLE_ERROR_DEG: float = Field(default=3.0)

    @field_validator("YOLO_FIDUCIAL_CONFIDENCE_THRESHOLD", "YOLO_DEFECT_CONFIDENCE_THRESHOLD", mode="before")
    @classmethod
    def _empty_conf_to_none(cls, v: object) -> object:
        if v is None or v == "":
            return None
        return v

    @field_validator("YOLO_FIDUCIAL_CONFIDENCE_THRESHOLD", "YOLO_DEFECT_CONFIDENCE_THRESHOLD")
    @classmethod
    def _stage_conf_range(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return None
        if not 0.0 <= float(v) <= 1.0:
            raise ValueError("Stage confidence must be between 0.0 and 1.0")
        return float(v)

    def effective_fiducial_confidence(self) -> float:
        if self.YOLO_FIDUCIAL_CONFIDENCE_THRESHOLD is not None:
            return float(self.YOLO_FIDUCIAL_CONFIDENCE_THRESHOLD)
        return float(self.YOLO_CONFIDENCE_THRESHOLD)

    def effective_defect_confidence(self) -> float:
        if self.YOLO_DEFECT_CONFIDENCE_THRESHOLD is not None:
            return float(self.YOLO_DEFECT_CONFIDENCE_THRESHOLD)
        return float(self.YOLO_CONFIDENCE_THRESHOLD)

    def alignment_reference_fiducials(
        self,
        board_type: Optional[str],
    ) -> tuple[tuple[int, int], tuple[int, int]]:
        """
        좌표 정합 목표 F1/F2 (픽셀).
        멀티보드에서 board_type 이 GN_948X 일 때만 전용 좌표를 쓴다.
        """
        if (board_type or "").strip() == "GN_948X":
            return (
                (self.ALIGN_REF_GN_948X_FIDUCIAL1_X, self.ALIGN_REF_GN_948X_FIDUCIAL1_Y),
                (self.ALIGN_REF_GN_948X_FIDUCIAL2_X, self.ALIGN_REF_GN_948X_FIDUCIAL2_Y),
            )
        return (
            (self.ALIGN_REF_FIDUCIAL1_X, self.ALIGN_REF_FIDUCIAL1_Y),
            (self.ALIGN_REF_FIDUCIAL2_X, self.ALIGN_REF_FIDUCIAL2_Y),
        )

    @field_validator("STAGE2_SOURCE_MODE")
    @classmethod
    def _validate_stage2_source_mode(cls, v: str) -> str:
        mode = (v or "").strip().lower()
        if mode not in {"raw", "deskew", "aligned"}:
            raise ValueError("STAGE2_SOURCE_MODE must be 'raw', 'deskew', or 'aligned'")
        if mode == "deskew":
            return "aligned"
        return mode

    @field_validator("BOARD_UNKNOWN_POLICY")
    @classmethod
    def _validate_board_unknown_policy(cls, v: str) -> str:
        policy = (v or "").strip().lower()
        if policy not in {"abort", "fallback_default"}:
            raise ValueError("BOARD_UNKNOWN_POLICY must be 'abort' or 'fallback_default'")
        return policy

    # pydantic-settings 설정:
    # .env 파일을 자동으로 찾아 읽고, 대소문자를 구분하지 않는다.
    # extra='ignore': .env에 아직 모델에 없는 키가 있어도 기동 실패하지 않음(구버전 코드·부분 배포)
    model_config = SettingsConfigDict(
        env_file=str(_EDGE_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


# 싱글턴 인스턴스: 모든 모듈에서 이 객체를 import해서 사용
settings = Settings()
