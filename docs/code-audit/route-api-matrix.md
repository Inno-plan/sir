# sir-frontend Route/API/Hook Matrix — pass 3

작성일: 2026-06-25
상태: 2차 탐색 기반 + P0.2 PDF 개선 + 2026-07-02 main merge 이후 support/risk-report route, crawl-history 제거, admin helper body validation 반영본.

## 1. Next route handler authorization matrix

| Route file | Method | Auth source | Role check | Service-role use | Backend proxy | Workspace validation | Notes |
|---|---:|---|---|---|---|---|---|
| `src/app/api/admin/clear-critical/route.ts` | POST | Supabase SSR `auth.getUser()` | `user_profiles.role` admin/super_admin | Yes | No | No workspace validation; platform/id only | Rejects invalid JSON/body, non-string/empty `platform_id`/`id`, and unknown platform before service-role update. |
| `src/app/api/admin/create-user/route.ts` | POST | Supabase SSR `auth.getUser()` | super_admin only | Yes | No | Creates workspace via RPC for user role | Rejects invalid JSON/body, unknown role, invalid tier, and subscription_start >= subscription_end before service-role writes. |
| `src/app/api/admin/publish-report/route.ts` | POST | Supabase SSR `auth.getUser()` | admin/super_admin | Yes | No | report id/status only | Rejects invalid JSON/body and non-string/empty `report_id`; publishes draft reports through Next service-role path. No explicit workspace-level target verification observed in this handler. Backend also has `/api/report/{id}/publish`. |
| `src/app/api/admin/reset-password/route.ts` | POST | Supabase SSR `auth.getUser()` | super_admin only | Yes | No | user id only | Rejects invalid JSON/body, non-string/empty `userId`, and invalid password policy before forced auth admin password update. |
| `src/app/api/admin/workspace-tokens/route.ts` | GET | Supabase SSR `auth.getUser()` | admin/super_admin (`:14-21`) | Yes (`:23-31`) | No | Lists all workspaces | Read-only but RLS-bypassing admin overview. |
| `src/app/api/admin/workspace-tokens/[workspaceId]/route.ts` | PATCH | Supabase SSR `auth.getUser()` | super_admin only | Yes | No | workspaceId path param | Token mutation via RPC/update; rejects invalid JSON/body, non-integer `add_tokens`, and negative/non-integer `monthly_quota`. |
| `src/app/api/companies/route.ts` | GET | None | None | No | No | N/A | Public KRX proxy using server-side API key; validates `type` and returns normalized upstream timeout/failure errors. |
| `src/app/api/health/route.ts` | GET | None | None | No | No | N/A | Public health endpoint. |
| `src/app/api/monitoring/ai-analysis/estimate/route.ts` | POST | Requires incoming `Authorization` header | Delegated to backend | No | Yes (`NEXT_PUBLIC_API_URL`) | Delegated to backend | Uses shared proxy helper with 30s timeout and normalized 502/504 errors; forwards bearer token to backend estimate endpoint. |
| `src/app/api/monitoring/ai-analysis/route.ts` | POST | Requires incoming `Authorization` header | Delegated to backend | No | Yes | Delegated to backend | Uses shared proxy helper with 30s timeout and normalized 502/504 errors. AI analysis generation, token charge, and workspace validation happen in backend. |
| `src/app/api/monitoring/ai-analysis/latest/route.ts` | GET | Requires incoming `Authorization` header | Delegated to backend | No | Yes | `workspace_id` required locally; membership delegated to backend | Uses shared proxy helper with 30s timeout, normalized 502/504 errors, and `cache: no-store`. |
| `src/app/api/monitoring/search-trend/route.ts` | POST | Supabase SSR `auth.getUser()` | No role check | Yes for cache | No | RLS-backed `workspaces` select before service-role cache | Validates JSON body, calls Naver DataLab with timeout, degrades to stale cache, and normalizes upstream timeout/failure errors. |
| `src/app/api/risk-report/[id]/route.ts` | PATCH | Supabase SSR `auth.getUser()` | admin/super_admin; admin must be workspace member | Yes | No | risk report row → workspace membership for admin | Validates JSON body, status enum, and `admin_note`; resolved/rejected removes storage attachments before update. |
| `src/app/api/risk-report/request/route.ts` | POST | Supabase SSR `auth.getUser()` | super_admin or workspace member | Yes | No | body workspace/report/source/session cross-check | Validates body shape, platform→source table, attachment path prefix, active armor subscription, report↔workspace, source↔workspace/platform/session/report, and duplicate request status. |
| `src/app/auth/callback/route.ts` | GET | Supabase auth callback/token hash | N/A | No | No | N/A | Exchanges code/OTP then redirects. |

### Observations

- Evidence: admin route handlers consistently check `auth.getUser()` and `user_profiles.role` before service-role client creation in sampled files; `create-user` and reset-password/workspace-token mutation are super_admin-only.
- Evidence: monitoring AI proxy routes check only `Authorization` header presence locally, then rely on backend `require_user` + backend workspace checks; shared helper now bounds backend fetches with timeout and normalized failure responses.
- Evidence: `search-trend` route validates workspace access with anon/RLS first, then uses service-role for cache table access; Naver DataLab fetch is now bounded and stale-cache degraded mode remains.
- Evidence: static import search was used for API-module consumer mapping; dynamic imports/runtime-only consumers remain possible.
- Evidence: dead report-create UI path was removed: `CreateReportButton`, `useCreateReport`, and stale frontend `createReport(workspaceId)` have no remaining `src` references.
- Evidence: high-risk service-role write routes now validate role/tier/date/token numeric/admin helper body values before invoking service-role auth/RPC/update calls.
- Evidence: main merge added risk-report route handlers. `request` performs body/source/report/workspace checks before service-role writes; `[id]` restricts mutation to admin/super_admin and validates the status/admin-note patch.
- Evidence: main merge removed the crawl-history page/API/hook surface and added Supabase-direct support inquiry surfaces.
- Evidence: `platformApi.ts` and `types/platform.ts` have no active `src` consumers outside their own import pair; active workspace/report flows use hardcoded platform constants/mappings in `workspaceApi.ts`, `utils/workspace.ts`, `monitoringApi.ts`, and `reportApi.ts`.
- Inference: service-role routes are not uniformly unsafe, but this matrix should be kept current whenever adding new `src/app/api/**` handlers.

## 2. `src/lib/api` module inventory

| Module | Primary access pattern | Key exports / responsibilities | Hook consumers observed |
|---|---|---|---|
| `blacklistApi.ts` | Supabase direct + backend `/api/blacklist` for Naver blogger hash insert | blogger/youtube blacklist reads/writes | `components/workspace/detail/BlacklistModal.tsx`, `hooks/blacklist/useBlacklistMutation.ts`, `hooks/blacklist/useBlacklistQuery.ts` |
| `krxApi.ts` | Next `/api/companies` | KRX company search | `components/ui/CompanySearch.tsx` |
| `monitoringApi.ts` | Supabase direct + Next monitoring routes | daily/stock/risk/channel matrix/search/AI/history/token/day items | `hooks/monitoring/*`, `hooks/report/useReportQuery.ts`, client monitoring/insights pages, monitoring chart components |
| `newsApi.ts` | Supabase direct | cluster item lookup | `hooks/crawl/useCrawlQuery.ts` |
| `opsApi.ts` | backend `/api/ops/queue`, `/api/sessions/{id}/retry` | ops queue and retry | `app/(app)/ops/OpsClient.tsx` |
| `pipelineApi.ts` | backend `/api/pipeline/all` | pipeline trigger | `hooks/crawl/usePipelineMutation.ts` |
| `platformApi.ts` | Supabase direct | workspace platform CRUD | No active consumers found by static import/search; classified as legacy/reserved for a possible future platform-selection UI |
| `reportApi.ts` | Supabase direct + backend/Next mutation endpoints | report info, summary, channel/risk data, risk reports, publish/retry/regenerate, typed Supabase crisis read-state; stale frontend `createReport(workspaceId)` helper removed | `hooks/report/*`, `hooks/crawl/useStockQuery.ts`, `hooks/workspace/useWorkspaceMutation.ts`, report/risk/ops pages and chart components |
| `sessionApi.ts` | Supabase direct | sessions by workspace/detail/date | `hooks/crawl/useSessionQuery.ts` |
| `subscriptionApi.ts` | Supabase direct RPCs | subscription lifecycle mutations | `lib/subscription.ts`, `lib/api/userApi.ts`, `hooks/subscription/*`, workspace/user admin components |
| `supportApi.ts` | Supabase direct + RPC | support inquiry list/create/answer, category/status normalization | `hooks/support/*`, `components/support/*`, `(app)/support`, `(client)/support/[workspaceId]` |
| `userApi.ts` | Supabase direct + Next admin route handlers | users, details, tokens, create/reset, role/workspace assignment | `hooks/user/*`, user admin components |
| `workspaceApi.ts` | Supabase direct | workspace list/detail/profile/reports/progress | `hooks/workspace/*`, workspace/report/client pages and components |
| `workspaceApi.server.ts` | Supabase SSR direct | server-side workspace lookup | `app/(app)/workspace/[workspaceId]/page.tsx` |

## 3. React Query / cache invalidation map

| Hook group | API module(s) | Query/mutation notes |
|---|---|---|
| `hooks/report/useReportQuery.ts` | `reportApi`, `workspaceApi`, `monitoringApi` | Large report data surface; report key prefixes intentionally support broad invalidation for risk reports and summaries. |
| `hooks/report/useReportMutation.ts` | `reportApi` | Uses optimistic update for summary/strategies; invalidates report/workspace/risk notice/risk report caches after mutations. Legacy `useCreateReport` hook removed with its unused button. |
| `hooks/monitoring/useMonitoringQuery.ts` | `monitoringApi` | Daily/stock/risk/channel/AI/history/token/day item queries. |
| `hooks/monitoring/useMonitoringMutation.ts` | `monitoringApi` | On AI analysis success, sets latest analysis cache and invalidates estimate/token/history. |
| `hooks/workspace/useWorkspaceQuery.ts` | `workspaceApi`, `subscriptionApi`, Supabase realtime | Uses Realtime channel for sessions/reports/session_strategies changes to invalidate progress/reports. |
| `hooks/workspace/useWorkspaceMutation.ts` | `workspaceApi`, `reportApi` | Invalidates workspace profile/progress/reports after profile/retry/regenerate mutations. |
| `hooks/user/*` | `userApi` | Invalidates users/details/members/workspace tokens/workspace list after admin user mutations. |
| `hooks/subscription/*` | `subscriptionApi` | Invalidates workspace subscription and detailed users after subscription changes. |
| `hooks/support/*` | `supportApi` | Lists workspace/admin support inquiries, creates client inquiry rows, and answers via `answer_support_inquiry` RPC. |
| `hooks/blacklist/*` | `blacklistApi` | Invalidates blogger count / youtube keywords after mutations. |
| `hooks/crawl*` | `newsApi`, `pipelineApi`, `sessionApi`, `reportApi` | Pipeline mutation invalidates workspace reports/progress. |

## 4. Follow-up gaps

- `platformApi.ts` / `types/platform.ts` are classified as legacy/reserved, not removed: runtime impact is negligible because they are not imported by active code; revisit only if rebuilding platform-selection UI or doing a deliberate deletion pass that removes both together.
- Continue route handler body validation matrix for lower-risk/proxy routes: schema/no schema, numeric bounds, enum checks, and consistent error envelope. After the 2026-07-02 main merge, admin helper pass, and Vitest expansion, `risk-report/request`, `risk-report/[id]`, `publish-report`, `clear-critical`, `reset-password`, workspace-token mutation, and `search-trend` RLS-before-service-role boundary are documented with explicit guards/tests; admin auth gates plus admin/risk-report/search-trend invalid paths have unit coverage. Remaining work is lower-risk/proxy route consistency and browser e2e coverage.
- Client route policy is confirmed: `user` is blocked from admin shell, while admin/super_admin client-page preview/support access must be preserved.
- Continue only long-tail timeout/retry behavior review; monitoring AI, KRX company search, and Naver DataLab search-trend route families now have bounded fetch/error normalization.

## 5. Cross-repo PDF/backend handoff — pass 5

| Frontend surface | Backend counterpart | Auth/token behavior | Workspace/report binding | Notes |
|---|---|---|---|---|
| `src/components/client/sidebar/PdfDownloadButton.tsx` | `sir-backend/main.py` `report_pdf` + `_assert_report_pdf_access` | Browser Supabase access token is sent as bearer; refresh token is sent in `X-Supabase-Refresh-Token`. Component verifies PDF metadata before backend delegation. | `getReportInfo(workspaceId, reportId)`/period metadata queries bind `reports.id` + `workspace_id`; backend checks caller membership and `reports.id` + `reports.workspace_id`. | Backend accepts tokens only after preflight and delegates render to Playwright; Playwright navigation URL stays token-free. |
| `src/app/report-pdf/[workspaceId]/[reportId]/page.tsx` | `sir-backend/services/pdf_service.py` | Playwright injects `window.__SIR_PDF_SESSION__` before navigating to `/report-pdf/{workspaceId}/{reportId}`; page deletes it and calls `setSession`. | Render page also validates the route pair before report sections/PDF-ready state. | Middleware intentionally bypassed for `/report-pdf`; see `src/middleware.ts:13-15`, `src/lib/supabase/middleware.ts:7-13`. |
| `src/app/(client)/layout.tsx:4-9` | backend `require_user` routes | Any authenticated user can render ClientShell. | Data isolation relies on client query filters/RLS and backend membership checks where routed. | Product policy confirmed 2026-06-29: admin/super_admin must be able to access all client/report screens for preview/support. |

Cross-repo smoke candidates are recorded in `docs/code-audit/pdf-smoke-runbook.md`:

1. Valid client user PDF happy path: valid workspace/report/member → PDF response and `data-pdf-ready` render marker.
2. Mismatched workspace/report path: frontend blocks invalid pair; direct backend call rejects before Playwright and no token value appears in logs/errors.
3. Token expiry/missing session path: controlled 401/403/404 or frontend session-expired state without raw token exposure.
4. Role path: `user` blocked from `(app)` admin shell; admin/super_admin client surface access remains allowed.
5. Log/token hygiene spot check: no `access_token`, `refresh_token`, `Bearer <jwt>`, `?at=`, or `?rt=` values in logs.

Inference: PDF security cannot be assessed from frontend route protection alone because `/report-pdf` deliberately bypasses middleware and backend supplies a temporary injected session. The effective boundary is frontend route-pair validation + backend preflight/RLS + token-free Playwright navigation + smoke/log checks together.
Confidence: High.
