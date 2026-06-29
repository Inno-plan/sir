# sir-frontend Structure Map — pass 1

작성일: 2026-06-25  
상태: 1차 구조 탐색 기반 + P0.2 PDF 개선 반영본.

## 1. Runtime / framework baseline

- Evidence: `package.json:6-11` — scripts는 `dev`, `build`, `start`, `lint`, `gen:types` 중심.
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

- `(app)` 관리자/운영 경로: `/`, `/workspace`, `/risk-reports`, `/users`, `/ops`, `/crawl-history`.
- `(client)` 고객 경로: `/report/[workspaceId]/[reportId]`, `/monitoring/[workspaceId]`, `/crisis/[workspaceId]`, `/insights-history/[workspaceId]`.
- `src/app/api/admin/*` — Next route handler가 service-role Supabase client로 관리자 작업 수행.
- `src/app/api/monitoring/*` — 일부 backend proxy + 일부 Next route 직접 처리.
- `src/app/report-pdf/[workspaceId]/[reportId]` — PDF 렌더링용 client page.

Evidence: local `find src/app` route inventory, `src/app/(app)/layout.tsx`, `src/app/(client)/layout.tsx`, `src/app/api/**/route.ts`.
Confidence: High.

## 3. Supabase client boundaries

- Evidence: `src/lib/supabase/client.ts:4-8` — browser client는 `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` 사용.
- Evidence: `src/lib/supabase/server.ts:5-27` — server client는 cookies 기반 SSR session 사용.
- Evidence: `src/app/api/admin/create-user/route.ts:25-28` — admin route handler 내부에서 `SUPABASE_SERVICE_ROLE_KEY` client 생성.
- Evidence: `src/app/api/admin/reset-password/route.ts:38-43` — service-role로 auth admin password update 수행.
- Evidence: `src/app/api/admin/workspace-tokens/route.ts:23-31` — service-role로 workspace token data 조회.
- Evidence: `src/app/api/monitoring/search-trend/route.ts:90-94` — cache table 접근을 위해 service-role client 생성.

Inference: 데이터 접근은 3계층이 혼재한다.
1. Browser/SSR Supabase anon + RLS.
2. Next route handler service-role admin operations.
3. Next route handler proxy to Python backend (`NEXT_PUBLIC_API_URL`) for selected monitoring/AI paths.
Confidence: High.

## 4. Auth / routing flow

- Evidence: `src/middleware.ts:8-16` — middleware matcher가 static assets, health API, report-pdf 등을 제외.
- Evidence: `src/lib/supabase/middleware.ts:46-50` — 미인증 사용자는 `/auth/login`으로 redirect.
- Evidence: `src/lib/supabase/middleware.ts:63-82` — `/workspace`, `/risk-reports`, `/users`, `/crawl-history`에 role guard 적용. `/users`, `/crawl-history`는 `super_admin`만 허용.
- Evidence: `src/lib/supabase/middleware.ts:85-94` — `/` 진입 시 `role='user'`는 최신 report 또는 `/no-report`로 redirect.
- Evidence: `src/app/(app)/layout.tsx:8-16` — user role이 admin AppShell에 진입하지 못하도록 layout에서 추가 guard.
- Evidence: `src/app/(client)/layout.tsx:6-9` — client shell은 현재 `getCurrentUser()` 후 별도 role 차단 없이 렌더.
- Evidence: `src/lib/auth/resolveLandingPath.ts:12-29` — `get_user_landing` RPC로 role/workspace/report 기반 landing path 결정.

Inference: admin route 보호는 middleware + layout 이중 guard가 있고, client route는 authenticated user이면 접근 가능하도록 설계된 것으로 보인다. 이것이 의도인지, admin preview 허용인지, user-only surface인지 추가 정책 확인이 필요하다.
Confidence: Medium.

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
- dependency vulnerability audit (`npm audit`) — 아직 실행하지 않음

## 7. Type / generated type boundaries — pass 3

- Evidence: `package.json:10-11` — `lint`는 `eslint .`, `gen:types`는 Supabase project `uggbeedbspbypvousmwi`에서 `src/types/database.types.ts`를 재생성한다.
- Evidence: `tsconfig.json:5-8` — `allowJs=true`, `strict=true`, `noEmit=true` 조합이다.
- Evidence: `src/types/database.types.ts:9-16` — generated `Database` 타입은 Supabase public schema를 포함한다.
- Evidence: `src/types/database.types.ts:1536-1631` — generated helper 타입 `Tables`, `TablesInsert`, `TablesUpdate`, `Enums`가 export된다.
- Evidence: `src/lib/api/reportApi.ts:1-6` — report API layer는 generated `Database['public']['Tables']`에서 row 타입을 좁혀 쓴다.
- Evidence: `src/types/report.ts:6-19`, `:23-34`, `:44-70`, `:74-86` — report domain 타입은 Zod schema + `z.infer`로 파생 타입을 별도 유지한다.
- Evidence: `src/types/session.ts:5-24`, `src/types/workspace.ts:3-21` — session/workspace domain 타입도 Zod schema 중심이다.
- Evidence: `rg risk_notice_reads src/types/database.types.ts` 결과 없음; `src/lib/api/reportApi.ts:887-918` — 최근 추가된 `risk_notice_reads`는 generated DB 타입에 아직 없고, PostgREST `fetch()`로 직접 접근한다.
- Verification: `cd sir-frontend && npx tsc --noEmit` 통과.

Inference: frontend 타입 경계는 “generated Supabase DB 타입 + domain Zod 타입 + API-layer Pick/derived row 타입”의 3층 구조다. 신규 DB table을 migration 후 바로 쓰는 경우 generated 타입이 뒤처질 수 있고, 그때 raw PostgREST path가 생긴다. 현재 typecheck는 통과하지만 `risk_notice_reads`는 typed Supabase client 경계 밖에 있다.
Confidence: High.

## 8. React Query / cache freshness surface — pass 3

- Evidence: `src/providers/QueryProvider.tsx:8-17` — 전역 query 기본값은 `staleTime=60s`, `retry=1`이다.
- Evidence: `src/hooks/report/useReportQuery.ts:24-45` — report key factory가 report/workspace 기반 prefix key를 제공한다.
- Evidence: `src/hooks/report/useReportQuery.ts:47-52` — 주간 보고서성 데이터는 `staleTime: Infinity`, `gcTime: 10m`, `refetchOnWindowFocus: false`로 고정한다.
- Evidence: `src/hooks/report/useReportQuery.ts:150-167`, `:198-215` — risk notice/read-state와 risk report 계열은 `staleTime=30s`, `gcTime=5m`으로 짧다.
- Evidence: `src/hooks/report/useReportMutation.ts:73-80` — publish 성공 시 report info refetch와 workspace reports/progress/detail invalidation을 수행한다.
- Evidence: `src/hooks/report/useReportMutation.ts:96-116` — critical clear와 risk notice read mutation은 각각 risk item summary/read-state query를 invalidate한다.
- Evidence: `src/hooks/report/useReportMutation.ts:145-156`, `:162-170` — risk report status/request 변경은 reportId 변형을 prefix key로 일괄 invalidate한다.
- Evidence: `src/hooks/report/useReportMutation.ts:180-202` — summary/strategy 편집은 optimistic update 후 rollback/refetch한다.
- Evidence: `src/hooks/workspace/useWorkspaceQuery.ts:74-130` — `sessions`, `session_strategies`, `reports` realtime change가 workspace progress/reports cache를 invalidate한다.
- Evidence: `src/hooks/monitoring/useMonitoringSearchLive.ts:11-27` — search live data는 workspace key 단위 365일 fetch 후 client-side date slice, `staleTime=1h`이다.

Inference: report 상세 데이터는 publish/regenerate 이후 명시 invalidation에 의존하고, 운영/위기 대응성 데이터는 짧은 staleTime 또는 realtime invalidation으로 freshness를 보강한다. 신규 mutation 추가 시 prefix key 설계와 `reportId`/period 변형 invalidation 누락 여부를 계속 matrix에 반영해야 한다.
Confidence: High.

## 9. Test and smoke surface — pass 3

- Evidence: `package.json:6-11` — scripts에 `test`, `typecheck`, `e2e`가 없고 `dev/build/start/lint/gen:types`만 있다.
- Evidence: repo-local test-like files excluding `node_modules` are operational scripts: `scripts/test-dknd-e2e.mjs`, `scripts/test-future-sub.mjs`, `scripts/test-grace-cron.mjs`, `scripts/test-rpc-double-click.mjs`, plus inspection/seed scripts.
- Evidence: no `vitest.config.*`, `jest.config.*`, or `playwright.config.*` found in this pass.
- Evidence: `scripts/seed-test-user.mjs` and `scripts/test-*.mjs` names indicate live/operational verification style rather than hermetic app unit tests.

High-value regression candidates:
1. Route/auth smoke: middleware user/admin separation for `(app)` and `(client)` paths, plus `/report-pdf` token route behavior.
2. Query/cache regression: `risk_notice_reads` NEW badge flow, risk report status invalidation, publish invalidation of workspace progress/detail.
3. Report UI regression: PDF-mode risk table row limiting, report section navigation, channel/risk drawer open-only-when-data rules.
4. API route handler regression: admin route role gates and `search-trend` RLS-before-service-role cache path.
5. Operational script safety: separate live Supabase smoke scripts from local CI tests and require explicit env guard for scripts that seed/mutate data.

Inference: frontend currently has useful operational scripts but lacks a conventional hermetic test runner surface. A future test plan should distinguish CI-safe tests from live Supabase smoke/e2e scripts.
Confidence: High.

## 10. Lint/typecheck/dependency verification — pass 3

Commands run in `sir-frontend` on 2026-06-25:

- `npx tsc --noEmit` — passed.
- `npm run lint` — failed with 202 problems: 189 errors and 13 warnings.
- `npx eslint src` — passed with 13 warnings and 0 errors.
- `npm audit --omit=dev` — failed with 6 production vulnerabilities: 2 moderate, 3 high, 1 critical.
- `npm audit` — failed with 11 total vulnerabilities: 1 low, 4 moderate, 5 high, 1 critical.

Lint surface:

- Evidence: `eslint.config.js:9-21` ignores only `dist`, `.next`, `next-env.d.ts`, and configures browser globals only for `**/*.{ts,tsx}`.
- Evidence: `package.json:10` runs `eslint .`, so root `scripts/*.mjs` are linted by `js.configs.recommended` without Node globals.
- Evidence: `npm run lint` errors are concentrated in `scripts/*.mjs` as `process`, `console`, `URL`, `setTimeout` `no-undef`.
- Evidence: `npx eslint src` has 13 warnings only: `MobileSirStockChart.tsx` explicit `any` at lines `72`, `111`, `308`; `MobileFab.tsx:46` hook deps warning; `AnalysisResult.tsx:10` unused `AnalysisArticle`; TanStack Virtual incompatible-library warnings in `ChannelItemContent.tsx:49`, `NewsClusterContent.tsx:189`, `RiskTable.tsx:121`; unused `_reportId/_periodStart/_periodEnd` in `reportApi.ts:457-459`; unused `ReactQueryDevtools` import in `QueryProvider.tsx:5`; unused `sentimentEnum` import in `types/report.ts:2`.

Dependency audit surface:

- Evidence: `package.json:28-31` direct production deps include `jspdf` and `next`.
- Evidence: `npm ls next jspdf dompurify lodash ws postcss --depth=4` resolved `next@15.5.12`, `jspdf@4.2.0`, `dompurify@3.3.3` via `jspdf`, `lodash@4.17.23` via `@nivo/*`, `ws@8.19.0` via `@supabase/realtime-js`, `postcss@8.4.31` via `next`, and top-level `postcss@8.5.8` via `@tailwindcss/postcss`.
- Evidence: `npm audit --omit=dev` reported critical `jspdf`, high `next`, high `lodash`, high `ws`, moderate `dompurify`, moderate `postcss` advisories; `npm audit fix` was not run.

Inference: application `src` lint is warning-only, but the repo-level `lint` script is not currently CI-clean because Node scripts lack matching ESLint globals/overrides. Dependency vulnerabilities require upgrade triage, especially `jspdf`/`next`; this pass records them only and does not change packages.
Confidence: High.

## 11. Client UI data isolation / RLS assumptions — pass 3

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
- Evidence: `src/components/client/sidebar/SidebarMainNav.tsx:49-69` enables NEW badge queries only for `isClientUser`; `ClientSidebar.tsx:47-52` derives that from `user?.role === 'user'`.
- Evidence: `src/components/client/sidebar/ReportSelector.tsx:16-31` lists published reports by `workspace_id` when the modal opens.
- Evidence: `src/components/client/sidebar/PdfDownloadButton.tsx:12-33` fetches workspace company by `workspaceId` and report period by `reportId` separately for the download filename, then `:60-65` sends user access/refresh tokens to backend PDF endpoint.

Inference: most client direct Supabase queries pair URL `workspaceId` with explicit `.eq('workspace_id', workspaceId)` and rely on browser anon session RLS for final tenant isolation. The report/PDF path still has a route-param consistency risk: report metadata can be read by `reportId` while adjacent data is scoped by `workspaceId`, so a mismatched `/report/{workspaceId}/{reportId}` URL could produce inconsistent UI or backend work even if RLS prevents unauthorized cross-tenant data. This is related to, but separate from, the backend PDF preflight gap.
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

- Evidence: `src/lib/supabase/middleware.ts:63-82` prevents `role='user'` from `/workspace`, `/risk-reports`, `/users`, and `/crawl-history`, and limits `/users`/`/crawl-history` to `super_admin`.
- Evidence: `src/app/(app)/layout.tsx:10-16` repeats the guard so user role cannot render admin AppShell even if middleware misses.
- Evidence: `src/app/(client)/layout.tsx:4-9` has a TODO about role branching and currently renders `ClientShell` for any authenticated user returned by `getCurrentUser()`.
- Evidence: `src/app/(client)/report/[workspaceId]/[reportId]/page.tsx:74-78` treats `workspaceId`, `reportId`, and `pdf` query mode as route-derived state.

Cross-repo smoke/e2e candidates:

1. PDF happy path: client user in workspace downloads a published report; backend returns PDF and frontend `/report-pdf` sets session then marks `data-pdf-ready`.
2. PDF mismatch path: valid user token with mismatched `{workspaceId, reportId}` or non-member workspace should fail before or during render without leaking another workspace's data.
3. Token hygiene path: failed PDF render must not log injected token values, authorization headers, or raw session payloads in surfaced error strings.
4. Role route path: user cannot render `(app)` admin shell; admin/super_admin access to `(client)` pages should be explicitly accepted or redirected according to product policy.

Inference: the frontend half of PDF generation intentionally bypasses middleware and relies on temporary browser session setup from backend-supplied tokens. That makes backend preflight and log redaction part of the same security boundary; frontend-only tests are insufficient.
Confidence: High.
