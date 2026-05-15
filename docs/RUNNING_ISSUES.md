# candidatSignal.ai Running Issues List

Last reviewed: 2026-05-13

This is the living list of known product, UI, backend, auth, data, and operations issues. Keep this file updated as items are fixed.

## P0 - Newly Confirmed Product Direction

1. Product/app name is `candidatSignal.ai`.
   - Status: implemented in the live UI metadata, top navigation brand, landing screen, and API title.
   - Remaining change: finish renaming legacy internal package/code identifiers only if a full technical rename is desired.

2. Platform Admin and Recruiter App are separate products.
   - Status: fixed for current implementation.
   - Current behavior: platform admins remain in Admin System only and cannot enter tenant recruiter workspaces.
   - Current behavior: platform admins create companies, set seat limits, invite company owners/admins, and disable/reactivate companies without seeing recruiter workflows, candidate records, CV previews, or AI usage metrics.
   - Required guardrail: platform admins should not browse or operate the recruiter app. If support access is ever needed, design it later as an explicit audited support mode, not normal admin navigation.

3. Company users own the Recruiter App.
   - Status: fixed for current model.
   - Current behavior: invited tenant/company users access the recruiter workspace for their company only.
   - Required change: continue hardening backend route permissions so tenant-scoped data never leaks across companies.

4. Campaign system is now a core workflow.
   - Status: first implementation added.
   - Current behavior: job campaigns can be created from a role description, linked to a requirement profile, matched against the company candidate DB, and accept new resume uploads into the campaign while also adding them to the main resume database.
   - Current behavior: campaign detail now shows upload batch history, progress bars, shortlist/reject state, and compact evidence/gap chips.
   - Remaining change: add richer campaign analytics and multi-run comparison after more production usage data exists.

5. PII/link extraction is required.
   - Status: implemented deterministically for email, phone, LinkedIn, GitHub, portfolio websites, and all CV URLs.
   - Current behavior: PII/link signals are stored in candidate JSON, shown in Candidate Detail, included in primary ID coverage, and indexed into semantic search chunks.
   - Current behavior: Team Settings includes PII/AI governance controls for contact visibility roles, external LLM synthesis opt-in, and PII redaction before external LLM calls.
   - Current behavior: candidate contact PII access is audited in `pii_access_events`.
   - Remaining change: add export-specific permissions before production.

6. Pranjal-style domain-year overcount must not happen.
   - Status: fixed in deterministic domain-year accounting.
   - Current behavior: domain months are unioned by month and no longer double-count overlapping roles in the same domain.
   - Current behavior: date parsing now handles months like `2022-12` correctly.
   - Remaining change: reindex/rederive existing candidates after deployment.

7. The following production backlog items are explicitly accepted.
   - Better Auth primary login: implemented. FastAPI legacy password login is disabled by default; FastAPI validates Better Auth bearer sessions from the shared sessions table.
   - Versioned migration runner: implemented. A consolidated baseline remains, but future migrations can live under `src/resume_intel/migrations/versions/`.
   - Tenant-approved LLM synthesis inside saved Copilot threads: implemented behind tenant opt-in, PII redaction, usage audit, and deterministic fallback.
   - Normalized analytics tables for skills, experience, education, certifications, locations, countries, and domain-years: implemented with a rebuild script.
   - Docker API/UI/worker packaging: implemented.
   - More tenant-isolation and workflow tests: partially implemented; expand API/browser tests before production deployment.

8. Dedicated file-review operations are required.
   - Status: implemented for current production-local shape.
   - Current behavior: tenant users have an Operations page with worker health, parse queue counts, recent batches, per-file job actions, and file-review retry/acknowledge actions.
   - Current behavior: operational alerts cover worker-offline, failed-file review, stale embedding, and OCR/extraction quality warning conditions.
   - Current behavior: external webhook delivery is opt-in through `RESUME_INTEL_ALERT_WEBHOOK_URL`, with delivery attempts stored in `operational_alert_deliveries`.
   - Remaining production change: connect a customer-specific Slack/email/Sentry destination in deployment config.

9. Saved Copilot threads are required.
   - Status: implemented for current production-local shape.
   - Current behavior: Copilot messages are persisted per tenant, saved threads can be reopened/archived, and assistant messages retain candidate snapshots, questions, and suggested actions.
   - Current behavior: a saved Copilot thread can be converted into a requirement draft using recruiter/user messages.
   - Current behavior: tenant-approved LLM synthesis over retrieved evidence is implemented and gated by company admin policy; default remains deterministic/no external transfer.

10. DOCX rendered preview is required.
   - Status: improved.
   - Current behavior: authenticated `/candidates/{id}/document-html` renders DOCX/TXT/MD into escaped HTML, and Candidate Detail shows DOCX inline instead of forcing the recruiter to leave the app.
   - Current behavior: DOCX preview preserves headings, bullet/numbered list styling, basic emphasis, and tables with header rows.
   - Remaining production change: pixel-perfect Word/PDF conversion would require an external renderer such as LibreOffice in deployment.

11. Versioned migrations are required.
   - Status: migration runner added.
   - Current behavior: `schema_migrations` records the consolidated legacy baseline, `scripts/migrate_db.py` prints applied versions, and future migration modules are applied from `src/resume_intel/migrations/versions/`.
   - Remaining production change: stop growing the legacy consolidated function for new schema changes.

## P0 - Security And Tenant Isolation

1. Admin and company-user entry are mixed in the same undifferentiated login experience.
   - Status: fixed for current implementation. Platform admins now land in a separate Admin System shell and cannot enter the recruiter app/company workspace.
   - Current behavior: the login screen has explicit Company Workspace and Platform Admin entry modes, clears stale bearer tokens before login, rejects wrong-mode accounts, and routes by authenticated role.
   - Why this is wrong: a platform admin and a company recruiter have different mental models, permissions, and risk profiles. The UI does not clearly say whether the user is entering the platform admin console or a company workspace.
   - Required change: keep one auth backend if desired, but split the post-login experience clearly:
     - Platform Admin Console for app owner/admins.
     - Company Workspace for tenant users.
     - Do not show tenant operational screens to platform admins.
     - Add a clear workspace banner: `Platform Admin` vs `Company: <name>`.

2. Platform admin currently also has tenant context.
   - Status: fixed for current implementation.
   - Current behavior: platform admin login defaults to `workspace_access=platform_admin` with no `tenant_id`; tenant-scoped APIs return `403 tenant membership required`.
   - Current behavior: platform admins cannot select or enter a company recruiter workspace. Company operations require a real company user login.
   - Why this is wrong: platform admins should manage companies without accidentally operating inside a company's candidate DB.
   - Remaining change: expose workspace-selection audit reason text and consider read-only impersonation mode for stricter production deployments.

3. Open admin bootstrap endpoint is unsafe.
   - Status: fixed for current implementation. Bootstrap now rejects once a platform admin exists unless `RESUME_INTEL_BOOTSTRAP_TOKEN` is configured and supplied.
   - Current code: `POST /auth/bootstrap` creates a platform admin without existing authentication.
   - Risk: anyone with API access can create or overwrite a platform admin account in local or deployed environments.
   - Required change: protect bootstrap with a one-time setup token, disable it after first admin exists, or remove it for production.

4. Existing user password can be overwritten during user creation.
   - Status: fixed for current implementation. User creation no longer overwrites an existing password on email conflict.
   - Current behavior: `create_user()` uses `on conflict(email) do update` and writes a new password hash.
   - Risk: invite/bootstrap flows can accidentally reset credentials.
   - Required change: do not overwrite passwords on conflict unless going through a dedicated password reset or invite-acceptance flow.

5. Better Auth is only partially integrated.
   - Status: fixed for current implementation.
   - Current behavior: Next.js Better Auth is the primary password login and session issuer. FastAPI legacy password login is disabled unless `RESUME_INTEL_ENABLE_LEGACY_AUTH=1`.
   - Remaining production change: continue consolidating auth helpers around Better Auth terminology and add password reset / invite acceptance hardening.

6. Better Auth URL config still points to port 3000.
   - Status: fixed in `.env.example`, README, Docker Compose, and Better Auth default config.
   - Current reality: UI is running on port 3001 because another project owns 3000.
   - Current behavior: local dev credentials use valid email domains so Better Auth no longer rejects the documented login examples.

## P1 - Core Workflow Reliability

1. Single resume upload still blocks the API request.
   - Status: fixed for current implementation. `POST /resumes/upload` now returns `202`, creates a parse batch/job, and the UI polls active batches with batch/job progress bars.
   - Current behavior: single upload queues deep parsing; parsing runs through the worker or optional background job flow.
   - Why this is wrong: deep parsing can take a long time and can fail due OCR/LLM/network issues.
   - Required change: single upload should create a parse job, return `202`, and let the UI poll job progress.
   - UI requirement: show a clear progress bar for the upload/parse lifecycle, not just text status.
   - Progress should include stages such as uploaded, queued, extracting text/OCR, factual LLM pass, deep intelligence passes, saving candidate, embedding/indexing, candidate-version check, and completed/failed.
   - Bulk upload should show both batch-level progress and per-file progress bars.
   - Failed stages should show the exact failed step and a retry action.

2. Bulk upload works conceptually but has stale queued jobs and mixed statuses.
   - Status: fixed for current local DB and supported by `scripts/reconcile_parse_jobs.py`.
   - Current behavior: historical `completed` jobs were normalized to `succeeded`, old smoke queued jobs were cancelled with an explicit reconciliation message, and batch counts were refreshed.
   - Remaining production hardening: add worker heartbeat/file-review metrics so stale jobs are visible before manual reconciliation.

3. Candidate document/page observability is missing for current data.
   - Status: fixed for existing local data with legacy limitations.
   - Current DB state: `scripts/backfill_document_metadata.py` backfilled 4 candidate documents and 4 document pages.
   - Caveat: legacy candidates without page-level parse metadata use a single `legacy_single_page_backfill` page until they are reparsed.

4. Original CV preview still relies on legacy `source_file` fallback for existing candidates.
   - Status: fixed for existing local data after document metadata backfill.
   - Current behavior: preview can resolve through canonical `candidate_documents` and storage metadata; legacy fallback remains only as a compatibility path.

5. API exposes absolute local paths.
   - Status: fixed for candidate list/detail/search and parse job APIs.
   - Current behavior: public responses return filenames/storage keys/preview endpoints, not canonical absolute `/Users/...` paths.

6. Requirement flow skips the finalized lifecycle in UI.
   - Status: fixed for current implementation.
   - Current behavior: UI now separates extract -> lock finalized profile -> rank candidates, and displays the locked final profile before matching.

7. Requirement match actions rerun matching.
   - Status: fixed for current implementation.
   - Current behavior: shortlist/reject update the persisted match row and mutate the current UI row without rerunning ranking.

8. Candidate versioning replaces entity merge.
   - Status: fixed for current implementation.
   - Current behavior: possible duplicate uploads are preserved as candidate versions. The UI supports Mark as Versions, Keep Separate, and Review Later. The merge API route is disabled and returns `410`.
   - Current behavior: Candidate Versions now shows a version timeline with upload/file/storage/parse/extraction/token/size metadata and backend-generated field-level differences.
   - Remaining change: rename legacy internal DB/API table names away from `entity_resolution_*` and add richer version history after multiple uploads for the same candidate.

## P1 - UI And Product Experience

### Login

1. Admin and regular user entry are not separated.
   - Status: fixed for current implementation.
   - Current behavior: login now shows separate explanatory entry cards for Company Workspace and Platform Admin, clears stale local tokens before sign-in, rejects platform admins in Company Login, rejects company users in Admin Login, rejects wrong-mode saved sessions on `/login` and `/admin/login`, and strongly labels the post-login shell.
   - Current behavior: physical `/login` and `/admin/login` routes now render locked company/admin entry modes.

2. `Create local platform admin` appears on the public login screen.
   - Status: fixed for current implementation.
   - Current behavior: the bootstrap button is hidden in production builds and remains visible only in development.

3. No tenant/company selector or explanation.
   - Status: fixed for current implementation.
   - Current behavior: company users see their tenant context immediately; platform admins have no active tenant context and cannot silently land in `local-dev`.

### Sidebar / Shell

1. Platform Admin and tenant workspace navigation are mixed.
   - Status: fixed for current implementation.
   - Current behavior: platform admin mode shows the Admin System/company-management shell only; the company workspace has its own recruiter navigation.
   - Current behavior: Admin System now includes tenant drill-down for members, invites, recent candidates, parse jobs, requirements, and audit events.
   - Remaining production change: split audit logs and usage/limits into dedicated admin pages as the app grows.

2. Sidebar naming is inconsistent.
   - Status: fixed for current implementation.
   - Current behavior: workspace nav uses `Upload`, `Requirements`, `Matches`, and `Team Settings`; admin nav uses `Company Management`.
   - Remaining production change: make `Matches` a historical match-run page, not just current in-memory results.

3. Workspace identity is weak.
   - Status: fixed for current implementation.
   - Current behavior: top-nav account settings show the actual tenant name and formatted user role; the admin system labels company onboarding only. Platform admins never see tenant workspace navigation.

4. Responsive/mobile layout is broken.
   - Status: partially addressed.
   - Current behavior: the recruiter workspace uses a top navigation shell instead of the removed sidebar; smaller screens wrap the top nav and account actions.
   - Remaining production change: build a true mobile drawer with a compact command/search entry.

5. Global search is confusing.
   - Status: fixed for current implementation.
   - Current behavior: the top search input appears only on Resume Database. Other tenant pages show a contextual action/banner that routes users to candidate search or points them to Copilot.

### Recruiter Copilot / Chat

1. Chat interface was missing.
   - Status: fixed for current implementation.
   - Current behavior: `Recruiter Copilot` is a first-class company-workspace page backed by tenant-scoped semantic search over structured profile data, recruiter notes, locations/countries, and raw extracted CV text.
   - Current behavior: Copilot now has an explicit result-count selector instead of a hidden hardcoded 6-result request.
   - Current behavior: short entity/company queries require direct evidence, so `cerner` returns only candidates with Cerner evidence instead of every profile.
   - Current behavior: Copilot results have post-output filters for relevance/recency, minimum score, exact evidence, country, and seniority.
   - Current behavior: Copilot includes a Requirement HITL tab where recruiters can upload/paste a requirement, answer generated clarification questions, lock the profile, and rank candidates.
   - Current behavior: Copilot threads are persisted per tenant and can be reopened or archived.
   - Current behavior: Copilot threads can be converted into requirement drafts.
   - Current behavior: LLM synthesis over retrieved evidence is implemented behind tenant opt-in, PII redaction, usage logging, and deterministic fallback.

### Home / Dashboard

1. Platform admins are redirected away from Home.
   - Status: accepted as intended after admin/recruiter split.
   - Current behavior: after login, platform admin lands on Admin Console instead of Home.
   - Product decision: Platform Admin is a separate admin app and should not enter the recruiter home.

2. Metrics are placeholders.
   - Status: fixed for current implementation.
   - Current behavior: `New This Week`, `Top Domains`, duplicate risk count, and `Last updated` are computed from candidate API data.

3. Missing Primary IDs number is misleading.
   - Current behavior: all 4 candidates are marked missing because coverage threshold is likely too strict.
   - Required change: show exact missing fields and severity: critical ID missing vs enrichment missing.

4. No operational alerts.
   - Status: implemented for current production-local shape.
   - Current behavior: Dashboard shows a Parse Alerts count and the Operations page shows queued/failed parse jobs, worker health, recent batches, file-review actions, operational alerts, and alert delivery history.
   - Current behavior: alert sources include worker offline with queued resumes, files needing review, stale/missing embeddings, and OCR/extraction quality warnings.
   - Remaining production change: add duplicate/version-risk and recent-match alerts if HR wants them in the same operator queue.

### Resume Database

1. Filter chips are non-functional.
   - Status: fixed for current implementation.
   - Current behavior: database chips filter AI/GenAI, 5+ years, United States, Lead/Senior, Version Signal, Coverage >80%, and Missing Location.

2. Search button does nothing distinct.
   - Status: fixed for current implementation.
   - Current behavior: search is a real form with submit semantics; results still update while typing.

3. Search result evidence is too cramped.
   - Evidence snippet appears inline inside a table cell.
   - Required change: use expandable evidence rows or a side evidence drawer.

4. Table is missing key HR columns.
   - Status: partially addressed.
   - Current behavior: candidate API returns total years, seniority, top domains, country signals, and duplicate risk; database table shows years, seniority, top domains, country/location, coverage, duplicate risk, sortable columns, sticky header, truncation, and horizontal overflow.
   - Remaining change: expose parse status, last interaction, saved views, column resize, and row action menu without overcrowding.

5. Location/country is incomplete.
   - Example: Pranjal shows only `India` and missing current location.
   - Required change: stronger location extraction and normalization.

6. Candidate names can duplicate confusingly.
   - Status: fixed for current implementation.
   - Current behavior: resume database rows now include candidate-version signal score/status from possible duplicate upload matches.

### Upload

1. Single upload contradicts the async architecture.
   - Status: fixed for current implementation.
   - Current behavior: single upload queues a parse job and shows batch/job progress.

2. Worker requirement is hidden in small text.
   - Status: fixed for current implementation.
   - Current behavior: upload page shows worker online/offline state, queued/running/failed counts, recent workers, last heartbeat, processed count, and last error.
   - Remaining production hardening: add persistent worker logs/file-review queue and operator alerting.

3. Stale queued jobs remain visible without explanation.
   - Status: partially addressed.
   - Current behavior: old smoke jobs were reconciled/cancelled, and the upload UI shows status, stage, retry, cancel, and timestamps.
   - Remaining change: expose the reconciliation action or stale-job warning in an admin/operator surface.

4. No upload validation details.
   - Status: fixed for current implementation.
   - Current behavior: upload page shows accepted file types, recommended file size, scanned PDF/OCR note, queue behavior, retry/cancel behavior, and duplicate hash policy. Backend rejects files over 25 MB and parse jobs show duplicate hash warnings.

### Candidate Detail

1. Timeline still needs final product polish.
   - Status: partially addressed.
   - Current behavior: candidate detail uses the cleaner vertical timeline/card style again and no longer repeats the word `concurrent`; cross-company overlaps are only called out when they cross company boundaries.
   - Remaining change: add a compact visual lane/tick treatment that preserves the previous readable style without returning to the disliked heavy bar layout.

2. Projects under same company are not modeled cleanly.
   - Status: fixed for new parses.
   - Current behavior: deterministic overlap detection no longer marks same-company overlapping items as cross-company overlap. The extraction schema now supports `experience[].workstreams`, the prompt tells the LLM to use it for same-company projects, and a deterministic post-processor nests same-company project-like rows under the parent role.
   - Remaining change: reparse existing candidates to populate workstreams in legacy records.
   - Example: Orbit Systems projects should be nested workstreams under `Founding Engineer`, not concurrent roles.
   - Required change: parser schema should support `workstreams/projects` under an experience item.

3. AI notes vs facts labeling is still weak.
   - Status: partially addressed.
   - Current behavior: Candidate Overview now has explicit `Verified Resume Facts` and `AI Notes & Fit` cards, with source labels and raw-CV evidence snippets where matching text is found.
   - Remaining change: make snippets deep-link to exact page/section in the Original CV preview instead of showing inline excerpts only.

4. Domain-years chart is rudimentary.
   - Status: partially addressed.
   - Current behavior: domain-years now shows a non-overlapping total-experience baseline, flags domain estimates that exceed that baseline for review, and shows raw-CV evidence snippets when matching domain terms are found.
   - Remaining change: store parser-generated evidence per domain-year estimate instead of relying on heuristic raw-text matching.

5. Location panel is underpowered.
   - Status: partially addressed for new/enriched records.
   - Current behavior: location intelligence now tracks current/best-known location, structured work/education/workstream locations, raw CV location mentions, countries, time zones, remote/on-site evidence, work authorization snippets, and relocation signals. Candidate Detail displays these signals.
   - Remaining change: normalize city/state/country values into dedicated tables and re-enrich existing candidates after schema rollout.

6. Parse metrics are too visible for recruiters.
   - Status: fixed for current implementation.
   - Current behavior: token/parse metrics only appear when the Candidate Detail Debug tab is active, and Debug is hidden from regular recruiter/viewer roles.

7. Original CV preview could not be fully verified in browser because preview interaction was blocked by the browser security policy during inspection.
   - Status: partially addressed.
   - Current behavior: preview failures and non-inline file types now render designed states with an authenticated open-original action.
   - Remaining change: add a rendered DOCX-to-preview flow so recruiters do not need to open Word files externally.

8. Debug tab depends on missing page data for existing resumes.
   - Status: partially addressed.
   - Current behavior: missing page-level extraction now shows an explicit legacy-data state instead of a blank debug panel.
   - Remaining change: reparse legacy candidates to populate true page-level extraction data.

9. Empty intelligence panels looked broken.
   - Status: fixed for current implementation.
   - Current behavior: AI summary, best-fit roles, domain-years, skill taxonomy, timeline, evidence map, CV preview, and debug page-data sections now use designed empty states with reason/next-action copy.

### Requirement Intake

1. Empty state is too thin.
   - Status: fixed for current implementation.
   - Current behavior: intake copy explains extract -> clarify -> finalize -> match.

2. PDF upload and text paste are visually presented as two methods, but pasted text is always marked active.
   - Status: fixed for current implementation.
   - Current behavior: active intake method switches between PDF upload and pasted text.

3. Clarification questions are plain inputs.
   - Status: fixed for current implementation.
   - Current behavior: Requirement Intake now has structured match controls for must-have skills, nice-to-have skills, minimum years, seniority, countries, locations/time zones, priority domains, work authorization, and dealbreakers. These fields are written back into the final requirement profile and affect matching.

4. Extracted JSON is shown directly to recruiters.
   - Status: fixed for current implementation.
   - Current behavior: recruiter-facing requirement summary and structured controls are shown; raw extracted JSON is no longer shown in the normal recruiter requirement workflow.

5. No requirement list/history visible on the page.
   - Status: fixed for current implementation.
   - Current behavior: requirement intake page shows recent requirement history.

### Match Results

1. Empty state is poor.
   - Status: fixed for current implementation.
   - Current behavior: match page shows an explicit no-match-run state and a button back to Requirements.

2. No requirement context.
   - Status: fixed for current implementation.
   - Current behavior: match page shows the active requirement title/context.

3. No historical matches list.
   - Status: fixed for current implementation.
   - Current behavior: Match Results now shows saved matched requirements and clicking one loads persisted matches.
   - Current behavior: each new ranking persists a requirement match-run snapshot with run number, candidate count, eligible/blocked counts, top score, average score, profile snapshot, match snapshot, and created timestamp.
   - Current behavior: Match Results has review filters for all, eligible, blocked, shortlisted, and rejected candidates with counts.
   - Current behavior: Match Results shows run-history cards and latest-run comparison after at least two runs.
   - Remaining change: add a dedicated run-detail drawer with exact old/new evidence changes per candidate.

4. Match cards need more evidence UX.
   - Status: partially addressed.
   - Current behavior: match cards now show hard-filter pass/fail, semantic evidence snippets with source labels, explicit gap chips, recruiter-notes relevance, and recommended next action.
   - Remaining change: add expandable evidence detail.

### Candidate Versions

1. Good version signal exists, but version history needs more polish.
   - Status: partially addressed.
   - Current behavior: UI shows exact email/phone/name/company/country reasons, preserves possible duplicate uploads as separate candidate versions, never merges or deletes candidate data, and shows upload/file/storage/parse/extraction/token/size metadata.
   - Remaining change: add a chronological version stack after more than two uploads and rename legacy internal DB/API table names.

2. No side-by-side candidate comparison.
   - Status: fixed for current implementation.
   - Current behavior: Candidate Versions compares email, phone, current title/company, location, countries, companies, education, and skills with backend-generated same/different/missing status and field-level conflict highlighting.
   - Remaining change: add notes and source-document previews directly inside the comparison panel.

3. Decisions are not visibly audited.
   - Status: fixed for current implementation.
   - Current behavior: versioned, separate, and review-later decisions are written to `audit_logs`, returned with version clusters, and shown in a Decision Audit Trail panel.

4. Review queue does not support filtering.
   - Status: fixed for current implementation.
   - Current behavior: Candidate Versions queue supports all, suggested, review-later, versioned, and separate filters with counts.

### Team Settings

1. Platform admin can see tenant team settings in the same shell.
   - Status: fixed for current implementation.
   - Current behavior: platform admins default to Admin System without tenant context. Team Settings is visible only after explicitly entering a selected company workspace.

2. Role dropdowns are always active.
   - Status: fixed for current implementation.
   - Current behavior: role changes now ask for confirmation before writing, backend rejects demoting the only active tenant owner, and role changes are written to audit logs.
   - Remaining change: show inline audit reason/context before the role change is confirmed.

3. Disabled/cancelled invite behavior is confusing.
   - Status: fixed for current implementation.
   - Current behavior: pending invites show copy/resend/cancel, expired invites show resend, and closed accepted/cancelled invites show no active action.

4. Invite links are hidden after creation but no copy/send flow exists.
   - Status: partially addressed.
   - Current behavior: pending invitations with visible tokens have a copy-link action.
   - Remaining change: add email delivery and copy feedback/toast.

### Admin Console

1. Add Company form lacks validation and lifecycle.
   - Status: partially addressed.
   - Current behavior: backend and UI validate company name, valid owner email, seat limit range, and allowed owner/admin role before creating the tenant.
   - Remaining change: show pending/approved/disabled lifecycle if platform admin approval becomes a separate company onboarding state.

2. Tenant operations are too destructive.
   - Status: fixed for current implementation.
   - Current behavior: disable/reactivate asks for confirmation before writing.

3. No tenant drill-down.
   - Status: fixed for current implementation.
   - Current behavior: platform admin can inspect tenant users, invitations, candidates, parse jobs, requirements, and audit logs without entering the recruiter workspace.
   - Current behavior: tenant drill-down intentionally avoids LLM token/cost metrics. Platform admins see seats, members, invitations, aggregate record counts, privacy boundary copy, and company-management audit only.
   - Remaining change: add billing/usage views only after product design defines what company admins should see.

4. No audit log UI.
   - Status: fixed for current implementation.
   - Current behavior: tenant drill-down shows recent audit events with action, actor, entity type, entity id, and timestamp.
   - Current behavior: Admin System also shows a platform audit feed across tenants.
   - Remaining change: add advanced filters/export for compliance review.

5. No billing/usage/limits view.
   - Status: partially addressed.
   - Current behavior: tenant drill-down shows seat usage, invitations, members, company-management audit, and privacy boundary status.
   - Remaining change: add billing-period aggregation, quotas, and usage alerts in a separate billing/admin surface, not inside recruiter workflow screens.

## P2 - Data Quality And Intelligence

1. Parser needs workstream/project structure.
   - Status: fixed for new parses.
   - Current behavior: schema supports `experience[].workstreams`, the parser prompt requests same-company workstreams, deterministic normalization nests project-like same-company rows, timeline events preserve workstreams, and semantic search indexes workstream text.
   - Remaining change: reparse legacy resumes and evaluate output quality on a larger resume set.

2. Same-company project extraction must not create false concurrency.
   - Status: fixed for new parses.
   - Current behavior: deterministic post-processor nests same-company overlapping project-like rows under parent roles and regression tests cover Orbit-style project rows and sequential same-company roles.
   - Remaining change: reparse legacy resumes and review edge cases.

3. Location and country extraction needs a stronger pass.
   - Status: partially addressed.
   - Current behavior: deterministic enrichment now captures current/best-known location, work locations, education locations, workstream locations, countries, time zones, work authorization snippets, relocation signals, and remote/on-site signals. These are indexed for semantic search and used in requirement matching text.
   - Remaining change: add LLM-assisted normalization for ambiguous locations and persist normalized location rows for analytics.

4. Domain-years estimates need evidence and non-overlap accounting.
   - Cloud Architecture showing `8.5 yrs` for Pranjal while total professional experience is `6.0 yrs` is suspicious.
   - Status: fixed for current implementation.
   - Current behavior: deterministic domain-year normalization caps impossible domain estimates to total non-overlapping professional experience, preserves original values, adds review flags, and attaches evidence terms plus dated role/workstream evidence.
   - Current behavior: Candidate Detail shows capped domain estimates, evidence terms, and review flags instead of silently showing inflated years.
   - Remaining change: rederive existing legacy candidates in bulk so stored JSON and normalized analytics tables are updated everywhere.

5. Candidate coverage scoring is too blunt.
   - Status: fixed for current implementation.
   - Current behavior: coverage now includes item severity, critical missing fields, enrichment gaps, and separate category scores for identity, resume extraction, experience/date, education, HR intelligence, location intelligence, and recruiter context.
   - Current behavior: Candidate Detail shows category progress bars and separates critical missing fields from enrichment gaps.

6. Raw text search is working and should be kept.
   - Current semantic search correctly indexes raw extracted text chunks.
   - Keep this as a core recall feature.

## P2 - Search And Matching

1. Semantic search works with `openai/text-embedding-3-small`, but old hash vector table still exists.
   - Status: fixed for product code and migrated local schema.
   - Current behavior: candidate indexing writes only to `candidate_search_chunks` with real embedding metadata and no longer writes new rows to legacy `candidate_embeddings`.
   - Current behavior: migration `20260513_0004_quarantine_legacy_candidate_embeddings` renames the old table to `legacy_candidate_embeddings` when present, preserving rows for rollback/debug while removing it from the active schema.

2. Search evidence should distinguish source type.
   - Status: fixed for current implementation.
   - Current behavior: Copilot and Match evidence display normalized source labels such as `Parsed skills`, `Raw CV text/page`, `Recruiter notes`, `AI intelligence`, `Experience`, and `Location signals`.

3. Requirement matching should use persisted match retrieval after actions.
   - Do not rerun matching after shortlist/reject.

4. Matching should show hard filters separately from scoring.
   - Status: fixed for current implementation.
   - Current behavior: matching computes hard-filter failures for must-have skills, minimum years, required locations/countries, active dealbreakers, and explicit work authorization. Failed hard filters cap score and are shown separately in Match Results.

## P2 - Operations And Documentation

1. README says UI runs on port 3000.
   - Status: fixed for current implementation.
   - Current behavior: local env, README, Docker Compose, and login docs use port 3001.

2. Docker Compose only starts Postgres.
   - Status: fixed for current implementation.
   - Current behavior: Docker Compose defines Postgres, API, worker, and UI services with health checks and shared app data storage.

3. No automated test suite exists.
   - Status: partially addressed.
   - Current behavior: `tests/test_timeline.py` covers same-company project overlap and cross-company overlap detection.
   - Required tests:
     - Auth/bootstrap safety.
     - Tenant isolation.
     - Upload job creation.
     - Worker success/failure/retry.
     - Timeline non-overlap accounting.
     - Same-company workstream grouping.
     - Requirement clarify/finalize/match.
     - Candidate versioning.
     - Semantic search tenant isolation.

4. Migrations are one large `migrate()` function.
   - Status: partially addressed.
   - Current behavior: `schema_migrations` now records a consolidated baseline version and new schema work is landing as versioned migration files under `src/resume_intel/migrations/versions`.
   - Current behavior: search hardening, invitation hardening, legacy embedding quarantine, and candidate maintenance jobs are versioned migrations.
   - Required change: keep all future schema changes in versioned files unless intentionally creating a new baseline.

5. Worker observability is incomplete.
   - Status: partially addressed.
   - Current behavior: worker heartbeat, online/offline state, current job id, processed count, last error, queue counts, UI status, durable parse-job event timelines, and parse-job file-review counts are implemented.
   - Current behavior: queued, retry, cancel, stage-change, success, and failure events are persisted in `parse_job_events` and shown in the upload batch detail UI.
   - Current behavior: jobs that exhaust retries are recorded in `parse_job_dead_letters` internally; retrying a job resolves the open file-review record.
   - Current behavior: Upload now includes a Dead-Letter Review panel with failed file, batch, attempts, error, timestamp, and retry action.
   - Current behavior: Operations now includes a dedicated file-review queue with retry and acknowledge actions.
   - Remaining change: add operator alerting for repeated terminal failures.

## Currently Acceptable

1. FastAPI API is running and health check passes.
2. Next.js build passes.
3. Python compile passes.
4. Candidate list API works.
5. Semantic search works with real OpenAI embeddings.
6. Raw extracted text is included in semantic search chunks.
7. Candidate notes CRUD exists.
8. Requirement clarification crash was fixed.
9. Legacy entity merge foreign-key crash was fixed before merge was disabled.
10. Tenant-scoped queries exist across most business tables.
11. Single resume upload is async and no longer blocks the API request.
12. Parse batches/jobs expose progress percentages and human-readable stage labels.
13. Existing local candidate documents/pages were backfilled.
14. Public API responses no longer expose absolute local source paths for candidates or parse jobs.
15. Requirement matching uses raw extracted resume text plus structured fields for deterministic scoring.
16. Requirement matching uses normalized domain/location matching and semantic evidence chunks.
17. Requirement UI has a finalized-profile step before ranking.
18. Shortlist/reject no longer reruns candidate ranking.
19. Candidate timeline UI uses the cleaner vertical timeline/card style and avoids repeated concurrency text.
20. Same-company overlapping experience items are not treated as cross-company employment overlap.
21. Parse worker heartbeat/status API and upload-page worker status are implemented.
22. Timeline date parsing correctly handles two-digit months like `2022-12`.
23. Timeline regression tests cover same-company and cross-company overlap behavior.
24. Workstream normalization tests cover Orbit-style same-company project rows and sequential same-company roles.
25. Login screen distinguishes Company Workspace from Platform Admin entry.
26. Local platform-admin bootstrap button is hidden in production builds.
27. Candidate merging is disabled; possible duplicate uploads are handled as candidate versions.
28. Resume Database shows duplicate risk score/status per candidate row.
29. Dashboard metrics now use real candidate data instead of placeholder math.
30. Resume Database filter chips now perform actual filtering.
31. Requirement Intake has workflow copy, active input mode, summary cards, recruiter-facing structured controls, and requirement history.
32. Match Results has requirement context and a usable empty state.
33. Resume Database visibly shows years, seniority, and top domains.
34. Candidate parse token metrics are hidden outside Debug.
35. Upload page explains accepted types, size guidance, OCR, worker queueing, retry/cancel, and duplicate hash policy.
36. Upload API enforces 25 MB file limit and parse jobs surface duplicate file hash warnings.
37. Resume Database search button has submit semantics.
38. Admin System and Main Recruiter App have separate post-login shells.
39. Recruiter Copilot chat exists and returns tenant-scoped semantic candidate evidence.
40. Copilot no longer uses a hidden 6-result UI request; result count is user-visible.
41. Copilot result cards support relevance/recency, score, evidence, country, and seniority filters.
42. Requirement upload/paste plus HITL clarification is available inside Copilot.
43. Resume Database has sortable columns, sticky table header, truncation, empty state, and horizontal overflow.
44. Requirement history is clickable and loads saved/finalized requirements.
45. Match Results can load persisted matched requirements from saved match history.
46. Destructive tenant/team/job/reject/entity actions have confirmation prompts.
47. Top search is page-scoped instead of pretending to be global everywhere.
48. Tablet/mobile shell no longer lets navigation consume the full top of the page.
49. Requirement matching applies hard filters before final scoring and caps failed candidates.
50. Match Results shows hard-filter failures, semantic evidence snippets, and gap chips.
51. Match Results supports recruiter review queues for eligible, blocked, shortlisted, and rejected candidates.
52. Candidate Detail hides Debug and parse metrics from regular recruiter/viewer roles.
53. Candidate Detail uses designed empty states for missing AI summary, roles, domain-years, skill taxonomy, timeline, evidence, CV preview, and page-level debug data.
54. Candidate Detail now separates verified resume facts from AI notes/fit guidance on the overview.
55. Team Settings invite actions are now state-aware and avoid showing cancel/resend controls for closed invites.
56. Candidate Versions now includes side-by-side candidate comparison without merge/delete actions.
57. Candidate Versions queue now has status filters for all/suggested/review-later/versioned/separate decisions.
58. Requirement Intake now has structured clarification fields that update matchable final-profile constraints.
59. Candidate Detail domain-years display now compares estimates to total non-overlapping experience and flags suspicious over-total values.
60. Candidate Detail verified facts, AI notes, and domain-year rows show source labels plus raw-CV evidence snippets where available.
61. Copilot and Match evidence snippets now distinguish source type with recruiter-readable labels.
62. Candidate version decisions now write audit log events and show a visible decision audit trail in the version review UI.
63. Match cards now show recruiter-notes relevance and recommended next action.
64. Candidate versioning replaced the destructive merge/entity-resolution workflow in UI decision endpoints; the legacy merge route now returns `410`.
65. Candidate Versions now shows version timeline metadata, parse/extraction details, token counts, and backend-generated field-level diffs.
66. New parses support same-company workstreams under parent experience roles and semantic search indexes workstream text.
67. Candidate semantic indexing no longer writes to the legacy hash-vector `candidate_embeddings` table.
68. Admin tenant drill-down now shows members, invites, aggregate recruiter-record counts, privacy boundary state, and company-management audit events without exposing candidate records or AI usage details.
69. Tenant owner demotion/disable is protected when it would remove the only active owner, and member role/disable actions are audited.
70. Requirement matching now persists match-run history snapshots and exposes latest-run comparison.
71. Admin System now includes a platform audit feed across tenants.
72. Tenant drill-down no longer exposes LLM token/cost usage metrics in the platform admin UI.
73. Parse jobs now persist durable event timelines and upload batch detail shows recent parse lifecycle events.
74. Location intelligence now includes work/education/workstream locations, timezone, work authorization, remote/on-site, relocation, and richer raw CV location signals.
75. Platform admins no longer receive tenant context and cannot enter company recruiter workspaces.
76. Parse jobs that exhaust retries are now tracked in `parse_job_dead_letters` internally, and worker status exposes a file-review count.
77. Candidate Intelligence Maintenance is queued, tenant-scoped, auditable, retryable, cancellable, and local-only by default.
77. Upload now includes a file-review panel with retry actions for terminal parse failures.
78. Candidate PII/contact intelligence now extracts LinkedIn, GitHub, portfolio websites, all CV URLs, email, and phone.
79. PII/contact intelligence is visible in Candidate Detail and indexed for semantic search.
80. Domain-year accounting now unions covered months per domain so overlapping roles do not inflate domain totals.
81. `candidatSignal.ai` branding is implemented in the app shell, landing page, metadata, and API title.
82. Platform Admin and Recruiter App are separated: admin can create/manage companies and seats but cannot access recruiter operations.
83. Job Campaigns first slice is implemented: create campaign, create requirement profile, run matching, upload resumes into campaign, shortlist/reject campaign candidates.
84. Login stale-token bleed is fixed: company login no longer reuses a previously saved admin bearer token, and wrong-mode login attempts are rejected.
85. Operations page first slice is implemented: worker health, queue counts, recent batches, and file-review retry/acknowledge actions.
86. Saved Copilot threads first slice is implemented: tenant-scoped thread persistence, reload, archive, and message snapshots.
87. Physical login routes exist: `/login` for company users and `/admin/login` for platform admins.
88. DOCX/TXT/MD authenticated HTML preview first slice is implemented, with escaped DOCX content rendered inline in Candidate Detail.
89. Migration baseline tracking exists through `schema_migrations` and `scripts/migrate_db.py`.
90. Better Auth production hardening now rejects missing production secrets and unsigned bearer tokens unless explicitly enabled for local compatibility.
91. Platform-admin identities can no longer be invited into company workspaces, and pending company invitations now reserve seats.
92. Candidate search/Copilot redacts contact PII from raw evidence snippets for roles that cannot view direct contact data.
93. External Copilot LLM synthesis redacts candidate names, document IDs, email, phone, URLs, location, and contact chunks when tenant PII redaction is enabled.
94. Resume parsing and HR-intelligence prompts explicitly treat resume text as untrusted content and ignore prompt-injection instructions inside CVs.
95. Candidate Detail now includes deterministic LinkedIn/portfolio/GitHub profile-verification signals, with a provider hook for future external verification.
96. Login screens are simplified and include a non-blank session-check state for saved-token refreshes.
97. Candidate merge internals are disabled; versioning is the only supported duplicate-copy workflow.
