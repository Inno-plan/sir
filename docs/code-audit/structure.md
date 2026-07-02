# sir-frontend Structure Map — pass 4

작성일: 2026-06-25
상태: 1차 구조 탐색 기반 + P0.2 PDF 개선 + 2026-07-02 main merge 이후 support/risk-report route 및 crawl-history 제거 반영본.

## 1. Runtime / framework baseline

- Evidence: `package.json:6-11` — scripts는 `dev`, `build`, `start`, `lint`, `typecheck`, `gen:types` 중심.
- Evidence: `package.json:13-42` — Next/React/Supabase/React Query/Zustand 기반 frontend.
- Evidence: `next.config.ts:3-5` — 현재 Next config는 `devIndicators: false`만 설정.
- Evidence: `tsconfig.json:7` — TypeScript `strict: true`.
- Evidence: `tsconfig.json:21-23` — `@/*` path alias 사용.

Inference: frontend는 Next.js App Router + Supabase SSR + React Query + Zustand 조합의 client/admin 혼합 앱이다.
Confidence: High.

## 2. Top-level source tree

주요 디렉토리:

- `src/app/` — App Router pages/layouts/route handlers.
- `src/components/` — admin/client/report/workspace/UI 컴포넌트.
- `src/hooks/` — React Query hook 및 domain hook.
- `src/lib/api/` — domain API client layer.
- `src/lib/supabase/` — browser/server/middleware Supabase client boundary.
- `src/lib/auth*` — user/profile/landing-path auth helpers.
- `src/store/` — Zustand stores.
- `src/types/` — generated DB types 및 domain types.

현재 확인한 주요 route groups:

- `(app)` 관리자/운영 경로: `/`, `/workspace`, `/risk-reports`, `/users`, `/ops`, `/support`.
- `(client)` 고객 경로: `/report/[workspaceId]/[reportId]`, `/monitoring/[workspaceId]`, `/crisis/[workspaceId]`, `/insights-history/[workspaceId]`, `/support/[workspaceId]`.
- `src/app/api/admin/*` — Next route handler가 service-role Supabase client로 관리자 작업 수행.
- `src/app/api/monitoring/*` — 일부 backend proxy + 일부 Next route 직접 처리.
- `src/app/api/risk-report/*` — service-role 기반 리스크 신고/상태 변경 route handler.
- `src/app/report-pdf/[workspaceId]/[reportId]` — PDF 렌더링용 client page.

Evidence: local `find src/app` route inventory, `src/app/(app)/layout.tsx`, `src/app/(client)/layout.tsx`, `src/app/api/**/route.ts`.
Confidence: High.

## 3. Supabase client boundaries

- Evidence: `src/lib/supabase/client.ts:4-8` — browser client는 `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` 사용.
- Evidence: `src/lib/supabase/server.ts:5-27` — server client는 cookies 기반 SSR session 사용.
- Evidence: `src/app/api/admin/create-user/route.ts` — admin route handler 내부에서 `SUPABASE_SERVICE_ROLE_KEY` client 생성.
- Evidence: `src/app/api/admin/reset-password/route.ts` — service-role로 auth admin password update 수행.
- Evidence: `src/app/api/admin/workspace-tokens/route.ts` — service-role로 workspace token data 조회.
- Evidence: `src/app/api/monitoring/search-trend/route.ts` — cache table 접근을 위해 service-role client 생성.
- Evidence: `src/app/api/risk-report/request/route.ts` and `src/app/api/risk-report/[id]/route.ts` — 리스크 신고 요청/상태 변경은 SSR caller 확인 후 service-role client로 source/report/risk row를 조회·갱신한다.
- Evidence: `src/lib/api/supportApi.ts` — support inquiry list/create/answer는 browser Supabase client와 `answer_support_inquiry` RPC를 사용한다.

Inference: 데이터 접근은 3계층이 혼재한다.
1. Browser/SSR Supabase anon + RLS.
2. Next route handler service-role admin operations.
3. Next route handler proxy to Python backend (`NEXT_PUBLIC_API_URL`) for selected monitoring/AI paths.
Confidence: High.

## 4. Auth / routing flow

- Evidence: `src/middleware.ts:8-16` — middleware matcher가 static assets, health API, report-pdf 등을 제외.
- Evidence: `src/lib/supabase/middleware.ts:46-50` — 미인증 사용자는 `/auth/login`으로 redirect.
- Evidence: `src/lib/supabase/middleware.ts:63-82` — `/workspace`, `/risk-reports`, `/users`에 role guard 적용. `/users`는 `super_admin`만 허용.
- Evidence: `src/lib/supabase/middleware.ts:85-94` — `/` 진입 시 `role='user'`는 최신 report 또는 `/no-report`로 redirect.
- Evidence: `src/app/(app)/layout.tsx:8-16` — user role이 admin AppShell에 진입하지 못하도록 layout에서 추가 guard.
- Evidence: `src/app/(client)/layout.tsx:6-9` — client shell은 현재 `getCurrentUser()` 후 별도 role 차단 없이 렌더.
- Evidence: `src/app/(app)/support/page.tsx:7-21` — admin/super_admin support inbox를 렌더하고, admin은 배정된 workspace id 목록으로 필터링한다.
- Evidence: `src/app/(client)/support/[workspaceId]/page.tsx:12-20` — client support page는 user role만 허용하고 admin/super_admin은 `/support`로 보낸다.
- Evidence: `src/lib/auth/resolveLandingPath.ts:12-29` — `get_user_landing` RPC로 role/workspace/report 기반 landing path 결정.

Inference: admin route 보호는 middleware + layout 이중 guard가 있고, client route는 authenticated user이면 접근 가능하다. 2026-06-29 사용자 결정에 따라 admin/super_admin은 고객 화면 preview/support 목적으로 모든 client report/monitoring/crisis 화면 접근이 가능해야 하므로 현재 동작은 정책에 부합한다.
Confidence: High.

## 5. State / cache flow

- Evidence: `src/providers/QueryProvider.tsx:8-17` — QueryClient 기본 `staleTime=60s`, `retry=1`.
- Evidence: `src/store/lastReport.ts:15-28` — workspace별 마지막 report id를 Zustand + `sessionStorage`에 저장.
- Evidence: `src/store/pipeline.ts:44-136` — pipeline UI 단계/선택 URL/완료 상태를 Zustand in-memory store로 관리.
- Evidence: `src/store/sidebar.ts:10-15` — sidebar open state store.

Inference: route-derived state와 UI state 일부가 local/session browser state에 저장된다. 권한/DB 상태는 Supabase/RLS가 최종 source of truth로 보이고, UX 복귀 상태만 browser state를 사용한다.
Confidence: High.

## 6. Current audit coverage

완료한 1차 범위:

- package/scripts/dependency map
- Next/TS/Supabase config boundary
- App route group map
- API route handler surface scan
- auth/middleware/landing-path flow
- Zustand/React Query baseline
- env tracking/ignore status 확인

미완료 상세 범위:

- `src/lib/api/*.ts` 전 파일별 method/data contract matrix
- React Query key invalidation matrix
- report/monitoring/crisis 화면별 workspace data isolation trace
- frontend build/lint warning 재검증
- dependency vulnerability audit는 production gate 기준 실행됨. dev-only audit cleanup은 별도 후속.

## 7. Type / generated type boundaries — pass 3

- Evidence: `package.json:10-12` — `lint`는 `eslint .`, `typecheck`는 `tsc --noEmit`, `gen:types`는 Supabase project `uggbeedbspbypvousmwi`에서 `src/types/database.types.ts`를 재생성한다.
- Evidence: `tsconfig.json:5-8` — `allowJs=true`, `strict=true`, `noEmit=true` 조합이다.
- Evidence: `src/types/database.types.ts:9-16` — generated `Database` 타입은 Supabase public schema를 포함한다.
- Evidence: `src/types/database.types.ts:1536-1631` — generated helper 타입 `Tables`, `TablesInsert`, `TablesUpdate`, `Enums`가 export된다.
- Evidence: `src/lib/api/reportApi.ts:1-6` — report API layer는 generated `Database['public']['Tables']`에서 row 타입을 좁혀 쓴다.
- Evidence: `src/types/report.ts:6-19`, `:23-34`, `:44-70`, `:74-86` — report domain 타입은 Zod schema + `z.infer`로 파생 타입을 별도 유지한다.
- Evidence: `src/types/session.ts:5-24`, `src/types/workspace.ts:3-21` — session/workspace domain 타입도 Zod schema 중심이다.
- Evidence: `src/types/database.types.ts` now includes generated `risk_notice_reads` table types and related `support_inquiries` / `risk_reports` schema additions from the latest main/typegen state.
- Evidence: `src/lib/api/reportApi.ts` uses typed Supabase `.from('risk_notice_reads')` for crisis read-state lookup/upsert instead of raw PostgREST `fetch`.
- Evidence: `src/lib/api/reportApi.riskNotice.test.ts` locks the typed crisis read-state lookup/upsert boundary, including no-session no-op, user-only upsert, onConflict, and error propagation.
- Verification: `cd sir-frontend && npm run typecheck` 통과 after the 2026-07-02 main merge.

Inference: frontend 타입 경계는 “generated Supabase DB 타입 + domain Zod 타입 + API-layer Pick/derived row 타입”의 3층 구조다. `risk_notice_reads` raw-fetch/type drift는 해소됐고 해당 typed boundary는 unit test로 고정됐다. 후속 리스크는 새 DB table/migration 추가 시 `gen:types`와 API-layer 타입 전환을 같은 pass에서 유지하는 것이다.
Confidence: High.

## 8. React Query / cache freshness surface — pass 4

- Evidence: `src/providers/QueryProvider.tsx:8-17` — 전역 query 기본값은 `staleTime=60s`, `retry=1`이다.
- Evidence: `src/hooks/report/useReportQuery.ts:24-45` — report key factory가 report/workspace 기반 prefix key를 제공한다.
- Evidence: `src/hooks/report/useReportQuery.ts:47-52` — 주간 보고서성 데이터는 `staleTime: Infinity`, `gcTime: 10m`, `refetchOnWindowFocus: false`로 고정한다.
- Evidence: `src/hooks/report/useReportQuery.ts:150-167`, `:198-215` — risk notice/read-state와 risk report 계열은 `staleTime=30s`, `gcTime=5m`으로 짧다.
- Evidence: `src/hooks/report/useReportQuery.test.ts` — report info/summary/channel stats/risk report query keys, enabled gates, and queryFn argument boundaries are unit-tested.
- Evidence: `src/hooks/report/useReportMutation.ts:73-80` — publish 성공 시 report info refetch와 workspace reports/progress/detail invalidation을 수행한다.
- Evidence: `src/hooks/report/useReportMutation.ts:96-116` — critical clear와 risk notice read mutation은 각각 risk item summary/read-state query를 invalidate한다.
- Evidence: `src/hooks/report/useReportMutation.test.ts` — `useMarkRiskNoticeRead`, report publish, summary optimistic update/rollback/refetch, and strategy optimistic update/rollback/refetch cache boundaries are unit-tested.
- Evidence: `src/hooks/report/useReportMutation.ts:145-156`, `:162-170` — risk report status/request 변경은 reportId 변형을 prefix key로 일괄 invalidate한다.
- Evidence: `src/hooks/report/useReportMutation.ts:180-202` — summary/strategy 편집은 optimistic update 후 rollback/refetch한다.
- Evidence: `src/hooks/workspace/useWorkspaceQuery.ts:74-130` — `sessions`, `session_strategies`, `reports` realtime change가 workspace progress/reports cache를 invalidate한다.
- Evidence: `src/hooks/monitoring/useMonitoringSearchLive.ts:11-27` — search live data는 workspace key 단위 365일 fetch 후 client-side date slice, `staleTime=1h`이다.

Inference: report 상세 데이터는 publish/regenerate 이후 명시 invalidation에 의존하고, 운영/위기 대응성 데이터는 짧은 staleTime 또는 realtime invalidation으로 freshness를 보강한다. Core report query/mutation key boundaries now have CI-safe unit coverage; 신규 mutation 추가 시 prefix key 설계와 `reportId`/period 변형 invalidation 누락 여부를 계속 matrix에 반영해야 한다.
Confidence: High.

## 9. Test and smoke surface — pass 7

- Evidence: `package.json:6-13` — `test: vitest run` and `typecheck: tsc --noEmit` are available; there is still no `e2e` script.
- Evidence: `vitest.config.ts` — Node test environment and `@` alias are configured for hermetic route-handler unit tests.
- Evidence: `src/app/api/admin/admin-route-validation.test.ts` — admin auth gates and `publish-report`, `clear-critical`, `reset-password` invalid body cases are covered without creating a service-role client.
- Evidence: `src/app/api/risk-report/risk-report-route-validation.test.ts` — `risk-report/request` auth/body validation and `risk-report/[id]` auth/membership/status/admin-note validation are covered with service-role writes/removes blocked on invalid paths.
- Evidence: `src/app/api/monitoring/search-trend/search-trend-route-boundary.test.ts` — unauthenticated/body/RLS-invisible workspace/company-name failure paths are covered before service-role cache access or Naver fetch.
- Evidence: `src/lib/api/reportApi.riskNotice.test.ts` — crisis read-state API paths are covered for no-session no-op, authenticated lookup, user-only upsert payload/onConflict, and error propagation.
- Evidence: `src/hooks/report/useReportMutation.test.ts` and `src/components/client/sidebar/SidebarMainNav.test.ts` — crisis NEW read-state cache invalidation and badge timestamp boundaries are covered without live Supabase/browser dependencies.
- Evidence: `src/lib/api/reportApi.reportData.test.ts` — report info route-param pair filtering, summary report-id filtering/schema parsing, and strategy sorting/fallback behavior are covered without live Supabase.
- Evidence: `src/hooks/report/useReportQuery.test.ts` and expanded `src/hooks/report/useReportMutation.test.ts` — report query key/enabled/queryFn and publish/summary/strategy cache mutation boundaries are covered.
- Evidence: `src/components/client/sidebar/sections.test.ts` — daily/weekly/initial report section mapping is covered without importing live UI icons.
- Evidence: `docs/code-audit/pdf-playwright-e2e-design.md` — PDF/auth Playwright e2e is designed but not installed; it requires stable auth storage-state fixtures and token-safe artifact policy.
- Evidence: repo-local test-like files excluding `node_modules` are operational scripts: `scripts/test-dknd-e2e.mjs`, `scripts/test-future-sub.mjs`, `scripts/test-grace-cron.mjs`, `scripts/test-rpc-double-click.mjs`, plus inspection/seed scripts.
- Evidence: no `playwright.config.*` found in this pass.
- Evidence: `scripts/seed-test-user.mjs` and `scripts/test-*.mjs` names indicate live/operational verification style rather than hermetic app unit tests.

High-value regression candidates:
1. Route/auth smoke: middleware/layout user/admin separation for `(app)` and `(client)` paths, support admin/client branching, plus `/report-pdf` token route behavior.
2. Query/cache regression: risk report status invalidation remains a useful follow-up; publish/summary/strategy and `risk_notice_reads` NEW badge/cache invalidation now have unit coverage.
3. Report UI regression: PDF-mode risk table row limiting, report section navigation rendering, channel/risk drawer open-only-when-data rules.
4. API route handler regression: remaining lower-risk/proxy route validation and any future service-role route additions.
5. Operational script safety: separate live Supabase smoke scripts from local CI tests and require explicit env guard for scripts that seed/mutate data.

Inference: frontend now has a conventional hermetic unit-test surface for high-risk route auth/body validation, the main service-role cache boundary, crisis NEW read-state/cache helper behavior, and first-pass report data/query/mutation/section logic, while browser/full-stack e2e remains manual/live-script based until the PDF/auth fixture design is implemented. Future tests should continue separating CI-safe unit tests from live Supabase smoke/e2e scripts.
Confidence: High.

## 10. Lint/typecheck/dependency verification — pass 3 + Phase 1A update

Initial commands run in `sir-frontend` on 2026-06-25 recorded the baseline: typecheck passed, app-source lint had 13 warnings, repo-level lint failed on Node script globals, and production audit had 6 vulnerabilities.

Phase 1A remediation verification run in `sir-frontend` on 2026-06-29:

- `git -C sir-frontend status --short --branch` — changed files were frontend-only: `eslint.config.js`, `package.json`, `package-lock.json`, `src/components/pipeline/ReportResult.tsx`, deleted `src/utils/reportPdf.ts`.
- `npm run lint` — passed with 0 errors and 13 existing warnings.
- `npx tsc --noEmit` — passed.
- `npm run build` — passed on Next.js `15.5.19`.
- `npm audit --omit=dev --audit-level=moderate` — passed with `found 0 vulnerabilities`.
- Local browser smoke after remediation — actual product PDF download still works.

Lint surface:

- Evidence: `package.json:10` runs repo-level `eslint .`.
- Evidence: `eslint.config.js:13-19` adds a narrow `scripts/**/*.mjs` override with Node globals and module semantics.
- Evidence: remaining lint warnings are app-source quality backlog only: `MobileSirStockChart.tsx` explicit `any`; `MobileFab.tsx` hook deps warning; `AnalysisResult.tsx` unused `AnalysisArticle`; TanStack Virtual incompatible-library warnings in `ChannelItemContent.tsx`, `NewsClusterContent.tsx`, and `RiskTable.tsx`; unused symbols in `reportApi.ts`, `QueryProvider.tsx`, and `types/report.ts`.

Production dependency audit surface:

- Evidence: legacy `src/utils/reportPdf.ts` was deleted.
- Evidence: `src/components/pipeline/ReportResult.tsx` no longer imports/calls `generateReportPdf`; it retains only DOCX export for the unreachable pipeline preview component.
- Evidence: final grep found no `jspdf`, `jspdf-autotable`, `jsPDF`, `autoTable`, `generateReportPdf`, or `reportPdf` references in source or manifests.
- Evidence: `npm ls jspdf jspdf-autotable dompurify lodash ws postcss next --omit=dev` resolves no `jspdf`/`jspdf-autotable`/`dompurify`, `next@15.5.19`, `lodash@4.18.1`, `ws@8.21.0`, and Next nested `postcss@8.5.10` via package override.
- Evidence: active product PDF flow remains backend/Playwright render through `PdfDownloadButton` and `/report-pdf/[workspaceId]/[reportId]`; local smoke confirmed PDF download still works.

Remaining audit surface:

- Evidence: full `npm audit --audit-level=moderate` still reports dev/transitive issues in `@babel/core`, `brace-expansion`, `flatted`, `js-yaml`, `picomatch`, and dev top-level `postcss`.

Inference: Phase 1A closed the frontend production dependency audit without touching backend/Supabase/PDF auth redesign. The correct jsPDF action was deletion, not upgrade, because the only jsPDF code path was an unreachable legacy pipeline branch. Remaining work is dev-toolchain audit cleanup and broader frontend quality/test backlog.
Confidence: High.

## 11. Client UI data isolation / RLS assumptions — pass 4

Covered UI surfaces in this pass: client report page, monitoring page, crisis center, client sidebar report/PDF controls.

- Evidence: `src/app/(client)/report/[workspaceId]/[reportId]/page.tsx:74-76` reads `workspaceId` and `reportId` independently from route params, then `useReportInfoSuspense(reportId)` drives report type/section branching.
- Evidence: `src/app/(client)/report/[workspaceId]/[reportId]/page.tsx:105-119`, `:201-220` passes both `workspaceId` and `reportId` to report section components.
- Evidence: `src/lib/api/reportApi.ts:141-147` resolves report meta/session IDs by `reportId`; item queries then also apply `.eq('workspace_id', workspaceId)` and report/session filters in paths such as `src/lib/api/reportApi.ts:648-684`, `:740-772`.
- Evidence: `src/app/(client)/monitoring/[workspaceId]/page.tsx:69-78`, `:100-114` derives the selected date range from the workspace route and calls monitoring hooks with `workspaceId`, `start`, `end`.
- Evidence: `src/lib/api/monitoringApi.ts:142-164`, `:219-228`, `:254-265`, `:311-322`, `:364-370` — monitoring direct Supabase queries filter by `workspace_id` for snapshots/stock/items/latest close before relying on RLS.
- Evidence: `src/lib/api/monitoringApi.ts:432-472` — AI analysis generation/latest calls proxy routes with the current user access token; backend applies `require_user` + `_assert_workspace_member` per backend audit matrix.
- Evidence: `src/app/(client)/crisis/[workspaceId]/page.tsx:36-53` queries `sessions` by `workspace_id` for session→report mapping.
- Evidence: `src/app/(client)/crisis/[workspaceId]/page.tsx:80-88`, `:90-96` uses `useRiskItems`, `useRiskReports`, `useRiskItemSummary`, reports list, and marks risk notice read on page visit; mutation internals are role-gated to `profile.role === 'user'` in `src/lib/api/reportApi.ts:910-918`.
- Evidence: `src/lib/api/reportApi.ts:775-802`, `:810-835` — crisis risk item/summary direct queries filter community/sns items by `workspace_id`, `is_relevant`, and non-null `critical_type`.
- Evidence: `src/components/client/sidebar/SidebarMainNav.tsx` enables NEW badge queries only for `isClientUser`; `ClientSidebar.tsx:47-52` derives that from `user?.role === 'user'`; `src/components/client/sidebar/riskNoticeBadge.ts` and `SidebarMainNav.test.ts` cover the timestamp comparison boundaries.
- Evidence: `src/components/client/sidebar/ReportSelector.tsx:16-31` lists published reports by `workspace_id` when the modal opens.
- Evidence: `src/components/client/sidebar/PdfDownloadButton.tsx:99-118`, `:161-167` verifies PDF metadata with both `reportId` and `workspaceId` before backend PDF delegation.
- Evidence: `src/app/report-pdf/[workspaceId]/[reportId]/page.tsx:129-137` blocks invalid report/workspace pairs before marking PDF ready.
- Evidence: `src/app/(client)/support/[workspaceId]/page.tsx:12-20` permits only `role='user'`; support data access goes through `src/lib/api/supportApi.ts` and RLS/RPC.

Inference: most client direct Supabase queries pair URL `workspaceId` with explicit `.eq('workspace_id', workspaceId)` and rely on browser anon session RLS for final tenant isolation. The prior report/PDF route-param mismatch concern is resolved on the main entry points by report↔workspace pair validation; remaining risk is ordinary regression risk if lower-level report helpers are reused outside those guarded entries.
Confidence: Medium/High.


## 12. Cross-repo PDF / client-admin role surface — pass 4

PDF handoff chain:

- Evidence: `src/components/client/sidebar/PdfDownloadButton.tsx:53-65` reads the current Supabase session and sends `Authorization: Bearer <access_token>` plus `X-Supabase-Refresh-Token` to backend `/api/report/{workspaceId}/{reportId}/pdf`.
- Evidence: `src/middleware.ts:13-15` excludes `/report-pdf` from the normal middleware matcher.
- Evidence: `src/lib/supabase/middleware.ts:7-13` also has a code-level early return for `/report-pdf`, because Playwright uses an injected session instead of cookies.
- Evidence: `src/app/report-pdf/[workspaceId]/[reportId]/page.tsx:15-62` consumes `window.__SIR_PDF_SESSION__`, deletes it, and waits for `supabase.auth.setSession(...)` before rendering.
- Evidence: `src/app/report-pdf/[workspaceId]/[reportId]/page.tsx:77-94` renders report sections with both route params and marks `html[data-pdf-ready="true"]` after Suspense data resolves.
- Backend counterpart: `sir-backend/services/pdf_service.py` injects the session via Playwright `context.add_init_script` and navigates to token-free `/report-pdf/{workspaceId}/{reportId}`; `sir-backend/main.py` accepts the user bearer plus refresh header and preflights access.

Role surface:

- Evidence: `src/lib/supabase/middleware.ts:63-82` prevents `role='user'` from `/workspace`, `/risk-reports`, and `/users`, and limits `/users` to `super_admin`.
- Evidence: `src/app/(app)/layout.tsx:10-16` repeats the guard so user role cannot render admin AppShell even if middleware misses.
- Evidence: `src/app/(client)/layout.tsx:4-9` has a TODO about role branching and currently renders `ClientShell` for any authenticated user returned by `getCurrentUser()`.
- Evidence: `src/app/(app)/support/page.tsx:7-21` and `src/app/(client)/support/[workspaceId]/page.tsx:12-20` intentionally split support inbox vs client support form by role.
- Evidence: `src/app/(client)/report/[workspaceId]/[reportId]/page.tsx:74-78` treats `workspaceId`, `reportId`, and `pdf` query mode as route-derived state.

Cross-repo smoke/e2e candidates:

1. PDF happy path: client user in workspace downloads a published report; backend returns PDF and frontend `/report-pdf` sets session then marks `data-pdf-ready`.
2. PDF mismatch path: valid user token with mismatched `{workspaceId, reportId}` or non-member workspace should fail before or during render without leaking another workspace's data.
3. Token hygiene path: failed PDF render must not log injected token values, authorization headers, or raw session payloads in surfaced error strings.
4. Role route path: user cannot render `(app)` admin shell; admin/super_admin access to `(client)` pages should be explicitly accepted or redirected according to product policy.

Inference: the frontend half of PDF generation intentionally bypasses middleware and relies on temporary browser session setup from backend-supplied tokens. That makes backend preflight and log redaction part of the same security boundary; frontend-only tests are insufficient.
Confidence: High.
