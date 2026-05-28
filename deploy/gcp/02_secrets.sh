#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

require_confirmation

upsert_secret() {
  local name="$1"
  local value="$2"
  if [[ -z "${value}" ]]; then
    echo "Missing value for ${name}" >&2
    exit 1
  fi
  gcloud secrets describe "${name}" >/dev/null 2>&1 \
    || gcloud secrets create "${name}" --replication-policy=automatic >/dev/null
  printf "%s" "${value}" | gcloud secrets versions add "${name}" --data-file=- >/dev/null
}

secret_exists() {
  local name="$1"
  gcloud secrets describe "${name}" >/dev/null 2>&1
}

read_secret() {
  local name="$1"
  gcloud secrets versions access latest --secret="${name}"
}

if [[ -z "${DATABASE_PASSWORD:-}" ]]; then
  if secret_exists "database-password"; then
    DATABASE_PASSWORD="$(read_secret "database-password")"
  else
    DATABASE_PASSWORD="$(openssl rand -base64 32)"
  fi
fi
if [[ -z "${BETTER_AUTH_SECRET:-}" ]]; then
  if secret_exists "better-auth-secret"; then
    BETTER_AUTH_SECRET="$(read_secret "better-auth-secret")"
  else
    BETTER_AUTH_SECRET="$(openssl rand -base64 48)"
  fi
fi
if [[ -z "${OCR_INTERNAL_TOKEN:-}" ]]; then
  if secret_exists "ocr-internal-token"; then
    OCR_INTERNAL_TOKEN="$(read_secret "ocr-internal-token")"
  else
    OCR_INTERNAL_TOKEN="$(openssl rand -base64 48)"
  fi
fi
if [[ -z "${RESUME_INTEL_BOOTSTRAP_TOKEN:-}" ]]; then
  if secret_exists "resume-intel-bootstrap-token"; then
    RESUME_INTEL_BOOTSTRAP_TOKEN="$(read_secret "resume-intel-bootstrap-token")"
  else
    RESUME_INTEL_BOOTSTRAP_TOKEN="$(openssl rand -base64 32)"
  fi
fi

upsert_secret "database-password" "${DATABASE_PASSWORD}"
upsert_secret "better-auth-secret" "${BETTER_AUTH_SECRET}"
upsert_secret "ocr-internal-token" "${OCR_INTERNAL_TOKEN}"
upsert_secret "resume-intel-bootstrap-token" "${RESUME_INTEL_BOOTSTRAP_TOKEN}"

if [[ -z "${RESUME_INTEL_LITELLM_API_KEY:-}" ]]; then
  if secret_exists "litellm-api-key"; then
    echo "Keeping existing litellm-api-key secret. No local LLM key was provided."
  else
    echo "Missing RESUME_INTEL_LITELLM_API_KEY. Add it to .env or export it before creating secrets." >&2
    exit 1
  fi
else
  upsert_secret "litellm-api-key" "${RESUME_INTEL_LITELLM_API_KEY}"
  if [[ -n "${RESUME_INTEL_LITELLM_API_KEY_SOURCE:-}" ]]; then
    echo "Loaded LLM API key from ${RESUME_INTEL_LITELLM_API_KEY_SOURCE}."
  else
    echo "Loaded LLM API key from environment."
  fi
fi

if [[ -n "${RESUME_INTEL_ALERT_WEBHOOK_URL:-}" ]]; then
  upsert_secret "operational-alert-webhook-url" "${RESUME_INTEL_ALERT_WEBHOOK_URL}"
  echo "Loaded operational alert webhook from environment."
elif secret_exists "operational-alert-webhook-url"; then
  echo "Keeping existing operational-alert-webhook-url secret."
else
  echo "No operational alert webhook configured. Alerts will remain in-app until the secret is added."
fi

if [[ -n "${APIFY_API_TOKEN:-}" ]]; then
  upsert_secret "apify-api-token" "${APIFY_API_TOKEN}"
  echo "Loaded Apify API token from environment."
elif secret_exists "apify-api-token"; then
  echo "Keeping existing apify-api-token secret."
else
  echo "No Apify API token configured. LinkedIn verification will stay unavailable until the secret is added."
fi

if [[ -n "${RESEND_API_KEY:-}" ]]; then
  upsert_secret "resend-api-key" "${RESEND_API_KEY}"
  echo "Loaded Resend API key from environment."
elif secret_exists "resend-api-key"; then
  echo "Keeping existing resend-api-key secret."
else
  echo "No Resend API key configured. Product email will remain disabled or dry-run until the secret is added."
fi

if [[ -n "${GOOGLE_CLIENT_ID:-}" ]]; then
  upsert_secret "google-oauth-client-id" "${GOOGLE_CLIENT_ID}"
  echo "Loaded Google OAuth client id from environment."
elif secret_exists "google-oauth-client-id"; then
  echo "Keeping existing google-oauth-client-id secret."
else
  echo "No Google OAuth client id configured. Candidate Google login will remain disabled until the secret is added."
fi

if [[ -n "${GOOGLE_CLIENT_SECRET:-}" ]]; then
  upsert_secret "google-oauth-client-secret" "${GOOGLE_CLIENT_SECRET}"
  echo "Loaded Google OAuth client secret from environment."
elif secret_exists "google-oauth-client-secret"; then
  echo "Keeping existing google-oauth-client-secret secret."
else
  echo "No Google OAuth client secret configured. Candidate Google login will remain disabled until the secret is added."
fi

if [[ -n "${STAGING_GOOGLE_CLIENT_ID:-}" ]]; then
  upsert_secret "staging-google-oauth-client-id" "${STAGING_GOOGLE_CLIENT_ID}"
  echo "Loaded staging Google OAuth client id from environment."
elif secret_exists "staging-google-oauth-client-id"; then
  echo "Keeping existing staging-google-oauth-client-id secret."
elif [[ -n "${GOOGLE_CLIENT_ID:-}" ]]; then
  upsert_secret "staging-google-oauth-client-id" "${GOOGLE_CLIENT_ID}"
  echo "Using production Google OAuth client id for staging."
fi

if [[ -n "${STAGING_GOOGLE_CLIENT_SECRET:-}" ]]; then
  upsert_secret "staging-google-oauth-client-secret" "${STAGING_GOOGLE_CLIENT_SECRET}"
  echo "Loaded staging Google OAuth client secret from environment."
elif secret_exists "staging-google-oauth-client-secret"; then
  echo "Keeping existing staging-google-oauth-client-secret secret."
elif [[ -n "${GOOGLE_CLIENT_SECRET:-}" ]]; then
  upsert_secret "staging-google-oauth-client-secret" "${GOOGLE_CLIENT_SECRET}"
  echo "Using production Google OAuth client secret for staging."
fi

for account in "${VM_SERVICE_ACCOUNT}" "${OCR_SERVICE_ACCOUNT}"; do
  email="$(service_account_email "${account}")"
  gcloud secrets add-iam-policy-binding "ocr-internal-token" \
    --member="serviceAccount:${email}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
done

gcloud secrets add-iam-policy-binding "database-password" \
  --member="serviceAccount:$(service_account_email "${VM_SERVICE_ACCOUNT}")" \
  --role="roles/secretmanager.secretAccessor" >/dev/null
gcloud secrets add-iam-policy-binding "better-auth-secret" \
  --member="serviceAccount:$(service_account_email "${VM_SERVICE_ACCOUNT}")" \
  --role="roles/secretmanager.secretAccessor" >/dev/null
gcloud secrets add-iam-policy-binding "resume-intel-bootstrap-token" \
  --member="serviceAccount:$(service_account_email "${VM_SERVICE_ACCOUNT}")" \
  --role="roles/secretmanager.secretAccessor" >/dev/null
gcloud secrets add-iam-policy-binding "litellm-api-key" \
  --member="serviceAccount:$(service_account_email "${VM_SERVICE_ACCOUNT}")" \
  --role="roles/secretmanager.secretAccessor" >/dev/null 2>&1 || true
gcloud secrets add-iam-policy-binding "operational-alert-webhook-url" \
  --member="serviceAccount:$(service_account_email "${VM_SERVICE_ACCOUNT}")" \
  --role="roles/secretmanager.secretAccessor" >/dev/null 2>&1 || true
gcloud secrets add-iam-policy-binding "apify-api-token" \
  --member="serviceAccount:$(service_account_email "${VM_SERVICE_ACCOUNT}")" \
  --role="roles/secretmanager.secretAccessor" >/dev/null 2>&1 || true
gcloud secrets add-iam-policy-binding "resend-api-key" \
  --member="serviceAccount:$(service_account_email "${VM_SERVICE_ACCOUNT}")" \
  --role="roles/secretmanager.secretAccessor" >/dev/null 2>&1 || true
gcloud secrets add-iam-policy-binding "google-oauth-client-id" \
  --member="serviceAccount:$(service_account_email "${VM_SERVICE_ACCOUNT}")" \
  --role="roles/secretmanager.secretAccessor" >/dev/null 2>&1 || true
gcloud secrets add-iam-policy-binding "google-oauth-client-secret" \
  --member="serviceAccount:$(service_account_email "${VM_SERVICE_ACCOUNT}")" \
  --role="roles/secretmanager.secretAccessor" >/dev/null 2>&1 || true
gcloud secrets add-iam-policy-binding "staging-google-oauth-client-id" \
  --member="serviceAccount:$(service_account_email "${VM_SERVICE_ACCOUNT}")" \
  --role="roles/secretmanager.secretAccessor" >/dev/null 2>&1 || true
gcloud secrets add-iam-policy-binding "staging-google-oauth-client-secret" \
  --member="serviceAccount:$(service_account_email "${VM_SERVICE_ACCOUNT}")" \
  --role="roles/secretmanager.secretAccessor" >/dev/null 2>&1 || true

echo "Secrets created/updated in Secret Manager."
echo "Generated secrets were not printed. Use Secret Manager if you need to rotate them."
