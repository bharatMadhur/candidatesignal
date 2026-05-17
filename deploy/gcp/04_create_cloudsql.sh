#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

require_confirmation

DATABASE_PASSWORD_VALUE="${DATABASE_PASSWORD:-}"
if [[ -z "${DATABASE_PASSWORD_VALUE}" ]]; then
  DATABASE_PASSWORD_VALUE="$(gcloud secrets versions access latest --secret=database-password)"
fi

gcloud sql instances describe "${SQL_INSTANCE}" >/dev/null 2>&1 \
  || gcloud sql instances create "${SQL_INSTANCE}" \
    --database-version=POSTGRES_16 \
    --edition="${SQL_EDITION}" \
    --tier="${SQL_TIER}" \
    --region="${REGION}" \
    --storage-type=SSD \
    --storage-size="${SQL_STORAGE_GB}" \
    --availability-type=ZONAL \
    --no-backup

gcloud sql databases describe "${SQL_DATABASE}" --instance="${SQL_INSTANCE}" >/dev/null 2>&1 \
  || gcloud sql databases create "${SQL_DATABASE}" --instance="${SQL_INSTANCE}"

gcloud sql users describe "${SQL_USER}" --instance="${SQL_INSTANCE}" >/dev/null 2>&1 \
  || gcloud sql users create "${SQL_USER}" --instance="${SQL_INSTANCE}" --password="${DATABASE_PASSWORD_VALUE}"

echo "Cloud SQL ready."
echo "Instance: ${SQL_INSTANCE}"
echo "Database: ${SQL_DATABASE}"
echo "User: ${SQL_USER}"
echo "Note: this script uses the cheapest zonal/no-HA default. Enable backups before production traffic."
