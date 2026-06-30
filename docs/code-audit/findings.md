# sir-frontend Findings — pass 3

작성일: 2026-06-25
최종 업데이트: 2026-06-30 — create-user super_admin 제한, service-role body validation 보강, monitoring AI proxy timeout/error normalization 반영.
표기: Evidence = 코드/설정 직접 근거, Inference = 근거 기반 추론, Unknown = 추가 확인 필요.

## Ranked findings

| Rank | Area | Finding | Severity | Confidence | Basis |
|---:|---|---|---|---|---|
| 1 | PDF auth | `/report-pdf`가 middleware를 우회하지만 P0.2에서 access/refresh token을 URL query 대신 Playwright injected session으로 전달한다. URL history/log/referrer 노출면은 줄었고, 남은 리스크는 user token을 backend→browser context로 위임하는 구조 자체다. | Low/Medium | High | `src/middleware.ts:13-15`, `src/lib/supabase/middleware.ts:8-13`, `src/app/report-pdf/[workspaceId]/[reportId]/page.tsx:15-62`, backend `sir-backend/services/pdf_service.py:18-84` |
| 2 | Service role boundary | Next route handlers가 service-role로 RLS를 우회하는 admin/cache 작업을 수행한다. `create-user`는 super_admin 전용으로 좁혔고, 고위험 service-role body validation 일부를 보강했다. 나머지 route별 감사 로그/검증 일관성은 별도 매트릭스 필요. | Medium | High | `src/app/api/admin/create-user/route.ts`, `src/app/api/admin/reset-password/route.ts`, `src/app/api/admin/workspace-tokens/[workspaceId]/route.ts`, `src/app/api/monitoring/search-trend/route.ts` |
| 3 | Client route policy | `user`는 admin shell 진입이 차단되고, admin/super_admin은 고객 화면 preview/지원 목적으로 client route 접근이 허용되는 정책으로 확인됐다. | Policy confirmed / Low | High | `src/lib/supabase/middleware.ts:63-94`, `src/app/(app)/layout.tsx:8-16`, `src/app/(client)/layout.tsx:6-9`; user decision 2026-06-29 |
| 4 | Environment secret handling | `.env.local`에 실제 secret이 로컬 평문으로 존재한다. git에는 ignore되지만 로컬/협업/캡처 유출 위험은 남는다. | Low/Process | High | `.env.local` key names, `.gitignore:16` ignores `*.local`, `git ls-files` shows not tracked |
| 5 | Error/network resilience | monitoring AI backend proxy route는 공통 helper로 timeout과 normalized 502/504 error shape를 갖는다. 남은 표면은 다른 외부/backend proxy route의 timeout/retry 일관성이다. | Resolved for monitoring AI / Low remaining | High | `src/app/api/monitoring/ai-analysis/_proxy.ts`; `src/app/api/monitoring/ai-analysis/**/route.ts` |
| 6 | Type drift | live DB에서 `risk_notice_reads` RLS 적용은 확인됐지만 generated Supabase 타입에는 아직 없어 raw PostgREST fetch 경계가 남아 있다. | Low/Medium | High | `rg risk_notice_reads src/types/database.types.ts` no match; `src/lib/api/reportApi.ts:887-918`; user-provided `pg_policies` result 2026-06-29 |
| 7 | Test surface | 공식 `test`/`typecheck`/`e2e` script와 test runner config가 없고, repo-local `test*.mjs`는 live/operational script 성격이다. | Medium | High | `package.json:6-11`; `find` test/config scan; `scripts/test-*.mjs` inventory |
| 8 | Lint/config | Phase 1A에서 `scripts/**/*.mjs` Node globals override를 추가해 repo-level `npm run lint`가 통과한다. 기존 app-source warnings 13건은 남아 있다. | Resolved/Low | High | `eslint.config.js:13-19`; `npm run lint` |
| 9 | Dependency vulnerabilities | Phase 1A에서 production audit는 0건으로 정리됐다. Legacy `jspdf`/`jspdf-autotable` dead path를 제거했고, `next`/`lodash`/`ws`/Next nested `postcss`를 lockfile/override로 보정했다. Dev-only audit 취약점은 별도 후속이다. | Resolved for prod / Dev risk remains | High | `package.json`, `package-lock.json`; `src/components/pipeline/ReportResult.tsx`; deleted `src/utils/reportPdf.ts`; `npm audit --omit=dev --audit-level=moderate` |
| 10 | Route param consistency | Phase 2에서 client report/PDF entry와 PDF metadata/API handoff가 `reports.id` + `workspace_id` 조합을 검증하도록 강화됐다. 남은 표면은 내부 helper가 `reportId`로 meta/session을 캐시하는 구조를 계속 entry guard 뒤에서만 쓰도록 유지하는 것이다. | Resolved major path / Low remaining | High | `src/lib/api/reportApi.ts:194-200`; `src/app/(client)/report/[workspaceId]/[reportId]/page.tsx:76-112`; `src/app/report-pdf/[workspaceId]/[reportId]/page.tsx:129-137`; `src/components/client/sidebar/PdfDownloadButton.tsx:99-118`, `:161-167` |
| 11 | Cross-repo PDF preflight | Phase 2에서 frontend download/render entry와 backend PDF API 모두 report↔workspace 조합을 차단한다. 남은 리스크는 user session을 backend→Playwright→frontend로 위임하는 구조와 수동 smoke coverage다. | Resolved preflight / Low remaining | High | `src/components/client/sidebar/PdfDownloadButton.tsx:99-118`, `:161-167`; `src/app/report-pdf/[workspaceId]/[reportId]/page.tsx:129-137`; backend `sir-backend/main.py` `_assert_report_pdf_access`/`report_pdf`, `sir-backend/services/pdf_service.py` |
| 12 | Client/admin policy ambiguity | Resolved by product policy: admin/super_admin must be able to access all client/report files/screens. No redirect change is needed; TODO is documentation cleanup only. | Resolved / Policy | High | `src/lib/supabase/middleware.ts:63-82`; `src/app/(app)/layout.tsx:10-16`; `src/app/(client)/layout.tsx:4-9`; user decision 2026-06-29 |
| 13 | Cross-repo smoke gap | Backend has hermetic PDF preflight/service tests; frontend/full-stack PDF render, token expiry, and log-redaction paths are covered by a manual smoke runbook rather than automated e2e for now. | Medium / Manual control | High | `package.json:6-11`; backend `tests/test_pdf_preflight.py`, `tests/test_pdf_service.py`; `docs/code-audit/pdf-smoke-runbook.md` |

## Evidence details

### F1. `/report-pdf` injected session flow

- Evidence: `src/middleware.ts:13-15` — matcher comment says `/report-pdf` is excluded because Playwright authenticates with an injected session.
- Evidence: `src/lib/supabase/middleware.ts:8-13` — `/report-pdf` path early returns before cookie auth checks.
- Evidence: `src/app/report-pdf/[workspaceId]/[reportId]/page.tsx:15-62` — consumes `window.__SIR_PDF_SESSION__`, deletes it, waits for `supabase.auth.setSession`, then renders.

Inference: this design still avoids a separate service account and relies on the caller user's RLS session. P0.2 removes normal URL-query token transport, reducing browser history/log/referrer exposure; remaining risk is the cross-process session handoff and any raw token logging in adjacent caller paths.

Verification note:
- Backend `tests/test_pdf_service.py` asserts Playwright navigates to `/report-pdf/{workspaceId}/{reportId}` without `?at=`/`?rt=` and closes the browser on render failure.

### F2. Service-role route boundary

- Evidence: `src/app/api/admin/create-user/route.ts` now requires caller role `super_admin` before service-role use; `admin` callers receive `403`. The handler also rejects non-object/invalid JSON, unknown `role`, invalid `tier`, and non-increasing subscription date ranges before any service-role write.
- Evidence: `src/app/api/admin/reset-password/route.ts:8-22` restricts reset to `super_admin`, then service-role admin update at `:38-43`.
- Evidence: `src/app/api/admin/workspace-tokens/[workspaceId]/route.ts` restricts PATCH to `super_admin`, then validates token patch body so `monthly_quota` must be a non-negative integer and `add_tokens` must be an integer before service-role RPC/update.
- Evidence: `src/app/api/monitoring/search-trend/route.ts:71-82` checks workspace access via RLS before service-role cache SELECT/UPSERT at `:90-94` and `:191-205`.

Inference: service-role usage is not automatically unsafe because routes perform role/membership checks first. The improvement target is consistency: route-by-route matrix of caller role, workspace validation, body validation, side effect, and audit log presence.

### F2b. Dead report-create frontend path removed

- Evidence: legacy `src/components/workspace/detail/CreateReportButton.tsx` was deleted.
- Evidence: `src/hooks/report/useReportMutation.ts` no longer exports `useCreateReport`, and `src/lib/api/reportApi.ts` no longer exports the stale `createReport(workspaceId)` frontend API helper.
- Evidence: static search for `CreateReportButton`, `useCreateReport`, `createReport(`, and `CreatedReport` in `src` returns no active references after deletion.

Inference: the active scheduled/manual report creation path remains the backend `/api/report` / `/api/cron/report` flow with explicit `type`; the removed frontend path only sent `workspace_id` and was unreachable dead code.

### F3. Client route role policy confirmed

- Evidence: `src/lib/supabase/middleware.ts:63-82` specifically blocks user from admin routes, but does not block admin from client routes.
- Evidence: `src/app/(client)/layout.tsx:6-9` renders `ClientShell` for any current user returned by `getCurrentUser`.
- User decision 2026-06-29: admin/super_admin must be able to access all files/screens, including client report/monitoring/crisis surfaces.

Inference: Current behavior is policy-aligned. No middleware/layout redirect change is needed; only TODO/comment documentation may be cleaned later.

### F5. Monitoring AI proxy resilience — resolved for current proxy family

- Evidence: `src/app/api/monitoring/ai-analysis/_proxy.ts` centralizes Authorization checks, backend URL configuration errors, backend response forwarding, a 30s `AbortSignal.timeout`, and normalized `502`/`504` JSON error responses.
- Evidence: `src/app/api/monitoring/ai-analysis/route.ts`, `estimate/route.ts`, and `latest/route.ts` now use the shared helper instead of duplicating raw `fetch`/catch blocks.

Inference: monitoring AI proxy routes now fail boundedly and consistently when the backend is down or slow. Remaining lower-priority work is checking other proxy/external fetch routes for the same timeout/error envelope pattern.

### F6. Generated Supabase type drift

- Evidence: `src/types/database.types.ts:1536-1631` exports generated helper types for tables/inserts/updates/enums.
- Evidence: `src/lib/api/reportApi.ts:1-6` uses `Database['public']['Tables']` for typed row narrowing.
- Evidence: `rg risk_notice_reads src/types/database.types.ts` returned no matches.
- Evidence: `src/lib/api/reportApi.ts:887-918` accesses `risk_notice_reads` through raw PostgREST `fetch()` with authenticated headers.
- Verification: `npx tsc --noEmit` passed.
- Live policy confirmation supplied by user on 2026-06-29: `risk_notice_reads_select_own_user`, `insert_own_user`, and `update_own_user` policies exist for authenticated `role='user'` workspace members only.

Inference: the read-state table is applied and RLS is policy-aligned. Frontend generated types have not caught up, so the remaining improvement is typegen + replacing/retiring the raw PostgREST escape if practical.

### F7. Test surface gap

- Evidence: `package.json:6-11` has no `test`, `typecheck`, or `e2e` script.
- Evidence: no `vitest.config.*`, `jest.config.*`, or `playwright.config.*` was found in this pass.
- Evidence: repo-local test-like files are `scripts/test-dknd-e2e.mjs`, `scripts/test-future-sub.mjs`, `scripts/test-grace-cron.mjs`, and `scripts/test-rpc-double-click.mjs`.

Inference: current frontend verification relies on build/lint/manual QA and operational scripts, not CI-safe unit/e2e tests. High-value missing tests include route auth boundaries, report/PDF rendering, risk NEW read-state cache invalidation, and admin route handler role gates.

### F8. Repo-level lint mismatch — Phase 1A resolved

- Evidence: `package.json:10` still runs repo-level `eslint .`.
- Evidence: `eslint.config.js:13-19` now scopes Node globals and ES module semantics to `scripts/**/*.mjs`.
- Evidence: `npm run lint` on 2026-06-29 passed with 0 errors and 13 existing warnings.
- Evidence: warnings are unchanged app-source quality items: explicit `any`, React hook dependency warning, TanStack Virtual `react-hooks/incompatible-library`, and unused symbols.

Inference: repo-level lint is now usable as a clean error gate for Phase 1A purposes. Remaining lint warnings are not introduced by the remediation and should be handled as normal frontend cleanup/backlog, not as a blocker for production dependency audit closure.

### F9. Dependency vulnerability surface — Phase 1A production remediation complete

- Evidence: `npm audit --omit=dev --audit-level=moderate` on 2026-06-29 returned `found 0 vulnerabilities`.
- Evidence: `src/utils/reportPdf.ts` was deleted and `src/components/pipeline/ReportResult.tsx` no longer imports/calls `generateReportPdf`.
- Evidence: final source/manifest grep found no `jspdf`, `jspdf-autotable`, `jsPDF`, `autoTable`, `generateReportPdf`, or `reportPdf` references in `src`, `package.json`, or `package-lock.json`.
- Evidence: reachability check found the legacy chain `reportPdf.ts` → `ReportResult.tsx` → `PipelineStages.tsx`, and `PipelineStages` is not imported by any active `src/app` route. The active product PDF flow remains `PdfDownloadButton` → backend API → `/report-pdf/[workspaceId]/[reportId]` Playwright render.
- Evidence: local browser smoke on 2026-06-29 confirmed actual product PDF download still works after jsPDF removal.
- Evidence: `npm ls jspdf jspdf-autotable dompurify lodash ws postcss next --omit=dev` resolves no `jspdf`/`jspdf-autotable`/`dompurify`, `next@15.5.19`, `lodash@4.18.1`, `ws@8.21.0`, and Next nested `postcss@8.5.10` via `overrides.next.postcss`.
- Evidence: full `npm audit --audit-level=moderate` still reports dev/transitive issues in `@babel/core`, `brace-expansion`, `flatted`, `js-yaml`, `picomatch`, and dev top-level `postcss`; these are outside the production `--omit=dev` gate.

Inference: Phase 1A frontend production dependency audit is closed. The correct remediation for `jspdf` was deletion rather than upgrade because the only jsPDF code path was unreachable legacy pipeline UI. The remaining audit work is dev-toolchain cleanup and should be tracked separately from production dependency risk.

### F10. Client route-param consistency — Phase 2 resolved major path

- Evidence: `src/lib/api/reportApi.ts:194-200` now fetches report info with both `id = reportId` and `workspace_id = workspaceId`.
- Evidence: `src/app/(client)/report/[workspaceId]/[reportId]/page.tsx:76-112` renders an error state instead of report sections when the pair is invalid.
- Evidence: `src/app/report-pdf/[workspaceId]/[reportId]/page.tsx:129-137` similarly stops PDF render and sets a PDF contract error when the pair is invalid.
- Evidence: `src/components/client/sidebar/PdfDownloadButton.tsx:99-118` fetches PDF period metadata with both `reportId` and `workspaceId`, and `:161-167` blocks backend PDF delegation when the pair is invalid.

Inference: manually constructed mismatched route params should no longer mix report metadata and workspace data at the report/PDF entry points. Internal helpers such as `getReportMeta(reportId)` still cache by report id, so they should remain behind entry guards or be revisited in a future cleanup if reused elsewhere.

### F11. Cross-repo PDF preflight — Phase 2 resolved preflight

- Evidence: `src/components/client/sidebar/PdfDownloadButton.tsx:99-118`, `:161-167` verifies frontend PDF metadata through `reports.id` + `workspace_id` before calling backend.
- Evidence: `src/middleware.ts:13-15` and `src/lib/supabase/middleware.ts:7-13` intentionally bypass normal middleware for `/report-pdf`.
- Evidence: `src/app/report-pdf/[workspaceId]/[reportId]/page.tsx:15-62` reads the injected Playwright session object, deletes it, and sets the browser Supabase session; `:129-137` blocks invalid report/workspace pairs.
- Evidence: backend `report_pdf` accepts bearer/refresh tokens from the browser caller, but `_assert_report_pdf_access` validates membership + report/workspace relation before `services/pdf_service.py` injects the session into Playwright and navigates to a token-free URL.

Inference: Unauthorized/mismatched PDF generation work is now blocked before or at render entry. Remaining risk is inherent session delegation plus failure-mode visibility, tracked by `docs/code-audit/pdf-smoke-runbook.md`.

### F12. Client/admin route policy confirmed

- Evidence: `src/lib/supabase/middleware.ts:63-82` blocks `role='user'` from admin routes and blocks non-super_admin from `/users` and `/crawl-history`.
- Evidence: `src/app/(app)/layout.tsx:10-16` repeats a user-role redirect before admin AppShell render.
- Evidence: `src/app/(client)/layout.tsx:4-9` has a TODO about role branch and renders ClientShell for any authenticated user.
- User decision 2026-06-29: admin/super_admin must have access to all screens/files.

Inference: admin/super_admin access to client routes is intended support/preview behavior. Future changes should preserve that access unless product policy changes.

### F13. Cross-repo smoke gap → manual runbook

- Evidence: `package.json:6-11` has no `test`, `typecheck`, or `e2e` script.
- Evidence: backend `tests/test_pdf_preflight.py` and `tests/test_pdf_service.py` cover preflight and token-free navigation only.
- Evidence: `docs/code-audit/pdf-smoke-runbook.md` now records manual smoke scenarios for valid PDF render, mismatch, token expiry, role policy, and token/log redaction.

Inference: full-stack PDF coverage remains manual for now because it depends on live auth/session/browser/backend coordination. This is acceptable as an audit control if run before release or after PDF/auth changes.

## Improvement backlog candidates

1. Continue route-handler body validation matrix for remaining `src/app/api/**/route.ts` (schema/no schema, numeric bounds, enum checks, error shape); high-risk create-user/workspace-token mutation bodies now have explicit guards.
2. Review remaining external/backend proxy routes for timeout and normalized error shape; monitoring AI proxy routes now use a common helper.
3. Regenerate Supabase DB types now that `risk_notice_reads` is confirmed applied, then replace/retire raw PostgREST type escape if practical.
4. Add explicit `typecheck` and CI-safe test scripts; keep live/operational smoke scripts behind env guards.
5. Triage remaining dev-only `npm audit` findings (`@babel/core`, `brace-expansion`, `flatted`, `js-yaml`, `picomatch`, dev `postcss`) separately from production audit closure.
6. Add high-value tests for route auth, report/PDF render, risk NEW read-state invalidation, and admin route handler role gates.
7. Run the manual cross-repo PDF smoke runbook after PDF/auth changes or before release.
8. Preserve current policy that admin/super_admin can access client routes for preview/support.
9. Keep removed dead report-create UI path out unless a future UI reintroduces explicit `type` and backend-aligned validation.
