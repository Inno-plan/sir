# sir-frontend Findings — pass 3

작성일: 2026-06-25  
표기: Evidence = 코드/설정 직접 근거, Inference = 근거 기반 추론, Unknown = 추가 확인 필요.

## Ranked findings

| Rank | Area | Finding | Severity | Confidence | Basis |
|---:|---|---|---|---|---|
| 1 | PDF auth | `/report-pdf`가 middleware를 우회하지만 P0.2에서 access/refresh token을 URL query 대신 Playwright injected session으로 전달한다. URL history/log/referrer 노출면은 줄었고, 남은 리스크는 user token을 backend→browser context로 위임하는 구조 자체다. | Low/Medium | High | `src/middleware.ts:13-15`, `src/lib/supabase/middleware.ts:8-13`, `src/app/report-pdf/[workspaceId]/[reportId]/page.tsx:15-62`, backend `sir-backend/services/pdf_service.py:18-84` |
| 2 | Service role boundary | Next route handlers가 service-role로 RLS를 우회하는 admin/cache 작업을 수행한다. 대부분 caller role check가 있으나, 각 route별 입력 검증/감사 일관성은 별도 매트릭스 필요. | Medium | High | `src/app/api/admin/create-user/route.ts:9-28`, `src/app/api/admin/reset-password/route.ts:8-43`, `src/app/api/admin/workspace-tokens/[workspaceId]/route.ts:13-52`, `src/app/api/monitoring/search-trend/route.ts:90-94` |
| 3 | Role boundary ambiguity | middleware/admin layout은 user의 admin 진입을 막지만, client layout은 role별 차단이 없다. admin이 client URL에 직접 접근 가능한 정책인지 추가 확인 필요. | Low/Medium | Medium | `src/lib/supabase/middleware.ts:63-94`, `src/app/(app)/layout.tsx:8-16`, `src/app/(client)/layout.tsx:6-9` |
| 4 | Environment secret handling | `.env.local`에 실제 secret이 로컬 평문으로 존재한다. git에는 ignore되지만 로컬/협업/캡처 유출 위험은 남는다. | Low/Process | High | `.env.local` key names, `.gitignore:16` ignores `*.local`, `git ls-files` shows not tracked |
| 5 | Error/network resilience | backend proxy route 일부는 기본 fetch 위주이고, timeout/circuit-breaker 공통 유틸은 아직 확인되지 않았다. | Low/Medium | Medium | `src/app/api/monitoring/ai-analysis/*.ts` scan; detailed utility search pending |
| 6 | Type drift | `risk_notice_reads`가 generated Supabase 타입에 없어서 raw PostgREST fetch 경계로 구현되어 있다. typecheck는 통과하지만 신규 table이 typed client 경계 밖에 남아 있다. | Low/Medium | High | `rg risk_notice_reads src/types/database.types.ts` no match; `src/lib/api/reportApi.ts:887-918` |
| 7 | Test surface | 공식 `test`/`typecheck`/`e2e` script와 test runner config가 없고, repo-local `test*.mjs`는 live/operational script 성격이다. | Medium | High | `package.json:6-11`; `find` test/config scan; `scripts/test-*.mjs` inventory |
| 8 | Lint/config | `npm run lint`가 `scripts/*.mjs`를 Node globals 없이 검사해 repo-level lint가 실패한다. 앱 `src` lint는 13 warnings/0 errors다. | Low/Medium | High | `eslint.config.js:9-21`; `package.json:10`; `npm run lint`; `npx eslint src` |
| 9 | Dependency vulnerabilities | `npm audit --omit=dev` 기준 production dependency에 critical/high 취약점이 남아 있다. 패키지 업그레이드 영향도 분석이 필요하다. | High | High | `npm audit --omit=dev`; `npm ls next jspdf dompurify lodash ws postcss --depth=4`; `package.json:28-31` |
| 10 | Route param consistency | client report/PDF paths pass `workspaceId` and `reportId` independently and some metadata queries bind only one side. RLS helps authorization, but mismatched route params can still create inconsistent UI/backend render work. | Low/Medium | Medium/High | `src/app/(client)/report/[workspaceId]/[reportId]/page.tsx:74-76`; `src/lib/api/reportApi.ts:141-147`; `src/components/client/sidebar/PdfDownloadButton.tsx:17-23` |
| 11 | Cross-repo PDF preflight | PDF generation spans frontend middleware bypass, backend preflight, injected Playwright session, and frontend render-time RLS. Backend now validates report↔workspace before rendering; frontend still has no independent pair validation before delegating. | Low/Medium | High | `src/components/client/sidebar/PdfDownloadButton.tsx:53-65`; `src/app/report-pdf/[workspaceId]/[reportId]/page.tsx:15-62`; backend `sir-backend/main.py` `report_pdf`/`_assert_report_pdf_access`, `sir-backend/services/pdf_service.py:18-84` |
| 12 | Client/admin policy ambiguity | `user` is blocked from admin shell, but admin/super_admin access to client routes appears allowed by omission/TODO rather than explicit product policy. | Low/Medium | Medium | `src/lib/supabase/middleware.ts:63-82`; `src/app/(app)/layout.tsx:10-16`; `src/app/(client)/layout.tsx:4-9` |
| 13 | Cross-repo smoke gap | Backend now has hermetic PDF preflight/service tests, but no frontend or cross-repo e2e runner covers the full PDF render, token expiry, redaction, or client/admin route policy. | Medium | High | `package.json:6-11`; backend `tests/test_pdf_preflight.py`, `tests/test_pdf_service.py`; `structure.md` §9/§12; `route-api-matrix.md` §5 |

## Evidence details

### F1. `/report-pdf` injected session flow

- Evidence: `src/middleware.ts:13-15` — matcher comment says `/report-pdf` is excluded because Playwright authenticates with an injected session.
- Evidence: `src/lib/supabase/middleware.ts:8-13` — `/report-pdf` path early returns before cookie auth checks.
- Evidence: `src/app/report-pdf/[workspaceId]/[reportId]/page.tsx:15-62` — consumes `window.__SIR_PDF_SESSION__`, deletes it, waits for `supabase.auth.setSession`, then renders.

Inference: this design still avoids a separate service account and relies on the caller user's RLS session. P0.2 removes normal URL-query token transport, reducing browser history/log/referrer exposure; remaining risk is the cross-process session handoff and any raw token logging in adjacent caller paths.

Verification note:
- Backend `tests/test_pdf_service.py` asserts Playwright navigates to `/report-pdf/{workspaceId}/{reportId}` without `?at=`/`?rt=` and closes the browser on render failure.

### F2. Service-role route boundary

- Evidence: `src/app/api/admin/create-user/route.ts:9-23` validates caller role before service-role use at `:25-28`.
- Evidence: `src/app/api/admin/reset-password/route.ts:8-22` restricts reset to `super_admin`, then service-role admin update at `:38-43`.
- Evidence: `src/app/api/admin/workspace-tokens/[workspaceId]/route.ts:18-30` restricts PATCH to `super_admin`, then service-role at `:49-52`.
- Evidence: `src/app/api/monitoring/search-trend/route.ts:71-82` checks workspace access via RLS before service-role cache SELECT/UPSERT at `:90-94` and `:191-205`.

Inference: service-role usage is not automatically unsafe because routes perform role/membership checks first. The improvement target is consistency: route-by-route matrix of caller role, workspace validation, body validation, side effect, and audit log presence.

### F3. Client route role policy unknown

- Evidence: `src/lib/supabase/middleware.ts:63-82` specifically blocks user from admin routes, but does not block admin from client routes.
- Evidence: `src/app/(client)/layout.tsx:6-9` renders `ClientShell` for any current user returned by `getCurrentUser`.

Unknown: Whether admin/super_admin direct access to `/report`, `/monitoring`, `/crisis` is intended for support/preview, or should be blocked to client users only.

### F6. Generated Supabase type drift

- Evidence: `src/types/database.types.ts:1536-1631` exports generated helper types for tables/inserts/updates/enums.
- Evidence: `src/lib/api/reportApi.ts:1-6` uses `Database['public']['Tables']` for typed row narrowing.
- Evidence: `rg risk_notice_reads src/types/database.types.ts` returned no matches.
- Evidence: `src/lib/api/reportApi.ts:887-918` accesses `risk_notice_reads` through raw PostgREST `fetch()` with authenticated headers.
- Verification: `npx tsc --noEmit` passed.

Inference: the recent read-state table is intentionally reachable at runtime through RLS/PostgREST, but frontend generated types have not caught up. Future work should regenerate DB types after migration application and replace the raw typed boundary if possible.

### F7. Test surface gap

- Evidence: `package.json:6-11` has no `test`, `typecheck`, or `e2e` script.
- Evidence: no `vitest.config.*`, `jest.config.*`, or `playwright.config.*` was found in this pass.
- Evidence: repo-local test-like files are `scripts/test-dknd-e2e.mjs`, `scripts/test-future-sub.mjs`, `scripts/test-grace-cron.mjs`, and `scripts/test-rpc-double-click.mjs`.

Inference: current frontend verification relies on build/lint/manual QA and operational scripts, not CI-safe unit/e2e tests. High-value missing tests include route auth boundaries, report/PDF rendering, risk NEW read-state cache invalidation, and admin route handler role gates.

### F8. Repo-level lint mismatch

- Evidence: `package.json:10` runs `eslint .`.
- Evidence: `eslint.config.js:9-21` applies browser globals for `**/*.{ts,tsx}` only and does not define Node globals for `scripts/*.mjs`.
- Evidence: `npm run lint` failed with 189 errors, concentrated in `scripts/*.mjs` as `process`/`console`/`URL`/`setTimeout` `no-undef`.
- Evidence: `npx eslint src` passed with 13 warnings and 0 errors.

Inference: production app source is not currently blocked by lint errors, but repo-level lint cannot be used as a clean CI gate until script overrides/ignore policy is clarified.

### F9. Dependency vulnerability surface

- Evidence: `npm audit --omit=dev` reported 6 production vulnerabilities: moderate `dompurify`, critical `jspdf`, high `lodash`, high `next`, moderate `postcss`, high `ws`.
- Evidence: `npm audit` reported 11 total vulnerabilities including additional dev/transitive issues in `@babel/core`, `brace-expansion`, `flatted`, `js-yaml`, and `picomatch`.
- Evidence: `npm ls next jspdf dompurify lodash ws postcss --depth=4` resolved `next@15.5.12`, `jspdf@4.2.0`, `dompurify@3.3.3` via `jspdf`, `lodash@4.17.23` via `@nivo/*`, `ws@8.19.0` via `@supabase/realtime-js`, and vulnerable `postcss` copies through Next/Tailwind paths.

Inference: `npm audit fix` should not be run blindly because major UI/rendering/runtime packages are involved. Recommended next step is dependency-impact triage by package owner surface: PDF export (`jspdf`/`dompurify`), framework/runtime (`next`/`postcss`), visualization (`@nivo`/`lodash`), realtime (`@supabase`/`ws`).

### F10. Client route-param consistency risk

- Evidence: `src/app/(client)/report/[workspaceId]/[reportId]/page.tsx:74-76` reads `workspaceId` and `reportId` independently from route params.
- Evidence: `src/lib/api/reportApi.ts:141-147` resolves report meta and session IDs by `reportId`. Adjacent report item queries also apply `workspaceId` filters, for example `src/lib/api/reportApi.ts:648-684` and `:740-772`.
- Evidence: `src/components/client/sidebar/PdfDownloadButton.tsx:17-23` fetches workspace company by `workspaceId` and report period by `reportId` separately for PDF filename metadata.
- Evidence: `src/components/client/sidebar/PdfDownloadButton.tsx:60-65` calls backend PDF generation with both path params and forwards the user access/refresh tokens.

Inference: normal navigation likely supplies a matching pair, and Supabase RLS should constrain unauthorized data. However, a manually constructed mismatched URL can cause report metadata/type from one report to be combined with workspace-scoped data from another route param, or produce inconsistent frontend metadata even though backend now rejects mismatched PDF requests before Playwright. Suggested mitigation should be recorded only: validate report belongs to workspace at report/PDF entry points or canonicalize navigation after lookup.

### F11. Cross-repo PDF preflight

- Evidence: `src/components/client/sidebar/PdfDownloadButton.tsx:53-65` forwards access and refresh tokens to backend PDF endpoint.
- Evidence: `src/middleware.ts:13-15` and `src/lib/supabase/middleware.ts:7-13` intentionally bypass normal middleware for `/report-pdf`.
- Evidence: `src/app/report-pdf/[workspaceId]/[reportId]/page.tsx:15-62` reads the injected Playwright session object, deletes it, and sets the browser Supabase session.
- Evidence: backend `report_pdf` still accepts bearer/refresh tokens from the browser caller, but `sir-backend/services/pdf_service.py` now injects them into the Playwright context before navigating to a token-free `/report-pdf` URL.

Inference: PDF generation's security boundary remains split across both repos. Backend preflight and token-free Playwright navigation reduce blast radius, but frontend render-time RLS and cross-repo smoke coverage remain necessary.

### F12. Client/admin route policy ambiguity

- Evidence: `src/lib/supabase/middleware.ts:63-82` blocks `role='user'` from admin routes and blocks non-super_admin from `/users` and `/crawl-history`.
- Evidence: `src/app/(app)/layout.tsx:10-16` repeats a user-role redirect before admin AppShell render.
- Evidence: `src/app/(client)/layout.tsx:4-9` has a TODO about role branch and renders ClientShell for any authenticated user.

Unknown: whether admin/super_admin should be allowed to preview client pages or redirected away from customer-only routes.

### F13. Cross-repo smoke gap

- Evidence: `package.json:6-11` has no `test`, `typecheck`, or `e2e` script.
- Evidence: `structure.md` §12 and `route-api-matrix.md` §5 list PDF render/token-expiry/role smoke candidates; backend `tests/test_pdf_preflight.py` and `tests/test_pdf_service.py` cover preflight and token-free navigation only.

Inference: the highest-risk PDF and role-boundary paths are integration concerns and need a cross-repo smoke suite or explicit manual runbook.

## Improvement backlog candidates

1. Create route-handler authorization matrix for all `src/app/api/**/route.ts`.
2. Review remaining PDF token handoff/logging risk and consider one-time short-lived render token only if injected-session handoff remains insufficient.
3. Decide client route access policy for admin/super_admin and encode it in middleware/layout if needed.
4. Add common backend proxy helper with timeout and normalized error shape.
5. Regenerate Supabase DB types after applying `risk_notice_reads`, then replace/retire raw PostgREST type escape if possible.
6. Split frontend verification into CI-safe scripts: `typecheck`, app-source lint, and separate live/operational smoke scripts with env guards.
7. Triage `npm audit` production issues by owner surface before package upgrades: `jspdf`/`dompurify`, `next`/`postcss`, `@nivo`/`lodash`, `@supabase`/`ws`.
8. Add high-value tests for route auth, report/PDF render, risk NEW read-state invalidation, and admin route handler role gates.
9. Add report/workspace pair validation or canonical redirect checks for client report and PDF entry points.
10. Add cross-repo PDF smoke tests for happy path, token expiry, frontend render failure, and log redaction; backend mismatch/non-member paths now have hermetic coverage.
11. Decide and document whether admin/super_admin may access client routes as preview.
