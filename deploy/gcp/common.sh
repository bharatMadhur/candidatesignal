#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

dotenv_get() {
  local file="$1"
  local key="$2"
  [[ -f "${file}" ]] || return 0
  awk -v target="${key}" '
    /^[[:space:]]*#/ { next }
    /^[[:space:]]*$/ { next }
    {
      line=$0
      sub(/^[[:space:]]*export[[:space:]]+/, "", line)
      split(line, parts, "=")
      k=parts[1]
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", k)
      if (k != target) next
      value=line
      sub(/^[^=]*=/, "", value)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      if ((substr(value, 1, 1) == "\"" && substr(value, length(value), 1) == "\"") ||
          (substr(value, 1, 1) == "'"'"'" && substr(value, length(value), 1) == "'"'"'")) {
        value=substr(value, 2, length(value)-2)
      }
      print value
      exit
    }
  ' "${file}"
}

if [[ -f "${ROOT_DIR}/deploy/gcp/env.local" ]]; then
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/deploy/gcp/env.local"
elif [[ -f "${ROOT_DIR}/deploy/gcp/env.example" ]]; then
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/deploy/gcp/env.example"
fi

PROJECT_ID="${PROJECT_ID:-candidatesignal}"
REGION="${REGION:-us-central1}"
ZONE="${ZONE:-us-central1-a}"
APEX_DOMAIN="${APEX_DOMAIN:-candidatesignal.ai}"
WWW_DOMAIN="${WWW_DOMAIN:-www.candidatesignal.ai}"
APP_DOMAIN="${APP_DOMAIN:-app.candidatesignal.ai}"
ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-candidatesignal}"
DOCUMENT_BUCKET="${DOCUMENT_BUCKET:-candidatesignal-prod-documents}"
SQL_INSTANCE="${SQL_INSTANCE:-candidatesignal-postgres}"
SQL_EDITION="${SQL_EDITION:-enterprise}"
SQL_DATABASE="${SQL_DATABASE:-resume_intel}"
SQL_USER="${SQL_USER:-resume_intel}"
SQL_TIER="${SQL_TIER:-db-f1-micro}"
SQL_STORAGE_GB="${SQL_STORAGE_GB:-20}"
SQL_BACKUP_START_TIME="${SQL_BACKUP_START_TIME:-09:00}"
SQL_BACKUP_RETENTION_COUNT="${SQL_BACKUP_RETENTION_COUNT:-8}"
SQL_PITR_RETENTION_DAYS="${SQL_PITR_RETENTION_DAYS:-3}"
OCR_SERVICE="${OCR_SERVICE:-candidatesignal-ocr}"
OCR_CPU="${OCR_CPU:-4}"
OCR_MEMORY="${OCR_MEMORY:-16Gi}"
OCR_TIMEOUT="${OCR_TIMEOUT:-3600}"
OCR_MAX_INSTANCES="${OCR_MAX_INSTANCES:-1}"
OCR_MIN_INSTANCES="${OCR_MIN_INSTANCES:-0}"
VM_NAME="${VM_NAME:-candidatesignal-app-1}"
VM_MACHINE_TYPE="${VM_MACHINE_TYPE:-e2-medium}"
VM_BOOT_DISK_SIZE="${VM_BOOT_DISK_SIZE:-30GB}"
VM_SERVICE_ACCOUNT="${VM_SERVICE_ACCOUNT:-cs-vm-sa}"
OCR_SERVICE_ACCOUNT="${OCR_SERVICE_ACCOUNT:-cs-ocr-sa}"
BUILD_SERVICE_ACCOUNT="${BUILD_SERVICE_ACCOUNT:-cs-build-sa}"

if [[ -z "${RESUME_INTEL_LITELLM_API_KEY:-}" ]]; then
  for key_name in RESUME_INTEL_LITELLM_API_KEY MINION_LITELLM_API_KEY LITELLM_API_KEY OPENAI_API_KEY LLM_API_KEY; do
    value="$(dotenv_get "${ROOT_DIR}/.env" "${key_name}")"
    if [[ -n "${value}" ]]; then
      RESUME_INTEL_LITELLM_API_KEY="${value}"
      RESUME_INTEL_LITELLM_API_KEY_SOURCE="${key_name} in .env"
      break
    fi
  done
fi

RESUME_INTEL_LITELLM_BASE_URL="${RESUME_INTEL_LITELLM_BASE_URL:-$(dotenv_get "${ROOT_DIR}/.env" RESUME_INTEL_LITELLM_BASE_URL)}"
RESUME_INTEL_LITELLM_BASE_URL="${RESUME_INTEL_LITELLM_BASE_URL:-https://api.openai.com/v1}"
RESUME_INTEL_LITELLM_MODEL="${RESUME_INTEL_LITELLM_MODEL:-$(dotenv_get "${ROOT_DIR}/.env" RESUME_INTEL_LITELLM_MODEL)}"
RESUME_INTEL_LITELLM_MODEL="${RESUME_INTEL_LITELLM_MODEL:-openai/gpt-5-nano}"
RESUME_INTEL_EMBEDDING_MODEL="${RESUME_INTEL_EMBEDDING_MODEL:-$(dotenv_get "${ROOT_DIR}/.env" RESUME_INTEL_EMBEDDING_MODEL)}"
RESUME_INTEL_EMBEDDING_MODEL="${RESUME_INTEL_EMBEDDING_MODEL:-openai/text-embedding-3-small}"
APIFY_API_TOKEN="${APIFY_API_TOKEN:-$(dotenv_get "${ROOT_DIR}/.env" APIFY_API_TOKEN)}"
LINKEDIN_APIFY_ACTOR_ID="${LINKEDIN_APIFY_ACTOR_ID:-$(dotenv_get "${ROOT_DIR}/.env" LINKEDIN_APIFY_ACTOR_ID)}"
LINKEDIN_APIFY_ACTOR_ID="${LINKEDIN_APIFY_ACTOR_ID:-LpVuK3Zozwuipa5bp}"
LINKEDIN_APIFY_SCRAPER_MODE="${LINKEDIN_APIFY_SCRAPER_MODE:-$(dotenv_get "${ROOT_DIR}/.env" LINKEDIN_APIFY_SCRAPER_MODE)}"
LINKEDIN_APIFY_SCRAPER_MODE="${LINKEDIN_APIFY_SCRAPER_MODE:-Profile details no email (\$4 per 1k)}"

require_confirmation() {
  if [[ "${CONFIRM_CREATE_RESOURCES:-}" != "1" ]]; then
    echo "Refusing to create paid resources. Re-run with CONFIRM_CREATE_RESOURCES=1 after reviewing the script."
    exit 1
  fi
}

project_number() {
  gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)"
}

service_account_email() {
  local account_name="$1"
  echo "${account_name}@${PROJECT_ID}.iam.gserviceaccount.com"
}
