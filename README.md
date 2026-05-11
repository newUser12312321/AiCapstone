# 라즈베리파이 기반 PCB 비전 검사 시스템


라즈베리파이에 연결된 **현장 터치 키오스크**를 통해 **USB 웹캠**으로 PCB를 촬영하고, **라즈베리파이 내부**에서 YOLO 기반 비전 파이프라인으로 정렬·결함 판정을 수행합니다. 검사 결과는 **중앙 서버(`backend`, Spring Boot + MySQL)** 로 전송되어 저장되며, **React 웹 앱(`frontend`)** 의 대시보드를 통해 이력과 통계를 확인합니다.

운영 환경은 **라즈베리파이**, 백엔드·DB·대시보드는 **사무실 PC 또는 서버**에 두고, Docker 또는 개별 프로세스로 기동합니다. 클론 후 설치·실행 순서는 **[docs/getting-started.md](docs/getting-started.md)** 에 정리되어 있습니다.

---

## 사용 소프트웨어

### 엣지(**라즈베리파이**) (`edge/`)

| 구분 | 소프트웨어·버전(대표) |
|------|------------------------|
| 언어 | Python 3.11+ 권장(라즈베리파이 기준) |
| API | FastAPI 0.111, Uvicorn 0.29 |
| 비전·추론 | OpenCV 4.9, Ultralytics(YOLOv8) 8.2.18, PyTorch 2.5.1, torchvision 0.20.1 |
| 설정·검증 | Pydantic 2.7, pydantic-settings 2.2 |
| HTTP | requests, httpx |

가중치는 `edge/weights/` 의 `.pt` 파일을 사용합니다(일부 파일은 Git에 포함, 나머지는 `.gitignore`로 제외될 수 있음).

### 중앙 서버 (`backend/`)

| 구분 | 소프트웨어·버전(대표) |
|------|------------------------|
| 언어 | Java 17 |
| 프레임워크 | Spring Boot 3.3 |
| 데이터 접근 | Spring Data JPA |
| DB | MySQL 8.x(로컬 Docker 예시는 8.4 이미지) |

### 웹 (`frontend/`)

| 구분 | 소프트웨어·버전(대표) |
|------|------------------------|
| UI | React 18.3, TypeScript 5.4 |
| 빌드 | Vite 5.2, Tailwind CSS 3.4 |
| 데이터 패칭 | TanStack React Query 5.x, Axios |

### 기타

| 구분 | 설명 |
|------|------|
| 컨테이너 | Docker Compose로 MySQL·백엔드·프론트를 한 번에 기동 가능(`docker-compose.pc.yml`) |
| 선택 | 실크 스크린 검증 등에 **Google Gemini API** 를 쓰는 경로가 있으며, 키 없이 쓰려면 설정으로 게이트를 끌 수 있음(`docs/getting-started.md` 참고) |
| 참고 | `frontend-kiosk/` 는 Blazor 테스트용 코드로, **현장 키오스크는 `frontend`의 React `/kiosk`** 를 사용함 |

---

## 검사 로직

운영 모드에서 `edge/main.py`의 `_run_production_vision_pipeline`이 한 장을 처리할 때의 흐름입니다. (개발 모드 `ENVIRONMENT=development`에서는 카메라·YOLO 없이 더미 패킷만 만들어 전송 흐름을 시험합니다.)

### 1. 캡처와 렌즈 보정

- USB 웹캠으로 프레임을 받아 디스크에 저장합니다.
- **캘리브레이션 적용**  
  - 앱 기동 시 `CAMERA_CALIBRATION_ENABLED`가 켜져 있으면 `CAMERA_CALIBRATION_FILE`(기본값 예: `config/camera_calibration_c922_1920x1080.npz`)에서 **`camera_matrix`**, **`dist_coeffs`** 를 읽어 메모리에 올립니다.  
  - 캡처 직후 `_undistort_frame_if_enabled`에서, npz에 적힌 **캘리브레이션 해상도**와 현재 프레임 해상도가 **일치할 때만** `cv2.getOptimalNewCameraMatrix`(알파는 `CAMERA_CALIBRATION_ALPHA`)로 새 카메라 행렬을 만들고 **`cv2.undistort`** 로 왜곡을 풉니다. 해상도가 다르면 보정을 건너뛰고 원본을 씁니다.  
  - `CAMERA_CALIBRATION_CROP_ROI`가 켜져 있으면 undistort 후 **유효 영역 ROI**만 잘라 검은 테두리를 줄입니다.  
  - npz는 `edge/tools/calibrate_from_images.py` 등으로 생성한 뒤 `edge/config/`에 두는 흐름입니다.

### 2. 실크 / Gemini 단계 (설정·호출 조건에 따라 실행)

- `GEMINI_GATE_ENABLED` 등이 맞으면 **Gemini 실크 게이트**를 돌려 기판 실크·OCR 관련 판단을 할 수 있습니다. 실패 시 여기서 FAIL 패킷을 만들고 종료합니다.
- 키오스크 프리셋(`gt125a` / `gn948x`)이면 이 블록을 **건너뛰고** 실크 필드만 프리셋 값으로 채웁니다.
- 게이트를 켠 상태에서 OCR로 뽑은 시리즈·기판명 등이 비어 있으면 **실크 인쇄 불량**으로 FAIL할 수 있습니다.

### 3. 멀티보드·가중치 선택 (설정에 따라)

- `MULTI_BOARD_ENABLED`이고 `board_profiles.json`이 있으면, 키오스크 프리셋·OCR 라우팅·(옵션) 보드 식별 YOLO 등으로 **보드 타입**을 정하고, 그에 맞는 **별도 `.pt`** 로 Stage 1·2 검출기를 바꿉니다. 기대 클래스 개수(`expected_counts`)도 여기서 읽습니다.
- 보드를 못 정했을 때의 동작(`BOARD_UNKNOWN_POLICY` 등)은 설정에 따릅니다.

### 4. Stage 1 — 피듀셜과 기준 좌표 정합

- 선택된 Stage 1 검출기로 **피듀셜(`FIDUCIAL`)만** YOLO 검출합니다.
- **서브픽셀 보정** (`edge/inference/yolo_detector.py`의 `detect_fiducials`)  
  - 각 검출 박스마다 bbox 중심을 **`yolo_center_x/y`** 로 남깁니다.  
  - 박스를 약간 키운 ROI 안에서 그레이스케일·가우시안 블러·**Canny** 로 윤곽을 찾고, 윤곽에 **`cv2.fitEllipse`** 로 타원을 맞춰 그 중심을 **전역 좌표**로 환산합니다. 여러 파라미터 조합을 순서대로 시도(`_refine_fiducial_with_fallbacks`)해 한 점이라도 실패할 확률을 줄입니다.  
  - 성공하면 **`refined_center_x/y`** 에 저장하고, 이후 정렬·정합에는 `DetectionItem.center_x_subpx` / `center_y_subpx` 프로퍼티가 **이 서브픽셀 값을 우선** 사용합니다. 보정이 전부 실패하면 bbox 중심(픽셀 격자)으로 폴백합니다.
- `compute_alignment`로 두 피듀셜 **서브픽셀 중심**을 잇는 방향의 **기울기(°)** 를 구하고, `MAX_DESKEW_ANGLE_DEG`를 넘으면 **정합 없이 FAIL** 하며 Stage 2는 실행하지 않습니다.
- 통과하면 `align_image_to_reference_by_fiducials`로, 검출된 두 점을 설정에 적어 둔 **기준 피듀셜 좌표**에 맞추는 **Similarity(이동·회전·등비 스케일)** 변환을 하고, `ALIGN_OUTPUT_WIDTH` × `ALIGN_OUTPUT_HEIGHT` 크기의 **정합 영상**을 만듭니다. 이 결과는 보통 `*_aligned.jpg`로 따로 저장됩니다.

### 5. Stage 2 — 결함 YOLO

- `STAGE2_SOURCE_MODE`가 **`aligned`**(기본)이면 정합 영상을, **`raw`**이면 캡처 원본을 입력으로 씁니다.
- `DEFECT_INFER_ON_FULL_DESKEW`가 켜져 있으면 **전체 프레임**에 대해 결함 검출을 하고, 꺼져 있으면 정합 좌표계에서 **피듀셜 주변 ROI**를 잘라 검출합니다(`raw` 모드일 때는 ROI 대신 전체 프레임으로 처리).
- 검출된 박스 좌표는 ROI를 썼다면 **전역 좌표**로 다시 옮겨 패킷에 넣습니다.

### 6. PASS/FAIL과 서버 전송

- `FAIL_ON_ANY_YOLO_DETECTION`이 켜져 있으면 결함 박스가 하나라도 있으면 FAIL, 없으면 PASS로 단순화합니다. 꺼져 있으면 검출 박스는 **패킷에 모두 포함**하되, 판정은 **정렬만 만족하면 PASS**로 둘 수 있습니다.
- 보드 프로파일에 **`expected_counts`**가 있으면 클래스별 개수를 세어 부족하면 `MISSING:...` 형태의 결함을 붙이고 **FAIL**로 바꿉니다.
- 최종 `InspectionPacket`을 만들고 `_finalize`에서 **Spring Boot 검사 API로 HTTP 전송**합니다. 캡처·정합 이미지 경로는 패킷에 실려 대시보드에서 `/captures` 등으로 불러옵니다.

---

## 저장소 받기

```bash
git clone https://github.com/newUser12312321/AiCapstone.git
cd AiCapstone
```

## 디렉터리 한눈에

| 경로 | 역할 |
|------|------|
| `edge/` | FastAPI 엔트리, 캡처·추론·정렬·전송 |
| `backend/` | Spring Boot REST + JPA |
| `frontend/` | 대시보드 + React 키오스크 (`/kiosk`) |
| `docs/` | 설치·실행 가이드(`getting-started.md`) |
