# GCP Cloud Run 분리 배포

이 폴더의 스크립트는 `backend(Spring)`와 `frontend(React)`를 Cloud Run에 각각 배포한다.

## 1) 사전 준비

- `gcloud` 설치 및 로그인
- GCP 프로젝트 선택 권한
- Cloud Run / Cloud Build API 활성화
- 백엔드 DB 접속 정보 준비

## 2) 백엔드 단독 배포

```bash
PROJECT_ID=<your-project-id> \
REGION=asia-northeast3 \
DB_URL='jdbc:mysql://<host>:3306/<db>?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8' \
DB_USER=<db-user> \
DB_PASSWORD=<db-password> \
bash deploy/gcp/cloud-run/deploy-backend.sh
```

추가 옵션:

- `BACKEND_SERVICE_NAME` (기본: `inspection-backend`)
- `APP_INSPECTION_IMAGE_DIR` (기본: `/tmp/inspection-images`)
- `GCS_IMAGE_BUCKET` (선택, 설정 시 검사 이미지를 GCS 버킷에 영구 저장)

예:

```bash
PROJECT_ID=<your-project-id> \
REGION=asia-northeast3 \
DB_URL='jdbc:mysql:///inspection_db?cloudSqlInstance=<project>:asia-northeast3:inspection-mysql&socketFactory=com.google.cloud.sql.mysql.SocketFactory&useSSL=false&serverTimezone=Asia/Seoul&characterEncoding=UTF-8' \
DB_USER=<db-user> \
DB_PASSWORD=<db-password> \
GCS_IMAGE_BUCKET=<bucket-name> \
bash deploy/gcp/cloud-run/deploy-backend.sh
```

## 3) 프론트 단독 배포

```bash
PROJECT_ID=<your-project-id> \
REGION=asia-northeast3 \
BACKEND_URL='https://inspection-backend-xxxxx.a.run.app' \
bash deploy/gcp/cloud-run/deploy-frontend.sh
```

추가 옵션:

- `FRONTEND_SERVICE_NAME` (기본: `inspection-frontend`)
- `EDGE_URL` (기본: `http://127.0.0.1:8000`, Cloud에서는 보통 사용하지 않음)

## 4) 한번에 배포

```bash
PROJECT_ID=<your-project-id> \
REGION=asia-northeast3 \
DB_URL='jdbc:mysql://<host>:3306/<db>?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8' \
DB_USER=<db-user> \
DB_PASSWORD=<db-password> \
bash deploy/gcp/cloud-run/deploy-all.sh
```

`deploy-all.sh`는 백엔드 배포 후 URL을 자동 조회해 프론트 배포에 전달한다.
