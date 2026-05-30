#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="${ROOT_DIR}/web"

BASE_URL="${E2E_BASE_URL:-https://staging.candidatesignal.ai}"
GATE_SECRET="${E2E_STAGING_GATE_SECRET:-staging-basic-auth-password}"
COMPANY_EMAIL_SECRET="${E2E_COMPANY_EMAIL_SECRET:-e2e-company-email}"
COMPANY_PASSWORD_SECRET="${E2E_COMPANY_PASSWORD_SECRET:-e2e-company-password}"
CANDIDATE_EMAIL_SECRET="${E2E_CANDIDATE_EMAIL_SECRET:-e2e-candidate-email}"
CANDIDATE_PASSWORD_SECRET="${E2E_CANDIDATE_PASSWORD_SECRET:-e2e-candidate-password}"

secret_value() {
  local name="$1"
  gcloud secrets versions access latest --secret="${name}"
}

export E2E_BASE_URL="${BASE_URL}"
export E2E_STAGING_GATE_PASSWORD
export E2E_COMPANY_EMAIL
export E2E_COMPANY_PASSWORD
export E2E_CANDIDATE_EMAIL
export E2E_CANDIDATE_PASSWORD

E2E_STAGING_GATE_PASSWORD="$(secret_value "${GATE_SECRET}")"
E2E_COMPANY_EMAIL="$(secret_value "${COMPANY_EMAIL_SECRET}")"
E2E_COMPANY_PASSWORD="$(secret_value "${COMPANY_PASSWORD_SECRET}")"
E2E_CANDIDATE_EMAIL="$(secret_value "${CANDIDATE_EMAIL_SECRET}")"
E2E_CANDIDATE_PASSWORD="$(secret_value "${CANDIDATE_PASSWORD_SECRET}")"

cd "${WEB_DIR}"
npm run e2e:auth-required
