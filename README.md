# Desktop Edge Vision Inspection Station

라즈베리파이 5에서 PCB를 촬영·추론하고, 중앙 서버(Spring Boot + MySQL)에 검사 이력을 저장한 뒤 React 대시보드로 조회하는 **엣지 비전 검사** 모노레포입니다. 현장 터치 키오스크는 **Blazor WebAssembly**(`frontend-kiosk`)로 별도 제공합니다.

## 시스템 구성

```
[Raspberry Pi 5 — edge]
  웹캠 + YOLO(FastAPI)
  ├─ 검사 API :8000
  ├─ 캡처 정적 서빙 /captures
  └─ POST 검사 결과 → 중앙 서버
           │
           ▼
[Windows PC 또는 서버 — backend + DB]
  Spring Boot :8080, MySQL
           │
           ▼
[대시보드 — frontend]
  React 18 + Vite :5173 → /api 프록시 → :8080
```

키오스크(Blazor)는 Pi에서 `edge`와 함께 쓰며, Edge HTTP API를 호출합니다. 설치 절차는 [docs/12_라즈베리파이_키오스크_자동실행.md](docs/12_라즈베리파이_키오스크_자동실행.md)를 참고하세요.

## 디렉터리

| 경로 | 설명 |
|------|------|
| `edge/` | Python 3.11, FastAPI, YOLO, 카메라·GPIO |
| `backend/` | Java 17, Spring Boot 3.x, REST API, JPA |
| `frontend/` | React, Vite, Tailwind, 운영 대시보드 |
| `frontend-kiosk/` | Blazor WASM, Pi 터치 UI |
| `docs/` | 설치·운영·학습·시연 문서 |
| `docker-compose.yml` | 로컬/팀용 MySQL + backend + edge + frontend |
| `docker-compose.pc.yml` | PC만: MySQL + backend + frontend (엣지는 별도 기기) |

로컬 학습용 이미지 폴더(`GT125A/`, `gn948x/` 등)는 용량 때문에 Git에 포함하지 않을 수 있습니다. 피듀셜 스케일 보정 경로는 `edge/config/fiducial_scale_calibration.json` 등에서 로컬 절대 경로를 가리키므로, 다른 PC에서는 해당 경로만 맞추면 됩니다.

## 문서 색인

처음이면 **[docs/00_빠른시작.md](docs/00_빠른시작.md)** 부터 읽습니다.

| 문서 | 내용 |
|------|------|
| [00](docs/00_빠른시작.md) | 전체 흐름·매일 실행 순서 |
| [01](docs/01_프로젝트_구조.md) | 아키텍처·디렉터리·포트·API 개요 |
| [02](docs/02_Windows_설치_실행.md) | Windows에서 Java·Node·MySQL·실행 |
| [03](docs/03_라즈베리파이_설정.md) | Pi SSH, 카메라, systemd |
| [04](docs/04_GitHub_워크플로우.md) | Git 동기화 |
| [05](docs/05_데이터셋_학습_파이프라인.md) | CVAT → 학습 → `edge/weights` |
| [06](docs/06_하드웨어_준비물.md) | 부품·배선 |
| [07](docs/07_통합테스트_체크리스트.md) | 통합 점검 |
| [08](docs/08_트러블슈팅.md) | 자주 나는 오류 |
| [09](docs/09_결함_데이터_합성_방법.md) | 합성 데이터 |
| [10](docs/10_시연_가이드.md) | 시연 시나리오 |
| [12](docs/12_라즈베리파이_키오스크_자동실행.md) | Blazor 키오스크 systemd |
| [13](docs/13_엣지_클라우드_전환_실행계획.md) | 엣지–클라우드 로드맵·API 계약 |
| [14](docs/14_UI_스타일_가이드.md) | 대시보드·키오스크 UI 토큰 |

## 저장소 받기

원격 기본 이름은 `AiCapstone`입니다. 클론 후 폴더 이름은 자유롭게 바꿔도 됩니다.

```bash
git clone https://github.com/newUser12312321/AiCapstone.git
cd AiCapstone
```

## Docker로 한 번에 실행 (권장)

프로젝트 루트에서:

```bash
docker compose up --build
```

- 대시보드: `http://localhost:5173`
- 백엔드: `http://localhost:8080`
- 엣지(API): `http://localhost:8000`
- MySQL: `localhost:3306`

중지: `docker compose down` — 볼륨까지 지우려면 `docker compose down -v`.

PC에서만 백엔드·프론트를 띄우고 엣지는 라즈베리파이에 두는 경우: [docker-compose.pc.yml](docker-compose.pc.yml)과 문서 `00`/`01`의 분리 실행 절차를 참고하세요.

## 로컬 실행 (요약)

**백엔드**

```powershell
cd backend
$env:DB_PASSWORD="<MySQL 비밀번호>"
mvn spring-boot:run
```

**프론트**

```powershell
cd frontend
npm install
npm run dev
```

**엣지 (라즈베리파이 등)**

```bash
cd edge
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# .env 에 SERVER_BASE_URL 등 설정
python main.py
```

## 기술 스택

| 영역 | 기술 |
|------|------|
| Edge | Python 3.11, FastAPI, Ultralytics YOLO, OpenCV |
| Backend | Java 17, Spring Boot 3.x, MySQL |
| Dashboard | React 18, Vite, Tailwind |
| Kiosk | .NET 8, Blazor WebAssembly |

## 향후 방향 (참고)

클라우드 스택을 ASP.NET Core·Blazor로 통일하거나 GCP에 올리는 등의 계획은 코드와 별도로 진화할 수 있습니다. 현재 이 저장소에는 해당 .NET 서버 프로젝트가 포함되어 있지 않으며, 연동 계약·로드맵은 [docs/13_엣지_클라우드_전환_실행계획.md](docs/13_엣지_클라우드_전환_실행계획.md)에 정리합니다.

## 주요 기능

- 피듀셜 기반 기판 정렬·검사 파이프라인
- 결함 탐지(모델·클래스는 학습 산출물에 따름)
- GPIO 알람(환경에 따라 선택)
- 검사 이력 REST 저장 및 대시보드 시각화
