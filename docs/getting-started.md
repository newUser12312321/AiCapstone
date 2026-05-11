# 처음부터 따라하기

이 문서는 **이 저장소를 막 받은 사람**이 로컬에서 대시보드까지 띄우는 순서를 적었습니다. Windows 기준으로 적되, Docker 부분은 macOS/Linux에서도 동일합니다.

---

## 1. 이 프로젝트가 하는 일 (한 줄)

**엣지**가 이미지를 분석하고 → **백엔드**가 DB에 저장하고 → **프론트**가 브라우저에서 이력·차트를 보여 줍니다.

---

## 2. 준비물

### 방법 A — Docker로 전부 띄우기 (가장 단순, 추천)

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 설치 후 **실행 중**인지 확인
- Git
- (선택) Google AI Studio에서 발급한 **Gemini API 키** — 없으면 아래 4-2에서 게이트를 끕니다

### 방법 B — PC에 직접 설치해서 띄우기

- Git, **JDK 17**, **Maven**, **Node.js LTS**, **MySQL 8** (또는 호환 버전)
- 엣지를 **같은 PC에서** 돌릴 경우 Python 3.11+ 추가

---

## 3. 코드 받기

```bash
git clone https://github.com/newUser12312321/AiCapstone.git
cd AiCapstone
```

이후 예시는 Windows에서 `C:\Projects\AiCapstone` 에 두었다고 가정합니다. 본인 경로로 바꿉니다.

---

## 4. 방법 A — Docker Compose (MySQL + 백엔드 + 엣지 + 프론트)

### 4-1. 한 번에 기동

프로젝트 **루트**에서:

```powershell
cd C:\Projects\AiCapstone
docker compose up --build
```

처음에는 이미지 빌드로 **10분 이상** 걸릴 수 있습니다. 네트워크가 느리면 더 걸립니다.

### 4-2. Gemini 실크 게이트 (선택)

`docker-compose.yml` 안의 `edge` 서비스는 기본으로 `GEMINI_GATE_ENABLED` 가 켜져 있습니다. **키가 없으면** 검사 파이프라인에서 Gemini 관련 단계가 실패할 수 있으므로, 둘 중 하나를 하세요.

**옵션 1 — API 키 넣기 (루트 `.env`)**

루트에 `.env` 파일을 만들고 (이 파일은 보통 Git에 올리지 않습니다):

```env
GEMINI_API_KEY=여기에_발급받은_키
```

다시 `docker compose up --build` 합니다. Compose가 이 값을 `edge` 컨테이너로 넘깁니다.

**옵션 2 — 게이트 끄기**

루트에 `docker-compose.override.yml` 을 만들고:

```yaml
services:
  edge:
    environment:
      GEMINI_GATE_ENABLED: "false"
```

저장 후 다시 `docker compose up --build` 합니다. (Docker Compose가 자동으로 이 파일을 합칩니다.)

### 4-3. 브라우저에서 확인

| 무엇 | 주소 |
|------|------|
| 대시보드 (React) | http://localhost:5173 |
| 백엔드 API | http://localhost:8080 |
| 엣지 API | http://localhost:8000 |
| MySQL (호스트에서 접속 시) | `localhost:3307` , 사용자 `root` , 비밀번호 `your_password` (compose 기본값) |

대시보드에서 **로컬 이미지 업로드로 검사** 같은 기능이 있으면, 웹캠 없이도 파이프라인을 시험할 수 있습니다.

### 4-4. 종료·초기화

```powershell
docker compose down
```

DB 데이터까지 지우려면:

```powershell
docker compose down -v
```

### 4-5. PC만 Docker (엣지는 라즈베리파이 등 다른 기기)

엣지가 이미 `http://<엣지IP>:8000` 에 떠 있는 경우:

```powershell
$env:VITE_EDGE_CAPTURE_URL="http://<엣지IP>:8000"
docker compose -f docker-compose.pc.yml up --build
```

자세한 주석은 `docker-compose.pc.yml` 상단에 있습니다.

---

## 5. 방법 B — Windows에서 네이티브 실행

### 5-1. MySQL

1. MySQL 설치 후 서비스 기동  
2. DB 생성:

```sql
CREATE DATABASE inspection_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

3. `root` 비밀번호를 정합니다. 아래에서 `DB_PASSWORD` 로 같은 값을 씁니다.

### 5-2. 백엔드 (Spring Boot)

```powershell
cd C:\Projects\AiCapstone\backend
$env:DB_PASSWORD="MySQL_root_비밀번호"
mvn spring-boot:run
```

콘솔에 `Started InspectionApplication` 비슷한 로그가 나오면 성공입니다. 포트 **8080** 입니다.

`backend\src\main\resources\application.yml` 의 DB URL이 `localhost:3306` 인지 확인합니다. 다른 포트를 쓰면 여기서 맞춥니다.

### 5-3. 프론트엔드 (Vite)

**새 터미널**:

```powershell
cd C:\Projects\AiCapstone\frontend
npm install
npm run dev
```

터미널에 나온 주소(보통 http://localhost:5173 )로 접속합니다.

프론트는 `vite.config.ts` 의 프록시로 `/api` → 백엔드, `/edge` 등 → 엣지로 넘깁니다. **엣지를 아직 안 띄운 상태**면 캡처·엣지 전용 기능만 실패할 수 있으니, 전체를 보려면 아래 엣지도 실행합니다.

### 5-4. 엣지 (같은 PC에서 테스트할 때)

```powershell
cd C:\Projects\AiCapstone\edge
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

`.env` 를 열고 최소한 다음을 맞춥니다.

```env
SERVER_BASE_URL=http://127.0.0.1:8080
SERVER_INSPECTION_API_PATH=/api/v1/inspections
GEMINI_GATE_ENABLED=false
```

(Gemini를 쓸 때만 `true` + `GEMINI_API_KEY` 설정.)

```powershell
python main.py
```

`main.py` 안에서 uvicorn을 띄웁니다. 개발 시에는 `ENVIRONMENT=development` 와 `--reload` 를 붙인 uvicorn 직접 실행도 가능합니다(`main.py` 상단 주석 참고).

웹캠이 없는 PC면 **Docker의 edge**처럼 업로드·더미 API만 쓰거나, `docker compose` 로 엣지까지 함께 띄우는 편이 수월합니다.

---

## 6. 라즈베리파이에서 엣지만 실행하는 경우 (요약)

1. Pi에 Python 3.11, Git 설치  
2. 저장소를 `~/inspection` 등에 clone  
3. `cd edge` → venv → `pip install -r requirements.txt`  
4. `cp .env.example .env` 후 `SERVER_BASE_URL` 을 **PC의 백엔드 주소**로 설정 (예: `http://192.168.0.10:8080`)  
5. `edge/weights/` 에 학습된 `.pt` 파일이 있어야 실제 모델 추론이 됩니다. 없으면 코드에 따라 기본 가중치·더미 동작이 될 수 있습니다.  
6. `python main.py` 또는 systemd로 등록 (`edge/deploy/raspberry-pi/` 참고)

---

## 7. 키오스크 (Blazor, `frontend-kiosk`)

로컬에서 빌드만 확인:

```powershell
cd C:\Projects\AiCapstone\frontend-kiosk\PcbKiosk
dotnet restore
dotnet run
```

실행 후 터미널에 나온 URL(예: http://localhost:5xxx )으로 접속합니다. Pi 부팅 시 자동 실행·Chromium 전체 화면은 `frontend-kiosk/deploy/raspberry-pi/` 의 systemd 예제와 스크립트를 참고해 경로만 본인 환경에 맞게 수정하면 됩니다.

---

## 8. 자주 막히는 것

| 증상 | 확인 |
|------|------|
| `5173` / `8080` / `8000` / `3307` 포트 사용 중 | 다른 프로그램 종료 또는 compose의 ports 변경 |
| 백엔드가 DB에 연결 안 됨 | `DB_PASSWORD`, MySQL 기동, DB 이름 `inspection_db` |
| Docker에서 프론트가 엣지에 연결 안 됨 | compose 안의 `VITE_EDGE_CAPTURE_URL` , PC 분리 실행 시 `docker-compose.pc.yml` + 환경변수 |
| 빌드가 너무 느리다 | 첫 `docker compose build` 만 크고, 이후는 캐시됨 |

로그:

```powershell
docker compose logs -f backend
docker compose logs -f edge
```

---

## 9. 다음에 읽을 것 (코드 탐색)

- REST 엔드포인트: `backend/src/main/java/.../controller/`  
- 엣지 라우트: `edge/main.py`, `edge/api/`  
- 대시보드 페이지: `frontend/src/pages/`  
- YOLO 가중치: `edge/weights/` (용량 때문에 Git에 없을 수 있음)

이 문서는 **실행 경로**에만 집중했습니다. 학습 파이프라인·하드웨어 배선은 코드와 `edge/tools/` 주석을 참고하면 됩니다.
