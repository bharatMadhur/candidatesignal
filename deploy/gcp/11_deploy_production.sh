#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

REMOTE_DIR="${REMOTE_DIR:-/opt/candidatesignal}"
PRODUCTION_GIT_REF="${PRODUCTION_GIT_REF:-main}"

if [[ "${ALLOW_NON_PRODUCTION_REF:-}" != "1" ]]; then
  if [[ "${PRODUCTION_GIT_REF}" != "main" && "${PRODUCTION_GIT_REF}" != release-* && "${PRODUCTION_GIT_REF}" != refs/tags/release-* ]]; then
    echo "Refusing production deploy from '${PRODUCTION_GIT_REF}'." >&2
    echo "Use PRODUCTION_GIT_REF=main or a release-* tag, or set ALLOW_NON_PRODUCTION_REF=1 intentionally." >&2
    exit 1
  fi
fi

echo "Deploying production from Git ref: ${PRODUCTION_GIT_REF}"
echo "Target VM: ${VM_NAME} (${ZONE})"

gcloud compute ssh "${VM_NAME}" --zone="${ZONE}" --command="
set -euo pipefail
cd '${REMOTE_DIR}'
git fetch --tags origin
if git rev-parse --verify --quiet 'origin/${PRODUCTION_GIT_REF}' >/dev/null; then
  git checkout --detach 'origin/${PRODUCTION_GIT_REF}'
else
  git fetch origin '${PRODUCTION_GIT_REF}'
  git checkout --detach FETCH_HEAD
fi
docker compose -f docker-compose.gcp.yml --env-file .env up -d --build api worker ui
docker compose -f docker-compose.gcp.yml --env-file .env up -d --no-deps --force-recreate caddy
docker compose -f docker-compose.gcp.yml --env-file .env exec -T api python scripts/migrate_db.py
docker compose -f docker-compose.gcp.yml --env-file .env ps api worker ui caddy
"

echo "Production deployed from ${PRODUCTION_GIT_REF}."
echo "Verify: https://${APP_DOMAIN}"
