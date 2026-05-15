#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

OCR_URL="${OCR_REMOTE_URL:-$(gcloud run services describe "${OCR_SERVICE}" --region="${REGION}" --format='value(status.url)')}"
CONNECTION_NAME="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"

cat <<EOF
# Write this to /opt/candidatesignal/.env on the VM. Do not commit it.
PROJECT_ID=${PROJECT_ID}
REGION=${REGION}
CLOUDSQL_INSTANCE_CONNECTION_NAME=${CONNECTION_NAME}
SQL_DATABASE=${SQL_DATABASE}
SQL_USER=${SQL_USER}
DATABASE_PASSWORD=$(gcloud secrets versions access latest --secret=database-password)
BETTER_AUTH_SECRET=$(gcloud secrets versions access latest --secret=better-auth-secret)
BETTER_AUTH_URL=${BETTER_AUTH_URL:-http://VM_EXTERNAL_IP:3001}
NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE:-http://VM_EXTERNAL_IP:8010}
RESUME_INTEL_BOOTSTRAP_TOKEN=$(gcloud secrets versions access latest --secret=resume-intel-bootstrap-token)
RESUME_INTEL_GCS_BUCKET=${DOCUMENT_BUCKET}
RESUME_INTEL_LITELLM_BASE_URL=${RESUME_INTEL_LITELLM_BASE_URL:-https://api.openai.com/v1}
RESUME_INTEL_LITELLM_API_KEY=$(gcloud secrets versions access latest --secret=litellm-api-key 2>/dev/null || true)
RESUME_INTEL_LITELLM_MODEL=${RESUME_INTEL_LITELLM_MODEL:-openai/gpt-5-nano}
RESUME_INTEL_EMBEDDING_MODEL=${RESUME_INTEL_EMBEDDING_MODEL:-openai/text-embedding-3-small}
OCR_REMOTE_URL=${OCR_URL}
OCR_REMOTE_AUDIENCE=${OCR_URL}
OCR_INTERNAL_TOKEN=$(gcloud secrets versions access latest --secret=ocr-internal-token)
OCR_REMOTE_TIMEOUT_SECONDS=1800
API_PORT=8010
UI_PORT=3001
EOF
