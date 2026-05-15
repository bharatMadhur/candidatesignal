#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Zone: ${ZONE}"
echo

gcloud config set project "${PROJECT_ID}" >/dev/null
gcloud config set run/region "${REGION}" >/dev/null
gcloud config set compute/region "${REGION}" >/dev/null
gcloud config set compute/zone "${ZONE}" >/dev/null

echo "Active gcloud config:"
gcloud config list

echo
echo "Enabled APIs check:"
gcloud services list --enabled \
  --filter="name:(run.googleapis.com OR sqladmin.googleapis.com OR artifactregistry.googleapis.com OR secretmanager.googleapis.com OR cloudbuild.googleapis.com OR storage.googleapis.com OR compute.googleapis.com OR iam.googleapis.com OR vpcaccess.googleapis.com)" \
  --format="value(config.name)"
