# sir-frontend Route/API/Hook Matrix — pass 2

작성일: 2026-06-25
상태: 2차 탐색 기반 + P0.2 PDF 개선 + 2026-06-30 create-user/dead-code remediation 반영본.

## 1. Next route handler authorization matrix

| Route file | Method | Auth source | Role check | Service-role use | Backend proxy | Workspace validation | Notes |
|---|---:|---|---|---|---|---|---|
| `src/app/api/admin/clear-critical/route.ts` | POST | Supabase SSR `auth.getUser()` | `user_profiles.role` admin/super_admin | Yes | No | No workspace validation; platform/id only | Admin critical clear mutation. Target row validation is platform/id based. |
| `src/app/api/admin/create-user/route.ts` | POST | Supabase SSR `auth.getUser()` | super_admin only (`:16-23`) | Yes (`:25-28`) | No | Creates workspace via RPC for user role | Admin callers are now rejected; requires email/password/company; user role requires ticker/tier/subscription dates. |
| `src/app/api/admin/publish-report/route.ts` | POST | Supabase SSR `auth.getUser()` | admin/super_admin | Yes | No | report id/status only | Publishes report through Next service-role path. No explicit workspace-level target verification observed in this handler. Backend also has `/api/report/{id}/publish`. |
| `src/app/api/admin/reset-password/route.ts` | POST | Supabase SSR `auth.getUser()` | super_admin only (`:15-22`) | Yes (`:38-43`) | No | user id only | Forced auth admin password update. |
| `src/app/api/admin/workspace-tokens/route.ts` | GET | Supabase SSR `auth.getUser()` | admin/super_admin (`:14-21`) | Yes (`:23-31`) | No | Lists all workspaces | Read-only but RLS-bypassing admin overview. |
| `src/app/api/admin/workspace-tokens/[workspaceId]/route.ts` | PATCH | Supabase SSR `auth.getUser()` | super_admin only (`:23-30`) | Yes (`:49-52`) | No | workspaceId path param | Token mutation via RPC/update. |
| `src/app/api/companies/route.ts` | GET | None | None | No | No | N/A | Public KRX proxy using server-side API key. |
| `src/app/api/health/route.ts` | GET | None | None | No | No | N/A | Public health endpoint. |
| `src/app/api/monitoring/ai-analysis/estimate/route.ts` | POST | Requires incoming `Authorization` header (`:7-11`) | Delegated to backend | No | Yes (`NEXT_PUBLIC_API_URL`) | Delegated to backend | Local route only checks header presence, then forwards bearer token to backend `/api/monitoring/ai-analysis/estimate`. |
| `src/app/api/monitoring/ai-analysis/route.ts` | POST | Requires incoming `Authorization` header | Delegated to backend | No | Yes | Delegated to backend | Local route only checks header presence. AI analysis generation, token charge, and workspace validation happen in backend. |
| `src/app/api/monitoring/ai-analysis/latest/route.ts` | GET | Requires incoming `Authorization` header (`:7-11`) | Delegated to backend | No | Yes | `workspace_id` required locally; membership delegated to backend | Proxy with `cache: no-store`. |
| `src/app/api/monitoring/search-trend/route.ts` | POST | Supabase SSR `auth.getUser()` (`:48-55`) | No role check | Yes for cache (`:90-94`) | No | RLS-backed `workspaces` select before service-role cache (`:71-82`) | Calls Naver DataLab directly; degrades to stale cache. No explicit role gate. |
| `src/app/auth/callback/route.ts` | GET | Supabase auth callback/token hash | N/A | No | No | N/A | Exchanges code/OTP then redirects. |

### Observations

- Evidence: admin route handlers consistently check `auth.getUser()` and `user_profiles.role` before service-role client creation in sampled files; `create-user` and reset-password/workspace-token mutation are super_admin-only.
- Evidence: monitoring AI proxy routes check only `Authorization` header presence locally, then rely on backend `require_user` + backend workspace checks.
- Evidence: `search-trend` route validates workspace access with anon/RLS first, then uses service-role for cache table access.
- Evidence: static import search was used for API-module consumer mapping; dynamic imports/runtime-only consumers remain possible.
- Evidence: dead report-create UI path was removed: `CreateReportButton`, `useCreateReport`, and stale frontend `createReport(workspaceId)` have no remaining `src` references.
- Inference: service-role routes are not uniformly unsafe, but this matrix should be kept current whenever adding new `src/app/api/**` handlers.

## 2. `src/lib/api` module inventory

| Module | Primary access pattern | Key exports / responsibilities | Hook consumers observed |
|---|---|---|---|
| `blacklistApi.ts` | Supabase direct + backend `/api/blacklist` for Naver blogger hash insert | blogger/youtube blacklist reads/writes | `components/workspace/detail/BlacklistModal.tsx`, `hooks/blacklist/useBlacklistMutation.ts`, `hooks/blacklist/useBlacklistQuery.ts` |
| `crawlHistoryApi.ts` | Supabase direct + backend `/api/admin/config/retention` | crawl item/session history, retention mode | `app/(app)/crawl-history/CrawlHistoryClient.tsx`, `hooks/crawlHistory/crawlHistoryKeys.ts`, `hooks/crawlHistory/useCrawlHistoryQuery.ts` |
| `krxApi.ts` | Next `/api/companies` | KRX company search | `components/ui/CompanySearch.tsx` |
| `monitoringApi.ts` | Supabase direct + Next monitoring routes | daily/stock/risk/channel matrix/search/AI/history/token/day items | `hooks/monitoring/*`, `hooks/report/useReportQuery.ts`, client monitoring/insights pages, monitoring chart components |
| `newsApi.ts` | Supabase direct | cluster item lookup | `hooks/crawl/useCrawlQuery.ts` |
| `opsApi.ts` | backend `/api/ops/queue`, `/api/sessions/{id}/retry` | ops queue and retry | `app/(app)/ops/OpsClient.tsx` |
| `pipelineApi.ts` | backend `/api/pipeline/all` | pipeline trigger | `hooks/crawl/usePipelineMutation.ts` |
| `platformApi.ts` | Supabase direct | workspace platform CRUD | No static consumers found by import search in this pass |
| `reportApi.ts` | Supabase direct + backend/Next mutation endpoints + PostgREST fetch for `risk_notice_reads` | report info, summary, channel/risk data, risk reports, publish/retry/regenerate, crisis read-state; stale frontend `createReport(workspaceId)` helper removed | `hooks/report/*`, `hooks/crawl/useStockQuery.ts`, `hooks/workspace/useWorkspaceMutation.ts`, report/risk/ops pages and chart components |
| `sessionApi.ts` | Supabase direct | sessions by workspace/detail/date | `hooks/crawl/useSessionQuery.ts` |
| `subscriptionApi.ts` | Supabase direct RPCs | subscription lifecycle mutations | `lib/subscription.ts`, `lib/api/userApi.ts`, `hooks/subscription/*`, workspace/user admin components |
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
| `hooks/blacklist/*` | `blacklistApi` | Invalidates blogger count / youtube keywords after mutations. |
| `hooks/crawl*` | `newsApi`, `pipelineApi`, `sessionApi`, `reportApi` | Pipeline mutation invalidates workspace reports/progress. |

## 4. Follow-up gaps

- Need decide whether unused `platformApi.ts` is dead code, reserved for future UI, or indirectly referenced outside static imports.
- Need route handler body validation matrix: schema/no schema, numeric bounds, enum checks.
- Client route policy is confirmed: `user` is blocked from admin shell, while admin/super_admin client-page preview/support access must be preserved.
- Need timeout/retry behavior review for all backend proxy fetches.

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
