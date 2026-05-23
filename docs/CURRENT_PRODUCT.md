# candidateSignal.ai Current Product

This is the current product reference. It replaces the old running-issues document so implementation, deployment, and support do not depend on stale route or workflow notes.

## Product Shape

- Homepage contains the public value proposition and the login surface.
- Platform admins use admin mode from `/?login=admin`.
- Company users use company mode from `/?login=company`.
- There are no standalone `/login` or `/admin/login` pages.
- Platform admins manage companies, seats, invitations, audit summaries, and tenant status.
- Platform admins do not enter the recruiter workspace.
- Company users work inside one tenant/company workspace.

## Recruiter Workflows

- Upload resumes individually or in bulk.
- Upload campaign-specific resumes into a campaign while also adding them to the main candidate database.
- Parse PDF, DOCX, text, markdown, and image resume formats.
- Preserve the original CV, raw extracted text, document pages, extraction method, OCR flags, structured JSON, notes, and LLM usage metadata.
- Search candidates with Copilot using semantic chunks, structured fields, raw CV text, location signals, and recruiter notes.
- Create campaigns, upload or paste requirements, edit scorecards, run matching, shortlist/reject candidates, and track pipeline stages.
- View candidate intelligence with facts, AI notes, timeline, evidence, original CV, recruiter notes, and candidate versions.

## Data And Privacy

- Postgres is the source of truth.
- Every tenant-owned row must have `tenant_id`.
- Candidate versioning replaces destructive duplicate merging.
- Matching candidates by PII/name/company creates version suggestions, not automatic merges.
- Candidate archive/remove actions are soft deletes from active recruiter workflows; source documents, notes, versions, and audit history remain preserved.
- Campaign archive/remove actions are soft deletes from active campaign lists; campaign activity is preserved.
- Contact PII visibility is role-gated and audited.
- External LLM synthesis over candidate data is tenant opt-in and should redact PII by default.

## Technical Shape

- FastAPI owns tenant-scoped APIs, parsing jobs, matching, storage, and data persistence.
- Next.js owns Better Auth, homepage, admin workspace, recruiter workspace, and API proxying.
- Parse work is async through durable batches/jobs and worker processing.
- Storage goes through the document-storage abstraction.
- Semantic search uses LiteLLM/OpenAI-compatible embeddings and pgvector.
- Requirement embeddings use the same real embedding path as candidate search chunks.
- Versioned migrations live in `src/resume_intel/migrations/versions/`.

## Verification Targets

- Backend unit tests must pass before deployment.
- Next.js build must pass before deployment.
- `npm run smoke` should pass against a running UI.
- `npm run e2e` should pass public-route checks and should run authenticated recruiter checks when `E2E_COMPANY_EMAIL` and `E2E_COMPANY_PASSWORD` are provided.
- Tenant isolation, candidate versioning, Copilot filtering, matching, upload, and auth flows need regression coverage when changed.
