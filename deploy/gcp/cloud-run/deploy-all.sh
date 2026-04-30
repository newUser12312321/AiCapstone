#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   PROJECT_ID=<gcp-project> REGION=asia-northeast3 DB_URL='<jdbc-url>' DB_USER=<user> DB_PASSWORD=<pass> \
#   ./deploy/gcp/cloud-run/deploy-all.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ID="${PROJECT_ID:?PROJECT_ID is required}"
REGION="${REGION:-asia-northeast3}"
BACKEND_SERVICE_NAME="${BACKEND_SERVICE_NAME:-inspection-backend}"

PROJECT_ID="${PROJECT_ID}" REGION="${REGION}" BACKEND_SERVICE_NAME="${BACKEND_SERVICE_NAME}" \
DB_URL="${DB_URL:?DB_URL is required}" DB_USER="${DB_USER:?DB_USER is required}" DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD is required}" \
bash "${SCRIPT_DIR}/deploy-backend.sh"

BACKEND_URL="$(gcloud run services describe "${BACKEND_SERVICE_NAME}" --region "${REGION}" --format='value(status.url)')"
echo "[deploy-all] backend url: ${BACKEND_URL}"

PROJECT_ID="${PROJECT_ID}" REGION="${REGION}" BACKEND_URL="${BACKEND_URL}" \
bash "${SCRIPT_DIR}/deploy-frontend.sh"

echo "[deploy-all] deployment completed"
