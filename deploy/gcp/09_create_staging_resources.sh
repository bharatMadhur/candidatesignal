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

random_secret() {
  openssl rand -base64 "${1:-32}"
}

sha256_staging_password() {
  local password="$1"
  python3 -c 'import hashlib, sys; print(hashlib.sha256(sys.argv[1].encode("utf-8")).hexdigest())' "${password}"
}

if [[ -z "${STAGING_DATABASE_PASSWORD:-}" ]]; then
  if secret_exists "staging-database-password"; then
    STAGING_DATABASE_PASSWORD="$(read_secret "staging-database-password")"
  else
    STAGING_DATABASE_PASSWORD="$(random_secret 32)"
  fi
fi

if [[ -z "${STAGING_BETTER_AUTH_SECRET:-}" ]]; then
  if secret_exists "staging-better-auth-secret"; then
    STAGING_BETTER_AUTH_SECRET="$(read_secret "staging-better-auth-secret")"
  else
    STAGING_BETTER_AUTH_SECRET="$(random_secret 48)"
  fi
fi

if [[ -z "${STAGING_BOOTSTRAP_TOKEN:-}" ]]; then
  if secret_exists "staging-resume-intel-bootstrap-token"; then
    STAGING_BOOTSTRAP_TOKEN="$(read_secret "staging-resume-intel-bootstrap-token")"
  else
    STAGING_BOOTSTRAP_TOKEN="$(random_secret 32)"
  fi
fi

if [[ -z "${STAGING_GATE_PASSWORD:-}" ]]; then
  if secret_exists "staging-basic-auth-password"; then
    STAGING_GATE_PASSWORD="$(read_secret "staging-basic-auth-password")"
  else
    STAGING_GATE_PASSWORD="$(random_secret 18)"
  fi
fi

STAGING_GATE_PASSWORD_HASH_VALUE="${STAGING_GATE_PASSWORD_HASH:-$(sha256_staging_password "${STAGING_GATE_PASSWORD}")}"

gsutil ls -b "gs://${STAGING_DOCUMENT_BUCKET}" >/dev/null 2>&1 \
  || gsutil mb -p "${PROJECT_ID}" -l "${REGION}" -b on "gs://${STAGING_DOCUMENT_BUCKET}"
gsutil uniformbucketlevelaccess set on "gs://${STAGING_DOCUMENT_BUCKET}"
gsutil versioning set on "gs://${STAGING_DOCUMENT_BUCKET}"
gsutil lifecycle set "${SCRIPT_DIR}/gcs-lifecycle.json" "gs://${STAGING_DOCUMENT_BUCKET}"

gcloud sql databases describe "${STAGING_SQL_DATABASE}" --instance="${SQL_INSTANCE}" >/dev/null 2>&1 \
  || gcloud sql databases create "${STAGING_SQL_DATABASE}" --instance="${SQL_INSTANCE}"

gcloud sql users describe "${STAGING_SQL_USER}" --instance="${SQL_INSTANCE}" >/dev/null 2>&1 \
  || gcloud sql users create "${STAGING_SQL_USER}" --instance="${SQL_INSTANCE}" --password="${STAGING_DATABASE_PASSWORD}"
gcloud sql users set-password "${STAGING_SQL_USER}" --instance="${SQL_INSTANCE}" --password="${STAGING_DATABASE_PASSWORD}" >/dev/null

upsert_secret "staging-database-password" "${STAGING_DATABASE_PASSWORD}"
upsert_secret "staging-better-auth-secret" "${STAGING_BETTER_AUTH_SECRET}"
upsert_secret "staging-resume-intel-bootstrap-token" "${STAGING_BOOTSTRAP_TOKEN}"
upsert_secret "staging-basic-auth-password" "${STAGING_GATE_PASSWORD}"
upsert_secret "staging-gate-password-hash" "${STAGING_GATE_PASSWORD_HASH_VALUE}"

for secret in \
  staging-database-password \
  staging-better-auth-secret \
  staging-resume-intel-bootstrap-token \
  staging-basic-auth-password \
  staging-gate-password-hash; do
  gcloud secrets add-iam-policy-binding "${secret}" \
    --member="serviceAccount:$(service_account_email "${VM_SERVICE_ACCOUNT}")" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
done

echo "Staging resources ready."
echo "Domain: https://${STAGING_DOMAIN}"
echo "Database: ${STAGING_SQL_DATABASE}"
echo "Database user: ${STAGING_SQL_USER}"
echo "Document bucket: gs://${STAGING_DOCUMENT_BUCKET}"
echo "Staging gate password stored in Secret Manager: staging-basic-auth-password"
