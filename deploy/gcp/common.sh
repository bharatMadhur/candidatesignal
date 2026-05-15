#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

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
ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-candidatesignal}"
DOCUMENT_BUCKET="${DOCUMENT_BUCKET:-candidatesignal-prod-documents}"
SQL_INSTANCE="${SQL_INSTANCE:-candidatesignal-postgres}"
SQL_DATABASE="${SQL_DATABASE:-resume_intel}"
SQL_USER="${SQL_USER:-resume_intel}"
SQL_TIER="${SQL_TIER:-db-f1-micro}"
SQL_STORAGE_GB="${SQL_STORAGE_GB:-20}"
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
