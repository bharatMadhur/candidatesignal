#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

OCR_URL="${OCR_REMOTE_URL:-$(gcloud run services describe "${OCR_SERVICE}" --region="${REGION}" --format='value(status.url)')}"
CONNECTION_NAME="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
APP_ORIGIN="${APP_ORIGIN:-https://${APP_DOMAIN}}"
OUTPUT_DIR="${RENDER_VM_ENV_OUTPUT_DIR:-}"

render_env() {
  cat <<EOF
# Write this to /opt/candidatesignal/.env on the VM. Do not commit it.
PROJECT_ID=${PROJECT_ID}
REGION=${REGION}
APEX_DOMAIN=${APEX_DOMAIN}
WWW_DOMAIN=${WWW_DOMAIN}
APP_DOMAIN=${APP_DOMAIN}
CLOUDSQL_INSTANCE_CONNECTION_NAME=${CONNECTION_NAME}
SQL_DATABASE=${SQL_DATABASE}
SQL_USER=${SQL_USER}
BETTER_AUTH_URL=${BETTER_AUTH_URL:-${APP_ORIGIN}}
BETTER_AUTH_TRUSTED_ORIGINS=${BETTER_AUTH_TRUSTED_ORIGINS:-https://${APP_DOMAIN},https://${APEX_DOMAIN},https://${WWW_DOMAIN}}
NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE:-/api}
RESUME_INTEL_GCS_BUCKET=${DOCUMENT_BUCKET}
RESUME_INTEL_LITELLM_BASE_URL=${RESUME_INTEL_LITELLM_BASE_URL}
RESUME_INTEL_LITELLM_MODEL=${RESUME_INTEL_LITELLM_MODEL}
RESUME_INTEL_EMBEDDING_MODEL=${RESUME_INTEL_EMBEDDING_MODEL}
OCR_REMOTE_URL=${OCR_URL}
OCR_REMOTE_AUDIENCE=${OCR_URL}
OCR_REMOTE_TIMEOUT_SECONDS=1800
API_PORT=8010
UI_PORT=3001
EOF
}

secret_value() {
  local name="$1"
  gcloud secrets versions access latest --secret="${name}" 2>/dev/null || true
}

render_secrets() {
  local target_dir="$1"
  local secrets_dir="${target_dir}/secrets"
  local database_password
  database_password="$(secret_value database-password)"
  if [[ -z "${database_password}" ]]; then
    echo "Missing Secret Manager secret: database-password" >&2
    exit 1
  fi
  mkdir -p "${secrets_dir}"
  chmod 700 "${secrets_dir}"
  printf "postgresql://%s:%s@cloudsql-proxy:5432/%s" "${SQL_USER}" "${database_password}" "${SQL_DATABASE}" > "${secrets_dir}/database-url"
  printf "%s" "$(secret_value better-auth-secret)" > "${secrets_dir}/better-auth-secret"
  printf "%s" "$(secret_value resume-intel-bootstrap-token)" > "${secrets_dir}/bootstrap-token"
  printf "%s" "$(secret_value litellm-api-key)" > "${secrets_dir}/litellm-api-key"
  printf "%s" "$(secret_value ocr-internal-token)" > "${secrets_dir}/ocr-internal-token"
  printf "%s" "${RESUME_INTEL_ALERT_WEBHOOK_URL:-$(secret_value operational-alert-webhook-url)}" > "${secrets_dir}/alert-webhook-url"
  chmod 600 "${secrets_dir}"/*
}

if [[ -n "${OUTPUT_DIR}" ]]; then
  mkdir -p "${OUTPUT_DIR}"
  chmod 700 "${OUTPUT_DIR}"
  render_env > "${OUTPUT_DIR}/.env"
  render_secrets "${OUTPUT_DIR}"
  echo "Rendered VM env bundle at ${OUTPUT_DIR}" >&2
  echo "Copy both ${OUTPUT_DIR}/.env and ${OUTPUT_DIR}/secrets to /opt/candidatesignal on the VM." >&2
else
  render_env
  echo "Rendered non-secret .env only. Set RENDER_VM_ENV_OUTPUT_DIR to also create the required ./secrets files." >&2
fi
