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

if [[ -z "${DATABASE_PASSWORD:-}" ]]; then
  DATABASE_PASSWORD="$(openssl rand -base64 32)"
fi
if [[ -z "${BETTER_AUTH_SECRET:-}" ]]; then
  BETTER_AUTH_SECRET="$(openssl rand -base64 48)"
fi
if [[ -z "${OCR_INTERNAL_TOKEN:-}" ]]; then
  OCR_INTERNAL_TOKEN="$(openssl rand -base64 48)"
fi
if [[ -z "${RESUME_INTEL_BOOTSTRAP_TOKEN:-}" ]]; then
  RESUME_INTEL_BOOTSTRAP_TOKEN="$(openssl rand -base64 32)"
fi

upsert_secret "database-password" "${DATABASE_PASSWORD}"
upsert_secret "better-auth-secret" "${BETTER_AUTH_SECRET}"
upsert_secret "ocr-internal-token" "${OCR_INTERNAL_TOKEN}"
upsert_secret "resume-intel-bootstrap-token" "${RESUME_INTEL_BOOTSTRAP_TOKEN}"

if [[ -n "${RESUME_INTEL_LITELLM_API_KEY:-}" ]]; then
  upsert_secret "litellm-api-key" "${RESUME_INTEL_LITELLM_API_KEY}"
else
  echo "Skipping litellm-api-key because RESUME_INTEL_LITELLM_API_KEY is not set."
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

echo "Secrets created/updated in Secret Manager."
echo "Generated secrets were not printed. Use Secret Manager if you need to rotate them."
