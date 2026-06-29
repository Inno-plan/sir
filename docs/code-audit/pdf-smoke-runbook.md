# Cross-repo PDF Smoke Runbook

작성일: 2026-06-29
Scope: `sir-frontend` + `sir-backend` PDF 다운로드/렌더링 수동 smoke.

## Purpose

PDF 생성은 frontend route, backend API, Supabase session delegation, Playwright render, and RLS policies가 함께 맞물리는 cross-repo flow다. Backend hermetic tests cover preflight and token-free Playwright navigation, but the full browser/session path is intentionally verified by this manual runbook for now.

## Preconditions

- Do not run DB insert/upsert/update/delete for this runbook.
- Use existing accounts/workspaces/reports only.
- Use a published report where the user is already a workspace member.
- Backend and frontend should point at the same Supabase project/environment.
- Do not copy access tokens or refresh tokens into logs, screenshots, or notes.

## Scenarios

### 1. Valid client user PDF download

1. Log in as a normal `user` profile that belongs to the target workspace.
2. Open `/report/{workspaceId}/{reportId}` with a report that belongs to that workspace.
3. Click PDF download.
4. Expected:
   - Browser receives an `application/pdf` response.
   - Download succeeds with a report filename.
   - Backend logs show workspace/report identifiers and byte size, not token values.

### 2. Mismatched workspace/report URL

1. Construct a URL where `workspaceId` and `reportId` do not belong together.
2. Open `/report/{workspaceId}/{reportId}`.
3. Expected:
   - Frontend renders “보고서를 찾을 수 없습니다” / invalid combination state.
   - PDF download is blocked before backend delegation.
4. If the backend PDF endpoint is directly requested with a mismatched pair, expected:
   - Backend rejects before Playwright render.
   - No token values appear in surfaced errors/logs.

### 3. Token expiry / missing session

1. Use an expired session, or sign out and attempt to call the flow from a stale page.
2. Expected:
   - Frontend shows the controlled “로그인 세션 만료/권한 확인” class of message.
   - Backend returns 401/403/404 as appropriate.
   - No raw access/refresh token appears in error output.

### 4. Role policy

1. Verify `role='user'` cannot render admin shell routes such as `/workspace`.
2. Verify `admin` and `super_admin` can open client report/monitoring/crisis screens for support/preview.
3. Expected:
   - This is policy-aligned: admin/super_admin client access is allowed.

### 5. Log/token hygiene spot check

Search local/server logs for token-shaped values after a failed PDF run.

Expected:
- No `access_token`, `refresh_token`, `Bearer <jwt>`, `?at=`, or `?rt=` values are present.
- Playwright navigation URL is `/report-pdf/{workspaceId}/{reportId}` without token query params.

## When to run

- After changes to `PdfDownloadButton`, `/report-pdf`, backend `report_pdf`, `services/pdf_service.py`, or Supabase RLS policies.
- Before release if PDF/auth behavior changed in the audit branch.
- After environment changes involving `FRONTEND_BASE_URL`, `NEXT_PUBLIC_API_URL`, or Supabase auth settings.

## Current known automated coverage

- `sir-backend/tests/test_pdf_preflight.py` — membership and report/workspace mismatch preflight, no live DB.
- `sir-backend/tests/test_pdf_service.py` — token-free Playwright URL construction and browser cleanup, no real browser launch.
