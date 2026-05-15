#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

require_confirmation

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPOSITORY}/ocr:latest"

gcloud builds submit "${ROOT_DIR}" \
  --config="${ROOT_DIR}/deploy/gcp/cloudbuild.ocr.yaml" \
  --substitutions="_IMAGE=${IMAGE}"

gcloud run deploy "${OCR_SERVICE}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --service-account="$(service_account_email "${OCR_SERVICE_ACCOUNT}")" \
  --cpu="${OCR_CPU}" \
  --memory="${OCR_MEMORY}" \
  --timeout="${OCR_TIMEOUT}" \
  --concurrency=1 \
  --min-instances="${OCR_MIN_INSTANCES}" \
  --max-instances="${OCR_MAX_INSTANCES}" \
  --no-cpu-throttling \
  --no-allow-unauthenticated \
  --set-secrets="OCR_INTERNAL_TOKEN=ocr-internal-token:latest" \
  --set-env-vars="LIGHTONOCR_MODEL=lightonai/LightOnOCR-2-1B-base,OCR_MAX_NEW_TOKENS=4096"

OCR_URL="$(gcloud run services describe "${OCR_SERVICE}" --region="${REGION}" --format='value(status.url)')"

gcloud run services add-iam-policy-binding "${OCR_SERVICE}" \
  --region="${REGION}" \
  --member="serviceAccount:$(service_account_email "${VM_SERVICE_ACCOUNT}")" \
  --role="roles/run.invoker" >/dev/null

echo "OCR Cloud Run deployed."
echo "OCR URL: ${OCR_URL}"
echo "Set worker env:"
echo "OCR_MODE=remote"
echo "OCR_REMOTE_URL=${OCR_URL}"
echo "OCR_REMOTE_AUTH=google_id_token"
echo "OCR_REMOTE_AUDIENCE=${OCR_URL}"
echo "OCR_REMOTE_TOKEN_FILE=/path/to/ocr-internal-token"
