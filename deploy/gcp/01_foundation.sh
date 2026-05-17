#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

require_confirmation

gcloud artifacts repositories describe "${ARTIFACT_REPOSITORY}" --location="${REGION}" >/dev/null 2>&1 \
  || gcloud artifacts repositories create "${ARTIFACT_REPOSITORY}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="candidateSignal container images"

gsutil ls -b "gs://${DOCUMENT_BUCKET}" >/dev/null 2>&1 \
  || gsutil mb -p "${PROJECT_ID}" -l "${REGION}" -b on "gs://${DOCUMENT_BUCKET}"
gsutil uniformbucketlevelaccess set on "gs://${DOCUMENT_BUCKET}"

for account in "${VM_SERVICE_ACCOUNT}" "${OCR_SERVICE_ACCOUNT}" "${BUILD_SERVICE_ACCOUNT}"; do
  email="$(service_account_email "${account}")"
  gcloud iam service-accounts describe "${email}" >/dev/null 2>&1 \
    || gcloud iam service-accounts create "${account}" --display-name="${account}"
done

PROJECT_NUMBER="$(project_number)"
CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
BUILD_SA="$(service_account_email "${BUILD_SERVICE_ACCOUNT}")"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CLOUDBUILD_SA}" \
  --role="roles/artifactregistry.writer" >/dev/null
gcloud artifacts repositories add-iam-policy-binding "${ARTIFACT_REPOSITORY}" \
  --location="${REGION}" \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/artifactregistry.writer" >/dev/null
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/logging.logWriter" >/dev/null
if gcloud storage buckets describe "gs://${PROJECT_ID}_cloudbuild" >/dev/null 2>&1; then
  gcloud storage buckets add-iam-policy-binding "gs://${PROJECT_ID}_cloudbuild" \
    --member="serviceAccount:${BUILD_SA}" \
    --role="roles/storage.objectViewer" >/dev/null
fi

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:$(service_account_email "${VM_SERVICE_ACCOUNT}")" \
  --role="roles/cloudsql.client" >/dev/null
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:$(service_account_email "${VM_SERVICE_ACCOUNT}")" \
  --role="roles/storage.objectAdmin" >/dev/null
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:$(service_account_email "${VM_SERVICE_ACCOUNT}")" \
  --role="roles/secretmanager.secretAccessor" >/dev/null
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:$(service_account_email "${VM_SERVICE_ACCOUNT}")" \
  --role="roles/run.invoker" >/dev/null

echo "Foundation created."
echo "Artifact Registry: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPOSITORY}"
echo "Document bucket: gs://${DOCUMENT_BUCKET}"
echo "VM service account: $(service_account_email "${VM_SERVICE_ACCOUNT}")"
echo "OCR service account: $(service_account_email "${OCR_SERVICE_ACCOUNT}")"
echo "Build service account: $(service_account_email "${BUILD_SERVICE_ACCOUNT}")"
