# PDF/Auth Playwright E2E Design

작성일: 2026-07-02
Scope: future `sir-frontend` Playwright browser tests for PDF/auth flows.

## Goal

Automate the cross-repo PDF/auth smoke scenarios currently documented in
`pdf-smoke-runbook.md`, without leaking Supabase access/refresh tokens and without
turning local CI into a live-data mutator.

## Non-goals for the current audit branch

- Do not add Playwright until a stable test environment and auth fixture exist.
- Do not create, update, or delete live Supabase rows from browser tests by default.
- Do not store raw access tokens, refresh tokens, or service-role keys in fixtures,
  screenshots, traces, or test output.

## Required test environment

1. Frontend test server
   - Runs `next dev` or a production build on an isolated base URL.
   - Points to the same Supabase project as the backend under test.
2. Backend test server
   - Exposes the PDF endpoint used by `PdfDownloadButton`.
   - Uses the same `FRONTEND_BASE_URL` as the Playwright server.
3. Auth fixture
   - Preferred: pre-existing seeded accounts with stable workspace/report IDs.
   - Required roles:
     - `user` workspace member.
     - `admin` or `super_admin` preview/support user.
   - Fixture output should expose only non-secret IDs and browser storage state.
4. Artifact policy
   - Traces/screenshots/videos are disabled by default for token-sensitive tests.
   - If enabled for debugging, redact or delete artifacts before sharing.

## Proposed scenarios

### 1. Client PDF happy path

- Login as a normal `user` workspace member via storage-state fixture.
- Open `/report/{workspaceId}/{reportId}` for a valid published report.
- Click PDF download.
- Assert:
  - API response content type is `application/pdf`.
  - Response size is non-zero.
  - No browser URL contains `?at=`, `?rt=`, `access_token`, or `refresh_token`.

### 2. Mismatched workspace/report

- Login as the same `user`.
- Open `/report/{otherWorkspaceId}/{reportId}` where the report does not belong to
  that workspace, or where the user is not a member.
- Assert:
  - UI shows the controlled not-found/invalid-combination state.
  - PDF button is absent or disabled.
  - No backend PDF request is made from the UI path.

### 3. Session expiry / missing session

- Start from no storage state, or clear storage before clicking the PDF path.
- Assert:
  - UI redirects to login or shows controlled session-expired copy.
  - Backend response is 401/403/404 if directly requested.
  - No token-shaped string appears in surfaced error text.

### 4. Role policy

- Login as `user` and assert admin shell routes such as `/workspace` redirect or
  block rendering.
- Login as `admin`/`super_admin` and assert client report/monitoring/crisis pages
  remain accessible for support/preview.

### 5. Token/log hygiene spot check

- Attach a request/response observer around PDF flow.
- Assert URL/header/body values visible to the browser test do not include:
  - `?at=`
  - `?rt=`
  - `access_token`
  - `refresh_token`
  - `Bearer <jwt>` in page-visible text

Backend/server-log redaction still needs an operator smoke check unless test
infrastructure can capture sanitized backend logs safely.

## Suggested Playwright layout

```text
playwright.config.ts
e2e/
  fixtures/
    auth.ts              # storage-state loading, no raw token logging
  pdf-auth.spec.ts       # scenarios above
  README.md             # required env vars and fixture IDs
```

## Required environment variables

- `PLAYWRIGHT_BASE_URL`
- `PLAYWRIGHT_BACKEND_URL`
- `PLAYWRIGHT_USER_STORAGE_STATE`
- `PLAYWRIGHT_ADMIN_STORAGE_STATE`
- `PLAYWRIGHT_WORKSPACE_ID`
- `PLAYWRIGHT_REPORT_ID`
- `PLAYWRIGHT_MISMATCH_WORKSPACE_ID`

Storage-state files must stay out of git.

## CI gate proposal

1. Keep `npm test` as hermetic unit-test gate.
2. Add `npm run e2e` only when the environment above exists.
3. Run Playwright e2e as opt-in/manual or protected CI job first.
4. Promote to required CI only after fixtures are deterministic and token artifacts
   are proven safe.

## Current automated coverage boundary

- Frontend Vitest covers route-handler auth/body validation for admin and
  risk-report routes.
- Backend hermetic tests cover PDF preflight and token-free Playwright navigation.
- Full browser/session PDF behavior remains manual until this Playwright design is
  implemented.
