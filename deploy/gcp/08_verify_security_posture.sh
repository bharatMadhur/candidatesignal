#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

errors=0

bucket_versioning="$(gsutil versioning get "gs://${DOCUMENT_BUCKET}" 2>/dev/null || true)"
if [[ "${bucket_versioning}" != *"Enabled"* ]]; then
  echo "error: GCS object versioning is not enabled on gs://${DOCUMENT_BUCKET}" >&2
  errors=$((errors + 1))
else
  echo "ok: GCS object versioning enabled on gs://${DOCUMENT_BUCKET}"
fi

authorized_networks="$(gcloud sql instances describe "${SQL_INSTANCE}" --format='value(settings.ipConfiguration.authorizedNetworks[].value)' 2>/dev/null || true)"
if [[ -n "${authorized_networks}" ]]; then
  echo "error: Cloud SQL has authorized public networks configured: ${authorized_networks}" >&2
  errors=$((errors + 1))
else
  echo "ok: Cloud SQL has no authorized public networks"
fi

ipv4_enabled="$(gcloud sql instances describe "${SQL_INSTANCE}" --format='value(settings.ipConfiguration.ipv4Enabled)' 2>/dev/null || true)"
ssl_mode="$(gcloud sql instances describe "${SQL_INSTANCE}" --format='value(settings.ipConfiguration.sslMode)' 2>/dev/null || true)"
if [[ "${ipv4_enabled}" == "True" || "${ipv4_enabled}" == "true" ]]; then
  echo "warning: Cloud SQL public IPv4 is enabled. This is acceptable for the current Cloud SQL Auth Proxy setup only if authorized networks remain empty."
fi
if [[ "${ssl_mode}" == "ALLOW_UNENCRYPTED_AND_ENCRYPTED" || -z "${ssl_mode}" ]]; then
  echo "warning: Cloud SQL direct SSL is not strict. Keep all app traffic through Cloud SQL Auth Proxy until private IP/PSC is added."
fi

if [[ "${errors}" -gt 0 ]]; then
  exit 1
fi

echo "Security posture checks passed."
