#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

REMOTE_DIR="${REMOTE_DIR:-/opt/candidatesignal}"
STAGING_GIT_REF="${STAGING_GIT_REF:-staging}"

echo "Deploying staging from Git ref: ${STAGING_GIT_REF}"
echo "Target VM: ${VM_NAME} (${ZONE})"

gcloud compute ssh "${VM_NAME}" --zone="${ZONE}" --command="
set -euo pipefail
cd '${REMOTE_DIR}'
git fetch --tags origin
if git rev-parse --verify --quiet 'origin/${STAGING_GIT_REF}' >/dev/null; then
  git checkout --detach 'origin/${STAGING_GIT_REF}'
else
  git fetch origin '${STAGING_GIT_REF}'
  git checkout --detach FETCH_HEAD
fi
export RESUME_INTEL_BUILD_SHA=\$(git rev-parse --short=12 HEAD)
docker compose -f docker-compose.gcp.yml --env-file .env --profile staging up -d --build api-staging worker-staging ui-staging
docker compose -f docker-compose.gcp.yml --env-file .env up -d --no-deps --force-recreate caddy
docker compose -f docker-compose.gcp.yml --env-file .env exec -T api-staging python scripts/migrate_db.py
docker compose -f docker-compose.gcp.yml --env-file .env ps api-staging worker-staging ui-staging caddy
"

echo "Staging deployed from ${STAGING_GIT_REF}."
echo "Verify: https://${STAGING_DOMAIN}"
