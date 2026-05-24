# Cheapest GCP Deployment

This deployment keeps GPU out of v1.

Runtime shape:

- Compute Engine VM: Next.js, FastAPI, parser worker.
- Caddy on the VM: HTTPS, apex-to-www redirect, `/api/*` reverse proxy to FastAPI.
- Cloud SQL PostgreSQL: tenant data, candidates, jobs, matches, embeddings.
- GCS: uploaded resumes, requirement files, document artifacts.
- Cloud Run CPU OCR: LightOnOCR service, min instances `0`, max instances `1`, concurrency `1`.

OCR is conditional:

- DOCX: direct extraction.
- Text PDF: native PDF extraction.
- Scanned PDF: Cloud Run CPU OCR only for low-text pages.
- Image resume: Cloud Run CPU OCR.

## Current GCP Project

```bash
gcloud config set project candidatesignal
gcloud config set run/region us-central1
gcloud config set compute/region us-central1
gcloud config set compute/zone us-central1-a
```

APIs required:

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com \
  compute.googleapis.com \
  iam.googleapis.com \
  vpcaccess.googleapis.com
```

## Before Creating Paid Resources

Copy the example config:

```bash
cp deploy/gcp/env.example deploy/gcp/env.local
```

Review `deploy/gcp/env.local`.

Default domain routing:

```bash
APEX_DOMAIN=candidatesignal.ai
WWW_DOMAIN=www.candidatesignal.ai
APP_DOMAIN=app.candidatesignal.ai
STAGING_DOMAIN=staging.candidatesignal.ai
```

The app is served at `https://app.candidatesignal.ai`; `https://candidatesignal.ai` and
`https://www.candidatesignal.ai` redirect to the app until a separate marketing site exists.
The browser calls FastAPI through the Next.js backend proxy at `https://app.candidatesignal.ai/api/backend`.

The scripts that create resources require:

```bash
CONFIRM_CREATE_RESOURCES=1
```

This is intentional to avoid accidental Cloud SQL/VM/Cloud Run billing.

## Secrets

Set the key you already have locally, or keep it in the project root `.env`.
The secrets script reads these `.env` names automatically, in order:

- `RESUME_INTEL_LITELLM_API_KEY`
- `MINION_LITELLM_API_KEY`
- `LITELLM_API_KEY`
- `OPENAI_API_KEY`
- `LLM_API_KEY`

```bash
export RESUME_INTEL_LITELLM_API_KEY="..."
```

Other secrets are generated if omitted:

- `DATABASE_PASSWORD`
- `BETTER_AUTH_SECRET`
- `OCR_INTERNAL_TOKEN`
- `RESUME_INTEL_BOOTSTRAP_TOKEN`

Optional external alert delivery:

- `RESUME_INTEL_ALERT_WEBHOOK_URL`

If this is unset, worker failures, OCR warnings, stale indexes, and dead-letter
alerts stay visible in the in-app Operations view only. Set it only to a
company-owned webhook endpoint because alert payloads include operational
metadata.

Optional product email through Resend:

- `RESUME_INTEL_MAIL_ENABLED`
- `RESUME_INTEL_MAIL_DRY_RUN`
- `RESUME_INTEL_MAIL_FROM_EMAIL`
- `RESUME_INTEL_APP_BASE_URL`
- `RESEND_API_KEY`

Keep `RESUME_INTEL_MAIL_DRY_RUN=1` until the sending domain is verified in
Resend. Invitation emails are stored in Postgres as mail messages even when
delivery is disabled or dry-run.

Create/update secrets:

```bash
CONFIRM_CREATE_RESOURCES=1 deploy/gcp/02_secrets.sh
```

Secrets are stored in Secret Manager, not committed.

## Resource Creation Order

```bash
deploy/gcp/00_preflight.sh
CONFIRM_CREATE_RESOURCES=1 deploy/gcp/01_foundation.sh
CONFIRM_CREATE_RESOURCES=1 deploy/gcp/02_secrets.sh
CONFIRM_CREATE_RESOURCES=1 deploy/gcp/04_create_cloudsql.sh
CONFIRM_CREATE_RESOURCES=1 deploy/gcp/03_deploy_ocr_cloud_run.sh
CONFIRM_CREATE_RESOURCES=1 deploy/gcp/05_create_vm.sh
```

## Protected Staging

Staging is designed as a cheap but safe test ground on the same VM:

- `https://staging.candidatesignal.ai`
- Cookie-based staging gate before the app is visible.
- `X-Robots-Tag: noindex, nofollow, noarchive`.
- Separate Cloud SQL database and database user.
- Separate GCS document bucket.
- Separate Better Auth secret and bootstrap token.
- Separate `secrets-staging/` mount.
- Visible `Staging Environment` banner in the UI.

Create staging resources after production foundation/Cloud SQL exists:

```bash
CONFIRM_CREATE_RESOURCES=1 deploy/gcp/09_create_staging_resources.sh
```

The script stores the staging gate password in Secret Manager as
`staging-basic-auth-password` and renders a one-way hash into the VM env. Retrieve
the password only when needed:

```bash
gcloud secrets versions access latest --secret=staging-basic-auth-password
```

Render and copy both production and staging runtime files:

```bash
RENDER_VM_ENV_OUTPUT_DIR=/tmp/candidatesignal-vm deploy/gcp/06_render_vm_env.sh
gcloud compute scp /tmp/candidatesignal-vm/.env candidatesignal-app-1:/opt/candidatesignal/.env --zone=us-central1-a
gcloud compute scp /tmp/candidatesignal-vm/secrets/* candidatesignal-app-1:/opt/candidatesignal/secrets/ --zone=us-central1-a
gcloud compute scp /tmp/candidatesignal-vm/secrets-staging/* candidatesignal-app-1:/opt/candidatesignal/secrets-staging/ --zone=us-central1-a
```

Deploy staging from Git:

```bash
git push origin HEAD:staging
STAGING_GIT_REF=staging deploy/gcp/10_deploy_staging.sh
```

Use staging for feature work and QA. Do not copy production resumes into staging
unless they are anonymized or explicitly approved test samples.

## Release Flow

Do not deploy production directly from local working tree state. The intended
flow is:

```text
feature/codex branch -> staging branch -> staging deploy -> main or release tag -> production deploy
```

Deploy staging from the shared staging branch:

```bash
git push origin HEAD:staging
STAGING_GIT_REF=staging deploy/gcp/10_deploy_staging.sh
```

Promote only after staging QA passes:

```bash
git checkout main
git pull --ff-only origin main
git merge --ff-only staging
git push origin main
PRODUCTION_GIT_REF=main deploy/gcp/11_deploy_production.sh
```

For a tagged release instead:

```bash
git tag release-YYYYMMDD
git push origin release-YYYYMMDD
PRODUCTION_GIT_REF=release-YYYYMMDD deploy/gcp/11_deploy_production.sh
```

`deploy/gcp/11_deploy_production.sh` refuses production deploys from arbitrary
feature branches unless `ALLOW_NON_PRODUCTION_REF=1` is set deliberately. That
escape hatch is for emergency rollback or hotfix only.

## Cheap Data Protection Defaults

The deployment keeps the database zonal and small, but enables the minimum
production safety net:

```bash
SQL_BACKUP_START_TIME=09:00
SQL_BACKUP_RETENTION_COUNT=8
SQL_PITR_RETENTION_DAYS=3
```

This enables automated Cloud SQL backups, point-in-time recovery, and deletion
protection without upgrading to HA or a larger database tier. To enable this on
an already-created Cloud SQL instance:

```bash
CONFIRM_CREATE_RESOURCES=1 deploy/gcp/07_enable_cloudsql_protection.sh
```

Uploaded documents are stored in the private GCS bucket with object versioning
enabled. Noncurrent object versions are deleted after 30 days to control storage
cost while still protecting against accidental file overwrites/deletes.

Verify the current storage and network posture:

```bash
deploy/gcp/08_verify_security_posture.sh
```

## VM App Bootstrap

SSH to the VM:

```bash
gcloud compute ssh candidatesignal-app-1 --zone=us-central1-a
```

Clone the repo into `/opt/candidatesignal`:

```bash
cd /opt/candidatesignal
git clone https://github.com/bharatMadhur/candidatesignal.git .
```

Render the VM env bundle locally. The `.env` file contains non-secret runtime
configuration. Secret values are rendered into separate files under
`secrets/`, which is mounted read-only into the API, worker, and UI containers.

```bash
RENDER_VM_ENV_OUTPUT_DIR=/tmp/candidatesignal-vm deploy/gcp/06_render_vm_env.sh
```

Copy it to the VM:

```bash
gcloud compute scp /tmp/candidatesignal-vm/.env candidatesignal-app-1:/opt/candidatesignal/.env --zone=us-central1-a
gcloud compute scp /tmp/candidatesignal-vm/secrets/* candidatesignal-app-1:/opt/candidatesignal/secrets/ --zone=us-central1-a
gcloud compute scp /tmp/candidatesignal-vm/secrets-staging/* candidatesignal-app-1:/opt/candidatesignal/secrets-staging/ --zone=us-central1-a
```

On the VM:

```bash
cd /opt/candidatesignal
docker compose -f docker-compose.gcp.yml --env-file .env up -d --build
docker compose -f docker-compose.gcp.yml --env-file .env ps
```

Run migrations:

```bash
docker compose -f docker-compose.gcp.yml --env-file .env exec api python scripts/migrate_db.py
```

## Cheapest Defaults

- `SQL_TIER=db-f1-micro`
- `SQL_EDITION=enterprise`
- `SQL_BACKUP_RETENTION_COUNT=8`
- `SQL_PITR_RETENTION_DAYS=3`
- `VM_MACHINE_TYPE=e2-medium`
- `OCR_MIN_INSTANCES=0`
- `OCR_MAX_INSTANCES=1`
- `OCR_CPU=4`
- `OCR_MEMORY=16Gi`
- OCR Cloud Run uses request CPU throttling for cheaper idle behavior.
- No GPU.
- No Cloud SQL HA.

Before heavier production traffic, consider upgrading Cloud SQL to at least
`db-g1-small` or a custom 1-2 vCPU tier. Keep backups/PITR enabled.

## Security Notes

- OCR Cloud Run is deployed with `--no-allow-unauthenticated`.
- VM service account receives `roles/run.invoker`.
- Worker calls OCR with `OCR_REMOTE_AUTH=google_id_token`.
- Optional app-level OCR token is still passed as `X-OCR-Token`.
- Runtime secrets are mounted as local secret files, not stored as literal values
  in the Docker Compose environment.
- Resume files are stored in private GCS.
- Raw CV preview must continue going through authenticated API routes.
- Cloud SQL should have no authorized public networks. The current cheapest
  deployment connects through Cloud SQL Auth Proxy; private IP/PSC or HA is a
  later paid topology upgrade.

## DNS

After the VM is created, get the public IP:

```bash
gcloud compute instances describe candidatesignal-app-1 \
  --zone=us-central1-a \
  --format="get(networkInterfaces[0].accessConfigs[0].natIP)"
```

Create DNS records at your domain provider:

```text
Type: A
Name: @
Value: <VM_PUBLIC_IP>

Type: A
Name: www
Value: <VM_PUBLIC_IP>

Type: A
Name: app
Value: <VM_PUBLIC_IP>

Type: A
Name: staging
Value: <VM_PUBLIC_IP>
```
