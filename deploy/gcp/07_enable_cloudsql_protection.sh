#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

require_confirmation

echo "Enabling low-cost Cloud SQL protection for ${SQL_INSTANCE}..."
echo "Backup start time UTC: ${SQL_BACKUP_START_TIME}"
echo "Retained automated backups: ${SQL_BACKUP_RETENTION_COUNT}"
echo "PITR transaction-log retention days: ${SQL_PITR_RETENTION_DAYS}"

gcloud sql instances patch "${SQL_INSTANCE}" \
  --backup-start-time="${SQL_BACKUP_START_TIME}" \
  --retained-backups-count="${SQL_BACKUP_RETENTION_COUNT}" \
  --enable-point-in-time-recovery \
  --retained-transaction-log-days="${SQL_PITR_RETENTION_DAYS}" \
  --deletion-protection \
  --quiet

gcloud sql instances describe "${SQL_INSTANCE}" \
  --format="table(name,settings.backupConfiguration.enabled,settings.backupConfiguration.pointInTimeRecoveryEnabled,settings.backupConfiguration.transactionLogRetentionDays,settings.backupConfiguration.startTime,settings.backupConfiguration.backupRetentionSettings.retainedBackups,settings.deletionProtectionEnabled)"
