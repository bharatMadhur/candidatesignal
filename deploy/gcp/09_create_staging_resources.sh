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

hash_staging_password() {
  local password="$1"
  if [[ -n "${STAGING_BASIC_AUTH_HASH:-}" ]]; then
    printf "%s" "${STAGING_BASIC_AUTH_HASH}"
    return 0
  fi
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is required to hash STAGING_BASIC_AUTH_PASSWORD, or set STAGING_BASIC_AUTH_HASH yourself." >&2
    exit 1
  fi
  docker run --rm caddy:2.8-alpine caddy hash-password --plaintext "${password}"
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

if [[ -z "${STAGING_BASIC_AUTH_PASSWORD:-}" ]]; then
  if secret_exists "staging-basic-auth-password"; then
    STAGING_BASIC_AUTH_PASSWORD="$(read_secret "staging-basic-auth-password")"
  else
    STAGING_BASIC_AUTH_PASSWORD="$(random_secret 18)"
  fi
fi

STAGING_BASIC_AUTH_HASH_VALUE="$(hash_staging_password "${STAGING_BASIC_AUTH_PASSWORD}")"

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
upsert_secret "staging-basic-auth-password" "${STAGING_BASIC_AUTH_PASSWORD}"
upsert_secret "staging-basic-auth-password-hash" "${STAGING_BASIC_AUTH_HASH_VALUE}"

for secret in \
  staging-database-password \
  staging-better-auth-secret \
  staging-resume-intel-bootstrap-token \
  staging-basic-auth-password \
  staging-basic-auth-password-hash; do
  gcloud secrets add-iam-policy-binding "${secret}" \
    --member="serviceAccount:$(service_account_email "${VM_SERVICE_ACCOUNT}")" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
done

echo "Staging resources ready."
echo "Domain: https://${STAGING_DOMAIN}"
echo "Database: ${STAGING_SQL_DATABASE}"
echo "Database user: ${STAGING_SQL_USER}"
echo "Document bucket: gs://${STAGING_DOCUMENT_BUCKET}"
echo "Basic Auth username: ${STAGING_BASIC_AUTH_USER}"
echo "Basic Auth password stored in Secret Manager: staging-basic-auth-password"
