#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

if [[ "${1:-}" == "" ]]; then
  echo "usage: scripts/restore_postgres.sh <backup.dump>" >&2
  exit 1
fi

if [[ "${CONFIRM_RESTORE:-}" != "yes" ]]; then
  echo "Set CONFIRM_RESTORE=yes to restore. This can overwrite database objects." >&2
  exit 1
fi

pg_restore "$1" --dbname "$DATABASE_URL" --clean --if-exists --no-owner --no-acl
echo "restored $1"

