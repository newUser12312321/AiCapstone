#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   PROJECT_ID=<gcp-project> REGION=asia-northeast3 BACKEND_URL='https://inspection-backend-xxxxx.a.run.app' \
#   ./deploy/gcp/cloud-run/deploy-frontend.sh

PROJECT_ID="${PROJECT_ID:?PROJECT_ID is required}"
REGION="${REGION:-asia-northeast3}"
SERVICE_NAME="${FRONTEND_SERVICE_NAME:-inspection-frontend}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
BACKEND_URL="${BACKEND_URL:?BACKEND_URL is required}"
EDGE_URL="${EDGE_URL:-http://127.0.0.1:8000}"

echo "[frontend] project=${PROJECT_ID} region=${REGION} service=${SERVICE_NAME}"
echo "[frontend] proxy /api -> ${BACKEND_URL}"

gcloud config set project "${PROJECT_ID}"
gcloud builds submit --tag "${IMAGE_NAME}" ./frontend

gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "VITE_API_PROXY_TARGET=${BACKEND_URL},VITE_EDGE_CAPTURE_URL=${EDGE_URL}"

echo "[frontend] deployed successfully"
