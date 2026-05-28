#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

OCR_URL="${OCR_REMOTE_URL:-$(gcloud run services describe "${OCR_SERVICE}" --region="${REGION}" --format='value(status.url)')}"
CONNECTION_NAME="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
APP_ORIGIN="${APP_ORIGIN:-https://${APP_DOMAIN}}"
STAGING_APP_ORIGIN="${STAGING_APP_ORIGIN:-https://${STAGING_DOMAIN}}"
OUTPUT_DIR="${RENDER_VM_ENV_OUTPUT_DIR:-}"

compose_escape_value() {
  printf "%s" "$1" | sed 's/\$/$$/g'
}

urlencode() {
  python3 -c 'from urllib.parse import quote; import sys; print(quote(sys.argv[1], safe=""))' "$1"
}

render_env() {
  local staging_gate_password_hash
  staging_gate_password_hash="$(compose_escape_value "${STAGING_GATE_PASSWORD_HASH:-$(secret_value staging-gate-password-hash)}")"
  cat <<EOF
# Write this to /opt/candidatesignal/.env on the VM. Do not commit it.
PROJECT_ID=${PROJECT_ID}
REGION=${REGION}
APEX_DOMAIN=${APEX_DOMAIN}
WWW_DOMAIN=${WWW_DOMAIN}
APP_DOMAIN=${APP_DOMAIN}
STAGING_DOMAIN=${STAGING_DOMAIN}
CLOUDSQL_INSTANCE_CONNECTION_NAME=${CONNECTION_NAME}
SQL_DATABASE=${SQL_DATABASE}
SQL_USER=${SQL_USER}
STAGING_SQL_DATABASE=${STAGING_SQL_DATABASE}
STAGING_SQL_USER=${STAGING_SQL_USER}
BETTER_AUTH_URL=${BETTER_AUTH_URL:-${APP_ORIGIN}}
BETTER_AUTH_TRUSTED_ORIGINS=${BETTER_AUTH_TRUSTED_ORIGINS:-https://${APP_DOMAIN},https://${APEX_DOMAIN},https://${WWW_DOMAIN}}
STAGING_BETTER_AUTH_URL=${STAGING_BETTER_AUTH_URL:-${STAGING_APP_ORIGIN}}
STAGING_BETTER_AUTH_TRUSTED_ORIGINS=${STAGING_BETTER_AUTH_TRUSTED_ORIGINS:-${STAGING_APP_ORIGIN}}
NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE:-/api/backend}
RESUME_INTEL_GCS_BUCKET=${DOCUMENT_BUCKET}
STAGING_RESUME_INTEL_GCS_BUCKET=${STAGING_DOCUMENT_BUCKET}
RESUME_INTEL_SELF_SIGNUP_ENABLED=${RESUME_INTEL_SELF_SIGNUP_ENABLED:-1}
RESUME_INTEL_SELF_SIGNUP_SEAT_LIMIT=${RESUME_INTEL_SELF_SIGNUP_SEAT_LIMIT:-5}
STAGING_RESUME_INTEL_SELF_SIGNUP_ENABLED=${STAGING_RESUME_INTEL_SELF_SIGNUP_ENABLED:-1}
STAGING_RESUME_INTEL_SELF_SIGNUP_SEAT_LIMIT=${STAGING_RESUME_INTEL_SELF_SIGNUP_SEAT_LIMIT:-5}
STAGING_GATE_PASSWORD_HASH=${staging_gate_password_hash}
STAGING_GATE_COOKIE_NAME=${STAGING_GATE_COOKIE_NAME:-candidate_signal_staging_gate}
STAGING_GATE_MAX_AGE_SECONDS=${STAGING_GATE_MAX_AGE_SECONDS:-43200}
RESUME_INTEL_LITELLM_BASE_URL=${RESUME_INTEL_LITELLM_BASE_URL}
STAGING_RESUME_INTEL_LITELLM_BASE_URL=${STAGING_RESUME_INTEL_LITELLM_BASE_URL:-${RESUME_INTEL_LITELLM_BASE_URL}}
RESUME_INTEL_LITELLM_MODEL=${RESUME_INTEL_LITELLM_MODEL}
STAGING_RESUME_INTEL_LITELLM_MODEL=${STAGING_RESUME_INTEL_LITELLM_MODEL:-${RESUME_INTEL_LITELLM_MODEL}}
RESUME_INTEL_EMBEDDING_MODEL=${RESUME_INTEL_EMBEDDING_MODEL}
STAGING_RESUME_INTEL_EMBEDDING_MODEL=${STAGING_RESUME_INTEL_EMBEDDING_MODEL:-${RESUME_INTEL_EMBEDDING_MODEL}}
RESUME_INTEL_MAIL_ENABLED=${RESUME_INTEL_MAIL_ENABLED:-0}
RESUME_INTEL_MAIL_DRY_RUN=${RESUME_INTEL_MAIL_DRY_RUN:-1}
RESUME_INTEL_MAIL_PROVIDER=${RESUME_INTEL_MAIL_PROVIDER:-resend}
RESUME_INTEL_MAIL_FROM_EMAIL=${RESUME_INTEL_MAIL_FROM_EMAIL:-no-reply@candidatesignal.ai}
RESUME_INTEL_MAIL_FROM_NAME=${RESUME_INTEL_MAIL_FROM_NAME:-candidateSignal.ai}
RESUME_INTEL_MAIL_REPLY_TO=${RESUME_INTEL_MAIL_REPLY_TO:-}
RESUME_INTEL_APP_BASE_URL=${RESUME_INTEL_APP_BASE_URL:-${APP_ORIGIN}}
STAGING_RESUME_INTEL_APP_BASE_URL=${STAGING_RESUME_INTEL_APP_BASE_URL:-${STAGING_APP_ORIGIN}}
LINKEDIN_APIFY_ACTOR_ID=${LINKEDIN_APIFY_ACTOR_ID:-LpVuK3Zozwuipa5bp}
STAGING_LINKEDIN_APIFY_ACTOR_ID=${STAGING_LINKEDIN_APIFY_ACTOR_ID:-${LINKEDIN_APIFY_ACTOR_ID:-LpVuK3Zozwuipa5bp}}
LINKEDIN_APIFY_SCRAPER_MODE=${LINKEDIN_APIFY_SCRAPER_MODE:-Profile details no email (\$4 per 1k)}
STAGING_LINKEDIN_APIFY_SCRAPER_MODE=${STAGING_LINKEDIN_APIFY_SCRAPER_MODE:-${LINKEDIN_APIFY_SCRAPER_MODE:-Profile details no email (\$4 per 1k)}}
OCR_REMOTE_URL=${OCR_URL}
OCR_REMOTE_AUDIENCE=${OCR_URL}
OCR_REMOTE_TIMEOUT_SECONDS=1800
API_PORT=8010
UI_PORT=3001
STAGING_API_PORT=${STAGING_API_PORT:-8110}
STAGING_UI_PORT=${STAGING_UI_PORT:-3101}
EOF
}

secret_value() {
  local name="$1"
  gcloud secrets versions access latest --secret="${name}" 2>/dev/null || true
}

secret_value_first() {
  local value=""
  for name in "$@"; do
    value="$(secret_value "${name}")"
    if [[ -n "${value}" ]]; then
      printf "%s" "${value}"
      return 0
    fi
  done
}

render_secrets() {
  local target_dir="$1"
  local secrets_dir="${target_dir}/secrets"
  local database_password
  local database_user_encoded
  local database_password_encoded
  local database_name_encoded
  database_password="$(secret_value database-password)"
  if [[ -z "${database_password}" ]]; then
    echo "Missing Secret Manager secret: database-password" >&2
    exit 1
  fi
  database_user_encoded="$(urlencode "${SQL_USER}")"
  database_password_encoded="$(urlencode "${database_password}")"
  database_name_encoded="$(urlencode "${SQL_DATABASE}")"
  mkdir -p "${secrets_dir}"
  chmod 700 "${secrets_dir}"
  printf "postgresql://%s:%s@cloudsql-proxy:5432/%s" "${database_user_encoded}" "${database_password_encoded}" "${database_name_encoded}" > "${secrets_dir}/database-url"
  printf "%s" "$(secret_value better-auth-secret)" > "${secrets_dir}/better-auth-secret"
  printf "%s" "$(secret_value resume-intel-bootstrap-token)" > "${secrets_dir}/bootstrap-token"
  printf "%s" "$(secret_value litellm-api-key)" > "${secrets_dir}/litellm-api-key"
  printf "%s" "${APIFY_API_TOKEN:-$(secret_value apify-api-token)}" > "${secrets_dir}/apify-api-token"
  printf "%s" "${RESEND_API_KEY:-$(secret_value resend-api-key)}" > "${secrets_dir}/resend-api-key"
  printf "%s" "${GOOGLE_CLIENT_ID:-$(secret_value google-oauth-client-id)}" > "${secrets_dir}/google-client-id"
  printf "%s" "${GOOGLE_CLIENT_SECRET:-$(secret_value google-oauth-client-secret)}" > "${secrets_dir}/google-client-secret"
  printf "%s" "$(secret_value ocr-internal-token)" > "${secrets_dir}/ocr-internal-token"
  printf "%s" "${RESUME_INTEL_ALERT_WEBHOOK_URL:-$(secret_value operational-alert-webhook-url)}" > "${secrets_dir}/alert-webhook-url"
  chmod 600 "${secrets_dir}"/*

  local staging_secrets_dir="${target_dir}/secrets-staging"
  local staging_database_password
  local staging_database_user_encoded
  local staging_database_password_encoded
  local staging_database_name_encoded
  staging_database_password="$(secret_value staging-database-password)"
  if [[ -z "${staging_database_password}" ]]; then
    echo "Missing Secret Manager secret: staging-database-password. Run deploy/gcp/09_create_staging_resources.sh first." >&2
    exit 1
  fi
  staging_database_user_encoded="$(urlencode "${STAGING_SQL_USER}")"
  staging_database_password_encoded="$(urlencode "${staging_database_password}")"
  staging_database_name_encoded="$(urlencode "${STAGING_SQL_DATABASE}")"
  mkdir -p "${staging_secrets_dir}"
  chmod 700 "${staging_secrets_dir}"
  printf "postgresql://%s:%s@cloudsql-proxy:5432/%s" "${staging_database_user_encoded}" "${staging_database_password_encoded}" "${staging_database_name_encoded}" > "${staging_secrets_dir}/database-url"
  printf "%s" "$(secret_value staging-better-auth-secret)" > "${staging_secrets_dir}/better-auth-secret"
  printf "%s" "$(secret_value staging-resume-intel-bootstrap-token)" > "${staging_secrets_dir}/bootstrap-token"
  printf "%s" "$(secret_value_first staging-litellm-api-key litellm-api-key)" > "${staging_secrets_dir}/litellm-api-key"
  printf "%s" "${APIFY_API_TOKEN:-$(secret_value_first staging-apify-api-token apify-api-token)}" > "${staging_secrets_dir}/apify-api-token"
  printf "%s" "${RESEND_API_KEY:-$(secret_value_first staging-resend-api-key resend-api-key)}" > "${staging_secrets_dir}/resend-api-key"
  printf "%s" "${STAGING_GOOGLE_CLIENT_ID:-${GOOGLE_CLIENT_ID:-$(secret_value_first staging-google-oauth-client-id google-oauth-client-id)}}" > "${staging_secrets_dir}/google-client-id"
  printf "%s" "${STAGING_GOOGLE_CLIENT_SECRET:-${GOOGLE_CLIENT_SECRET:-$(secret_value_first staging-google-oauth-client-secret google-oauth-client-secret)}}" > "${staging_secrets_dir}/google-client-secret"
  printf "%s" "$(secret_value ocr-internal-token)" > "${staging_secrets_dir}/ocr-internal-token"
  printf "%s" "${RESUME_INTEL_ALERT_WEBHOOK_URL:-$(secret_value staging-operational-alert-webhook-url)}" > "${staging_secrets_dir}/alert-webhook-url"
  chmod 600 "${staging_secrets_dir}"/*
}

if [[ -n "${OUTPUT_DIR}" ]]; then
  mkdir -p "${OUTPUT_DIR}"
  chmod 700 "${OUTPUT_DIR}"
  render_env > "${OUTPUT_DIR}/.env"
  chmod 600 "${OUTPUT_DIR}/.env"
  render_secrets "${OUTPUT_DIR}"
  echo "Rendered VM env bundle at ${OUTPUT_DIR}" >&2
  echo "Copy ${OUTPUT_DIR}/.env to /opt/candidatesignal/.env on the VM." >&2
  echo "Copy ${OUTPUT_DIR}/secrets/* to /opt/candidatesignal/secrets/ and ${OUTPUT_DIR}/secrets-staging/* to /opt/candidatesignal/secrets-staging/." >&2
else
  render_env
  echo "Rendered non-secret .env only. Set RENDER_VM_ENV_OUTPUT_DIR to also create the required ./secrets files." >&2
fi
