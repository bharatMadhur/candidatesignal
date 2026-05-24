# candidateSignal.ai Launch Hardening Progress

Updated: 2026-05-24

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

## In Progress
- Staging deployment verification after these changes are pushed/deployed.

## Blocked
- Authenticated Playwright verification requires `E2E_COMPANY_EMAIL` and `E2E_COMPANY_PASSWORD`.
- Live staging cookie-gate verification requires deploying the updated Caddy/UI stack.

## Pending
- Split the monolithic `web/app/page.tsx` into feature modules after P0 launch checks pass.
- Split `web/app/styles.css` into feature-scoped styles after P0 launch checks pass.
- Add staging/prod load smoke for 300-user launch readiness.
- Configure `.com` staging only if `staging.candidatesignal.com` is required; canonical staging remains `.ai`.

## Verified
- Python unit discovery: 170 tests passed.
- Frontend lint passed.
- Next.js production build passed.
- Playwright public smoke passed.
- Playwright authenticated smoke is present but skipped until `E2E_COMPANY_EMAIL` and `E2E_COMPANY_PASSWORD` are provided.
