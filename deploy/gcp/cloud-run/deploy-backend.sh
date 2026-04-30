#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   PROJECT_ID=<gcp-project> REGION=asia-northeast3 DB_URL='<jdbc-url>' DB_USER=<user> DB_PASSWORD=<pass> \
#   ./deploy/gcp/cloud-run/deploy-backend.sh

PROJECT_ID="${PROJECT_ID:?PROJECT_ID is required}"
REGION="${REGION:-asia-northeast3}"
SERVICE_NAME="${BACKEND_SERVICE_NAME:-inspection-backend}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
DB_URL="${DB_URL:?DB_URL is required}"
DB_USER="${DB_USER:?DB_USER is required}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD is required}"
IMAGE_DIR="${APP_INSPECTION_IMAGE_DIR:-/tmp/inspection-images}"

echo "[backend] project=${PROJECT_ID} region=${REGION} service=${SERVICE_NAME}"

gcloud config set project "${PROJECT_ID}"
gcloud builds submit --tag "${IMAGE_NAME}" ./backend

gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "SPRING_DATASOURCE_URL=${DB_URL},SPRING_DATASOURCE_USERNAME=${DB_USER},SPRING_DATASOURCE_PASSWORD=${DB_PASSWORD},APP_INSPECTION_IMAGE_DIR=${IMAGE_DIR}"

echo "[backend] deployed successfully"
