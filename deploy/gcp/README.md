# Cheapest GCP Deployment

This deployment keeps GPU out of v1.

Runtime shape:

- Compute Engine VM: Next.js, FastAPI, parser worker.
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

The scripts that create resources require:

```bash
CONFIRM_CREATE_RESOURCES=1
```

This is intentional to avoid accidental Cloud SQL/VM/Cloud Run billing.

## Secrets

Set only the key you already have locally:

```bash
export RESUME_INTEL_LITELLM_API_KEY="..."
```

Other secrets are generated if omitted:

- `DATABASE_PASSWORD`
- `BETTER_AUTH_SECRET`
- `OCR_INTERNAL_TOKEN`
- `RESUME_INTEL_BOOTSTRAP_TOKEN`

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

Render the VM env locally:

```bash
deploy/gcp/06_render_vm_env.sh > /tmp/candidatesignal.env
```

Copy it to the VM:

```bash
gcloud compute scp /tmp/candidatesignal.env candidatesignal-app-1:/opt/candidatesignal/.env --zone=us-central1-a
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
- `VM_MACHINE_TYPE=e2-medium`
- `OCR_MIN_INSTANCES=0`
- `OCR_MAX_INSTANCES=1`
- `OCR_CPU=4`
- `OCR_MEMORY=16Gi`
- No GPU.
- No Cloud SQL HA.

Before real production traffic, turn on Cloud SQL backups and consider upgrading Cloud SQL to at least `db-g1-small` or a custom 1-2 vCPU tier.

## Security Notes

- OCR Cloud Run is deployed with `--no-allow-unauthenticated`.
- VM service account receives `roles/run.invoker`.
- Worker calls OCR with `OCR_REMOTE_AUTH=google_id_token`.
- Optional app-level OCR token is still passed as `X-OCR-Token`.
- Resume files are stored in private GCS.
- Raw CV preview must continue going through authenticated API routes.
