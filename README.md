# candidateSignal.ai

Production-style HR resume intelligence system for tenant-isolated resume parsing, recruiter notes, semantic search, candidate versioning, job campaigns, and requirement matching.

## Architecture

- FastAPI API: `src/resume_intel/web.py`
- Next.js UI: `web/`
- Postgres + pgvector: canonical data, jobs, sessions, tenants, candidates, requirements, matches
- Local OCR: LightOnOCR through `OCR_COMMAND`
- LLM: LiteLLM/OpenAI-compatible multi-pass extraction
- Better Auth: Next.js auth route at `/api/auth/[...all]`, using the shared Postgres auth tables
- Async parsing: durable `parse_batches` and `parse_jobs`
- Storage adapter: local provider by default, no S3 assumption
- Real semantic search: LiteLLM/OpenAI-compatible embeddings with pgvector evidence chunks
- Tenant analytics: normalized, non-PII counts for skills, domains, companies, locations, countries, schools, and experience bands

## Setup

```bash
cd /Users/madhuragarwal/Desktop/code/personal/nonATS/resume_intel
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
pip install -e .
cd web
npm install
cd ..
cp .env.example .env
docker compose up -d postgres
.venv/bin/python scripts/migrate_db.py
```

## Run Locally

API:

```bash
.venv/bin/uvicorn resume_intel.web:app --host 127.0.0.1 --port 8010
```

UI:

```bash
cd web
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Worker:

```bash
.venv/bin/python scripts/run_parse_worker.py
```

Process only one queued job:

```bash
.venv/bin/python scripts/run_parse_worker.py --once
```

## Tenancy

Every company is a tenant. Every business row is tenant-scoped:

- candidates
- notes
- requirements
- requirement matches
- candidate-version matches
- candidate embeddings
- requirement embeddings
- parse batches/jobs
- audit logs
- candidate documents
- document pages
- candidate search chunks
- LLM usage events

V1 assumes one company per user. Recruiters see the full tenant candidate database.

Companies can now self-register from the public homepage. The signup flow creates an active tenant, a tenant-owner user, and a Better Auth credential account in one transaction, then the UI signs the owner into the recruiter workspace. Set `RESUME_INTEL_SELF_SIGNUP_ENABLED=0` if onboarding should return to invite-only.

Platform admins can still create tenants through `/admin/tenants`. Tenant admins manage members through `/team`.

Platform admin company onboarding:

```text
1. Log in as platform admin.
2. Open Admin Console.
3. Add company name, seat limit, and first company admin email.
4. The API creates the tenant and a tenant-owner invitation.
5. Send the generated invite link to the company owner.
6. The owner accepts the invite and then invites recruiters from Team Settings.
```

Admin endpoints:

```text
POST /auth/company-signup
GET /admin/tenants
POST /admin/tenants
GET /admin/tenants/{tenant_id}
POST /admin/tenants/{tenant_id}/disable
POST /admin/tenants/{tenant_id}/reactivate
POST /team/invitations/accept
```

## Auth

The project now includes Better Auth route/config in `web/lib/auth.ts` and `web/app/api/auth/[...all]/route.ts`.

The FastAPI API validates bearer session tokens against the shared `sessions` table and resolves:

- `user.id`
- `platform_role`
- `tenant_id`
- `tenant_role`

Better Auth is the primary login path:

```text
POST /api/auth/sign-in/email
POST /api/auth/sign-in/social
POST /api/auth/sign-out
```

Candidate Google login is also handled by Better Auth. Add these to enable it:

```env
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
```

The Google OAuth redirect URI must be:

```text
https://your-ui-host/api/auth/callback/google
```

Fresh Google users are finalized through `POST /auth/candidate-oauth/finalize`, which converts only new OAuth users with no tenant membership into candidate accounts. Existing recruiter/admin Google accounts are not silently converted.

FastAPI validates the Better Auth bearer token against the shared `sessions` table. Legacy FastAPI password login is disabled by default and returns `410` unless `RESUME_INTEL_ENABLE_LEGACY_AUTH=1` is set for local debugging.

Bootstrap remains available for first setup:

```text
POST /auth/bootstrap
GET /auth/me
POST /auth/logout
```

Once a platform admin exists, `/auth/bootstrap` is rejected unless `RESUME_INTEL_BOOTSTRAP_TOKEN` is configured and supplied in the request body as `setup_token`.

Login split:

```text
/              Single public homepage with embedded login.
/?login=admin  Platform admin mode for company/seat management only.
/?login=company Recruiter workspace mode for recruiter workflows.
```

There are no standalone `/login` or `/admin/login` pages. Admins and recruiters share the homepage entry surface, then route to separate post-login workspaces by role.

Local dev credentials are seeded only for localhost/non-production runs:

```text
Admin:     admin@example.com / resume-intel
Recruiter: recruiter@example.com / resume-intel
```

## Governance

Tenant admins control data governance from Team Settings:

- external LLM synthesis opt-in
- PII redaction before external LLM calls
- which tenant roles can view contact PII

Candidate contact PII access is written to `pii_access_events`. Copilot synthesis over candidate data remains disabled unless the tenant policy explicitly enables it. When enabled, synthesis uses the configured LiteLLM/OpenAI-compatible provider, redacts PII by default, records usage in `llm_usage_events`, and falls back to deterministic evidence-ranked output if the provider fails.

```text
GET /team
PATCH /team/governance-policy
```

## Bulk Upload

Bulk upload creates durable jobs instead of blocking the request.

```text
POST /resumes/bulk-upload
GET /parse-batches
GET /parse-batches/{id}
GET /parse-jobs/{id}
POST /parse-jobs/{id}/retry
GET /parse-worker/status
```

Job stages:

```text
queued
running
extracting_text
llm_factual_pass
saving
succeeded
failed
retrying
cancelled
```

For production, keep API and worker as separate processes. Recruiter bulk upload, campaign matching, and candidate-side resume uploads only queue jobs by default; run the worker separately for parsing and matching work.

The worker writes heartbeats to Postgres so the UI can show online/offline state, queued/running/failed counts, current worker status, last heartbeat, and last error. Worker health counts include recruiter resume parsing and campaign matching. Global worker checks also include candidate-portal resume uploads; tenant workspace checks intentionally do not mix candidate-owned uploads into a company queue.

```bash
.venv/bin/python scripts/run_parse_worker.py
.venv/bin/python scripts/run_parse_worker.py --once --worker-id smoke-worker
```

Worker priority order is recruiter parse jobs, candidate resume uploads, then campaign match jobs. Candidate uploads are durable rows in Postgres and can be retried from the candidate workspace if parsing fails.

If historical smoke jobs or interrupted jobs need cleanup, reconcile them explicitly:

```bash
.venv/bin/python scripts/reconcile_parse_jobs.py --stale-after-hours 24
```

Operational alerts are surfaced in the UI:

```text
GET /operational-alerts
POST /operational-alerts/{id}/acknowledge
GET /operational-alert-deliveries
```

Alert sources:

- processing worker offline while parsing or matching work is queued
- parse jobs moved into file-review after exhausting retries
- stale/missing semantic embeddings
- OCR or extraction quality warnings

External alert delivery is opt-in:

```env
RESUME_INTEL_ALERT_WEBHOOK_URL=
RESUME_INTEL_ALERT_WEBHOOK_TIMEOUT_SECONDS=5
```

When configured, newly created operational alerts are posted to the webhook and delivery attempts are stored in `operational_alert_deliveries`.

## Candidate Maintenance

Deterministic candidate repairs must run through queued maintenance jobs, not one-off manual scripts. Use this after changing local derivation logic such as timeline accounting, domain-year caps, country/location detection, coverage scoring, or normalized analytics.

Default behavior is local-only:

- does not call OCR
- does not call the resume parsing LLM
- does not refresh external embeddings
- preserves existing candidate documents, notes, candidate intelligence, and audit history

Tenant admins can start this from Operations -> Candidate Intelligence Maintenance.

```text
GET /maintenance/candidate-rederive-jobs
POST /maintenance/candidates/rederive
POST /maintenance/candidate-rederive-jobs/{id}/retry
POST /maintenance/candidate-rederive-jobs/{id}/cancel
```

Embedding refresh is intentionally blocked unless explicitly enabled:

```env
RESUME_INTEL_ALLOW_MAINTENANCE_EMBEDDING_REFRESH=1
```

The legacy script still exists for local repair work, but production use should prefer the queued job:

```bash
.venv/bin/python scripts/reindex_candidates.py --skip-embeddings
```

## Auth, Tenant Isolation, And Privacy

Better Auth is the primary login/session system. The Next.js auth route issues the signed bearer token, and FastAPI verifies that Better Auth signature before accepting any API request.

Production requirements:

```env
BETTER_AUTH_SECRET=use-a-long-random-secret-shared-by-ui-and-api
BETTER_AUTH_URL=https://your-ui-host
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
RESUME_INTEL_ENABLE_LEGACY_AUTH=0
RESUME_INTEL_ALLOW_UNSIGNED_BETTER_AUTH_BEARER=0
```

Security model:

- Recruiters belong to exactly one tenant through `tenant_memberships`.
- Platform admins can create/manage companies, seats, invites, and tenant status.
- Platform admins are blocked from recruiter candidate APIs and cannot view tenant candidate data.
- Recruiter APIs always derive `tenant_id` from the authenticated session, never from a client-provided tenant id.
- Contact/source CV PII visibility is tenant-governed by `contact_pii_visible_to_roles`.
- Original CV preview, raw text, page text, candidate detail PII, and PII-bearing search/list responses are written to `pii_access_events`.

Privacy audit endpoints:

```text
GET /team/pii-access-events
```

This endpoint is tenant-owner/admin only and appears in Team Settings as the PII Access Audit panel.

## Storage

All upload/preview/worker file access goes through `DocumentStorage`.

Providers:

```text
local: data/documents/{tenant_id}/{namespace}/{sha256-prefix}.{ext}
database: document_blobs bytea storage with a local processing/preview cache
gcs: Google Cloud Storage object storage with a local processing/preview cache
```

The database stores canonical metadata:

```text
storage_backend
storage_key
original_filename
mime_type
size_bytes
sha256
tenant_id
uploaded_by_user_id
```

Do not build new features against absolute local paths. `source_file` exists only for legacy/debug compatibility.

Configure storage:

```env
RESUME_INTEL_STORAGE_BACKEND=local
RESUME_INTEL_LOCAL_STORAGE_ROOT=
RESUME_INTEL_GCS_BUCKET=
```

Use `RESUME_INTEL_STORAGE_BACKEND=database` when document bytes should live in Postgres instead of local disk. The parser still receives a temporary local processing path through the storage adapter.

Use `RESUME_INTEL_STORAGE_BACKEND=gcs` when uploaded documents should live in Google Cloud Storage. The service account running the API/worker needs bucket object read/write/delete permissions, and `google-cloud-storage` must be installed in the runtime image.

## OCR

Scanned PDFs use local OCR when native PDF text extraction is insufficient.

```env
OCR_MODE=external
OCR_COMMAND=/Users/madhuragarwal/Desktop/code/personal/nonATS/resume_intel/.venv/bin/python /Users/madhuragarwal/Desktop/code/personal/nonATS/resume_intel/scripts/lightonocr_wrapper.py
```

Download LightOnOCR locally:

```bash
.venv/bin/python scripts/setup_lightonocr.py
```

Model/cache paths stay inside this project:

```text
models/
.cache/
```

The parser stores extraction observability:

```text
document_pages.page_number
document_pages.extraction_method
document_pages.raw_text
document_pages.quality_flags
candidate._metadata.extraction_method
candidate._metadata.page_count
```

## LLM

The parser uses a multi-pass LiteLLM/OpenAI-compatible flow:

- factual extraction
- document text audit
- timeline analysis
- HR intelligence
- evidence audit
- final candidate profile

Configure in `.env`:

```env
RESUME_INTEL_LITELLM_BASE_URL=https://api.openai.com/v1
RESUME_INTEL_LITELLM_API_KEY=
RESUME_INTEL_LITELLM_MODEL=openai/gpt-5-nano
RESUME_INTEL_EMBEDDING_MODEL=openai/text-embedding-3-small
RESUME_INTEL_EMBEDDING_DIMENSIONS=1536
```

## Semantic Search

Candidate search indexes:

- structured summary
- skills
- experience
- recruiter notes
- countries/locations
- raw extracted resume text chunks
- original page-level text
- AI intelligence
- education/certifications

This preserves recall when the LLM misses a skill but the raw resume text contains it.

Real embeddings are stored in `candidate_search_chunks` with `embedding vector(1536)`. The endpoint returns matched evidence snippets:

```text
POST /candidates/search
```

Rebuild embeddings after changing the embedding model or parser:

```bash
.venv/bin/python scripts/reindex_candidates.py
```

Rebuild normalized analytics tables after adding columns or importing historical data:

```bash
.venv/bin/python scripts/rebuild_normalized_analytics.py
```

Read normalized workspace analytics without exposing contact data:

```text
GET /analytics/workspace
```

Embeddings require `RESUME_INTEL_LITELLM_API_KEY` or `OPENAI_API_KEY` by default. For local-only smoke tests, set `RESUME_INTEL_ALLOW_HASH_EMBEDDING_FALLBACK=1` to use the deterministic fallback. Keep that fallback disabled in production.

## Requirement Matching

Requirement intake supports pasted text and uploaded PDF/DOCX/TXT/MD:

```text
POST /requirements
POST /requirements/upload
POST /requirements/{id}/clarify
POST /requirements/{id}/finalize
POST /requirements/{id}/match
GET /requirements/{id}/matches
POST /requirements/{id}/matches/{candidate_id}/shortlist
POST /requirements/{id}/matches/{candidate_id}/reject
```

Ranking combines deterministic hard/soft scoring with semantic search evidence and keeps match actions persisted.

## Candidate Versioning

Duplicate uploads are preserved as candidate versions. The system no longer auto-merges or exposes a production merge workflow by default.

```text
GET /candidate-versions/clusters
POST /candidate-versions/{match_id}/versioned
POST /candidate-versions/{match_id}/separate
POST /candidate-versions/{match_id}/review-later
```

Legacy merge endpoint returns `410` because copies are kept as versions for auditability.

## Candidate Detail APIs

```text
GET /candidates/{id}
GET /candidates/{id}/document-preview
GET /candidates/{id}/raw-text
GET /candidates/{id}/pages
POST /candidates/{id}/notes
PATCH /candidates/{id}/notes/{note_id}
DELETE /candidates/{id}/notes/{note_id}
```

## LinkedIn Import And Verification

Recruiters can create a candidate from a LinkedIn profile URL when they do not have a resume yet. The imported profile becomes a normal tenant-scoped candidate record and can optionally be attached to a campaign.

```text
POST /candidates/linkedin-imports
GET /candidates/linkedin-imports
GET /candidates/linkedin-imports/{import_id}
```

Recruiters can also verify a candidate's parsed LinkedIn URL from the candidate report. Verification compares profile identity, role history, education, certifications, location, and freshness against the saved candidate record.

```text
POST /candidates/{id}/linkedin/verify
GET /candidates/{id}/linkedin/verification
```

LinkedIn imports and verification require contact-PII permission because fetched profile data can contain names, locations, profile URLs, profile photos, role history, education, and certifications. Raw external profile data is stored tenant-scoped for the customer company; recruiter notes remain separate from external profile data.

## Verification

```bash
.venv/bin/python -m compileall -q src scripts
.venv/bin/python -m pytest
cd web
npm run build
npm run smoke
npm run e2e
npm run launch:check
```

`npm run smoke` expects the Next.js UI to be running and defaults to `http://127.0.0.1:3001`. Override with `SMOKE_BASE_URL=https://your-host`.

`npm run e2e` runs Playwright. The public homepage/legacy-route check always runs. `npm run launch:check` is stricter: it runs lint, build, and authenticated Playwright, and fails if the dedicated recruiter/candidate test credentials are missing.

```env
E2E_COMPANY_EMAIL=recruiter@example.com
E2E_COMPANY_PASSWORD=resume-intel
E2E_CANDIDATE_EMAIL=candidate@example.com
E2E_CANDIDATE_PASSWORD=resume-intel
```

Use `E2E_BASE_URL=https://your-host` to run the same suite against an already-running local or deployed UI.

Smoke endpoints:

```bash
curl -s http://127.0.0.1:8010/health
curl -s http://127.0.0.1:8010/healthz/deep
curl -s http://127.0.0.1:8010/candidates -H "Authorization: Bearer <token>"
curl -s http://127.0.0.1:8010/parse-batches -H "Authorization: Bearer <token>"
curl -s http://127.0.0.1:8010/parse-worker/status -H "Authorization: Bearer <token>"
curl -s http://127.0.0.1:8010/operational-alerts -H "Authorization: Bearer <token>"
curl -s -X POST http://127.0.0.1:8010/candidates/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"query":"python ai cloud","limit":3}'
```

## Docker

Local production-shaped stack:

```bash
export BETTER_AUTH_SECRET="$(openssl rand -base64 48)"
export RESUME_INTEL_LITELLM_API_KEY="sk-..."
docker compose up --build postgres api worker ui
```

The compose file mounts `BETTER_AUTH_SECRET` and `RESUME_INTEL_LITELLM_API_KEY` as Docker secrets, then exposes only `*_FILE` paths inside containers. This avoids putting LLM keys directly in service environment blocks.

Docker does not reuse the local `.venv` OCR command from `.env`. If OCR is installed inside the API image or mounted container, set `DOCKER_OCR_MODE=external` and `DOCKER_OCR_COMMAND="..."`.

## Product Email

The mail layer is provider-agnostic. V1 uses Resend for company/team invitations, while keeping delivery records in Postgres so failed sends can be inspected and retried.

Local defaults are safe:

```env
RESUME_INTEL_MAIL_ENABLED=0
RESUME_INTEL_MAIL_DRY_RUN=1
RESUME_INTEL_MAIL_PROVIDER=resend
RESUME_INTEL_MAIL_FROM_EMAIL=no-reply@candidatesignal.ai
RESUME_INTEL_APP_BASE_URL=http://127.0.0.1:3001
RESEND_API_KEY=
```

To send real email, verify the sending domain in Resend, then set:

```env
RESUME_INTEL_MAIL_ENABLED=1
RESUME_INTEL_MAIL_DRY_RUN=0
RESEND_API_KEY=re_...
```

Operational APIs:

```text
GET  /mail/messages
POST /mail/messages/{message_id}/retry
```

Services:

```text
postgres  pgvector Postgres
api       FastAPI on :8010
worker    durable parse-job worker
ui        Next.js on :3001
```

Health checks:

```text
GET /healthz
GET /readyz
GET /healthz/deep
```

## Backups

Database backup:

```bash
DATABASE_URL=postgresql://... BACKUP_DIR=backups scripts/backup_postgres.sh
```

Backups are database-only. Uploaded document storage depends on the configured `DocumentStorage` provider and must be backed up separately.

Restore:

```bash
CONFIRM_RESTORE=yes DATABASE_URL=postgresql://... scripts/restore_postgres.sh backups/candidateSignal_YYYYMMDDTHHMMSSZ.dump
```

Production config check:

```bash
.venv/bin/python scripts/check_production_config.py
```

## Migrations

The current schema keeps a consolidated baseline for local development and supports versioned migration modules under:

```text
src/resume_intel/migrations/versions/
```

Run migrations with:

```bash
.venv/bin/python scripts/migrate_db.py
```

## Remaining Production Hardening

- Expand browser smoke tests into full Playwright/API suites.
- Add OCR page-level confidence if LightOnOCR exposes calibrated confidence.
- Add billing/seat enforcement dashboard.
- Add external error tracking provider integration.
