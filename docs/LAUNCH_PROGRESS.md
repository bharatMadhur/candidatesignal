# candidateSignal.ai Launch Hardening Progress

Updated: 2026-05-28

## Done
- Renamed visible company-login language to recruiter-login/recruiter-workspace language while keeping tenant/company backend boundaries intact.
- Replaced staging HTTP Basic Auth plan with an app-level cookie gate implementation.
- Added staging gate page and route handler.
- Routed staging `/api/*` through the UI so the staging cookie gate and app auth do not conflict.
- Added normalized frontend API errors and backend proxy timeout handling.
- Improved workspace browser history so real screen changes push history entries.
- Added deep-parse quality metadata and candidate-visible retry banner.
- Added golden regression coverage for known parser failure classes.
- Added durable campaign match job schema, service, API, and worker integration.
- Added authenticated E2E env guard script.
- Added durable candidate-side resume upload worker handling with retry support.
- Moved candidate-side uploaded files through the `DocumentStorage` abstraction.
- Added candidate upload retry UI.
- Added backend proxy upload-size enforcement.
- Added LLM JSON shape validation for critical structured passes.
- Added matching service façade for requirement, campaign, and semantic-search callers.
- Expanded worker health counts to include campaign matching and candidate-upload queues without mixing candidate-owned uploads into tenant queues.
- Extracted the candidate pre-parse preview out of the frontend monolith as a first safe candidate-side component split.
- Extracted the candidate resume-version database and submission history out of the frontend monolith.
- Extracted candidate controlled-sharing, application-memory, and PII-access panels out of the frontend monolith.
- Extracted candidate resume export/preview panels and candidate coaching/visibility panels out of the frontend monolith.
- Extracted candidate job-fit helper logic and the job-level AI editor out of the frontend monolith.
- Extracted candidate start-from-scratch guidance and practical job-board cards out of the frontend monolith.
- Extracted the candidate home command center out of the frontend monolith.
- Extracted the candidate guided resume facts form out of the frontend monolith.
- Extracted the candidate TipTap resume canvas and AI rewrite guardrails out of the frontend monolith, bringing `web/app/page.tsx` below the 500KB Babel deoptimization threshold.
- Extracted shared candidate resume/profile conversion helpers into `web/app/lib/candidate-resume-profile.ts`.
- Extracted the candidate resume-version editor overlay out of the frontend monolith.
- Extracted pure campaign workflow and scorecard helpers into `web/app/lib/campaign-workflow.ts`.
- Extracted candidate-portal section routing, fallback coach copy, preview detection, profile normalization, and completeness helpers into `web/app/lib/candidate-portal.ts`.
- Extracted candidate correction form/payload and coverage-gap helpers into `web/app/lib/candidate-corrections.ts`.
- Extracted candidate work/education timeline calculations and comparable-text normalization into `web/app/lib/candidate-timeline.ts`.
- Extracted candidate database filters, sorting, freshness, review-signal, and note-signal helpers into `web/app/lib/candidate-database.ts`.
- Extracted requirement/campaign match display filters, buckets, gaps, next-action copy, and requirement clarification field metadata into `web/app/lib/matching-display.ts`.
- Extracted candidate/recruiter evidence-row, snippet, term, and source-label helpers into `web/app/lib/candidate-evidence.ts`.
- Extracted the candidate database table into `web/app/components/candidate-table.tsx`.
- Tightened newly extracted frontend helper modules to avoid broad `any` signatures in matching, candidate-portal, evidence, and timeline helpers.
- Ignored generated local visual-QA artifacts so screenshots and temporary revert patches do not enter git.
- Removed obsolete candidate-version test coverage for retired `entity-resolution` route aliases after confirming the API only exposes candidate-version routes.

## In Progress
- Continued frontend decomposition of the monolithic `web/app/page.tsx`.

## Blocked
- Authenticated Playwright verification requires `E2E_COMPANY_EMAIL`, `E2E_COMPANY_PASSWORD`, `E2E_CANDIDATE_EMAIL`, and `E2E_CANDIDATE_PASSWORD`.
- Live staging cookie-gate verification requires deploying the updated Caddy/UI stack.

## Pending
- Continue splitting remaining recruiter/campaign surfaces out of `web/app/page.tsx`.
- Split `web/app/styles.css` into feature-scoped styles after P0 launch checks pass.
- Add staging/prod load smoke for 300-user launch readiness.
- Configure `.com` staging only if `staging.candidatesignal.com` is required; canonical staging remains `.ai`.

## Verified
- Focused worker/upload/match tests passed.
- Python compile passed.
- Frontend lint passed.
- Next.js production build passed.
- `web/app/page.tsx` is now below 500KB and no longer triggers the Babel deoptimization warning.
- Campaign workflow helper extraction passed lint, production build, backend focused tests, and Python compile.
- Candidate-portal helper extraction passed frontend lint and production build.
- Candidate correction helper extraction passed frontend lint and production build.
- Candidate timeline helper extraction passed frontend lint and production build.
- Candidate database helper extraction passed frontend lint and production build.
- Matching display helper extraction passed frontend lint and production build.
- Candidate evidence helper extraction passed frontend lint and production build.
- Candidate table component extraction passed frontend lint and production build.
- Extracted-helper type tightening passed frontend lint and production build.
- Focused backend worker/upload/matching/prompt-security tests and Python compile passed after the latest frontend cleanup batch.
- Candidate-version cleanup passed focused tests.
- Full backend test suite passed after cleanup: 196 tests and 10 subtests.
- Python compile, frontend lint, Next.js production build, and public smoke passed after cleanup.
- Playwright public smoke passed.
- Playwright authenticated smoke is present but intentionally blocked unless dedicated recruiter and candidate E2E credentials are provided.
