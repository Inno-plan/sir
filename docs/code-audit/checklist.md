# sir-frontend 코드 감사 체크리스트

> 목적: SIR frontend 구조, 데이터 흐름, 보안/취약점, 성능/최적화, 유지보수 개선점을 근거 파일과 함께 누적한다.
> 규칙: 체크 완료 항목은 근거 파일/라인 또는 요약 파일을 함께 남긴다.

## 0. 저장소 기준선

- [x] 패키지/스크립트/의존성 맵 — `structure.md` §1 참고
- [x] 프레임워크/빌드/런타임 설정 맵 — `structure.md` §1 참고
- [x] 소스 트리 최상위 구조 맵 — `structure.md` §2 참고
- [x] 라우트/App Router 구조 맵 — `structure.md` §2, §4 참고

## 1. 아키텍처와 데이터 흐름

- [x] App Router / page layout 경계 — `structure.md` §4 참고
- [x] API client 계층(`src/lib/api`) 목록화 — `route-api-matrix.md` §2 참고
- [x] React Query hook 목록화 — `route-api-matrix.md` §3 참고
- [x] 인증/session/profile/workspace 흐름 — `structure.md` §4 참고
- [x] 상태 store와 client cache 구조 — `structure.md` §5 참고
- [x] 타입 모델 경계와 generated type 사용 현황 — `structure.md` §7, `findings.md` F6 참고

## 2. 보안 및 취약점 점검

- [x] 환경 변수 노출과 client/server 경계 — `findings.md` F2/F4 참고
- [x] 인증 guard / route 보호 구조 검토 — `route-api-matrix.md` §1 참고
- [x] Supabase client 사용과 RLS 전제 — service-role/API matrix + client report/monitoring/crisis 추적 완료; DB policy 상세 검토는 남음. `route-api-matrix.md` §1, `structure.md` §11 참고
- [ ] 위험한 DOM/rendering/file/url 처리 점검
- [x] workspace/user 간 데이터 누출 가능성 — client report/PDF route-param 및 backend handoff 추적 완료. `structure.md` §11-12, `findings.md` F10/F11 참고
- [x] 의존성/설정 리스크 메모 — `structure.md` §10, `findings.md` F9 참고

## 3. 안정성 및 성능/최적화

- [ ] loading/error/empty state 일관성 점검
- [x] query invalidation/cache freshness 패턴 — `structure.md` §8 참고
- [ ] 대용량 list/table/virtualization 패턴 점검
- [x] build/lint warning 목록화 — `structure.md` §10, `findings.md` F8 참고
- [ ] dead/commented code 목록화

## 4. UX/제품 일관성

- [ ] navigation/sidebar/report 흐름 점검
- [ ] monitoring/insights/crisis 흐름 점검
- [x] admin/client role surface 분리 — `structure.md` §12, `findings.md` F3/F12 참고
- [ ] mobile/responsive 취약 지점 점검

## 5. 테스트 및 검증 표면

- [x] 기존 test inventory — `structure.md` §9, `findings.md` F7 참고
- [x] 우선순위 높은 누락 regression test 후보 — `structure.md` §9, `findings.md` backlog 참고
- [x] smoke/e2e 후보 — `structure.md` §9, `findings.md` backlog 참고

## 6. Findings backlog

- [x] severity/confidence 기준 findings 정렬 — `findings.md` 참고
- [x] impact/effort 기준 개선 기회 정렬 — `findings.md` backlog 참고
- [x] 다음 read-only probe 정의 — `structure.md` §6, `findings.md` 참고
