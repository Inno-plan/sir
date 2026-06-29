# sir-frontend Code Audit Notes

이 폴더는 SIR frontend 코드 탐색 결과를 세션 간 이어가기 위한 작업 기록입니다.

- `checklist.md`: 전체 점검 워크 트리와 진행 상태
- `structure.md`: 구조/데이터 흐름 요약
- `findings.md`: 취약점·개선점 후보와 근거

## Ongoing audit branch workflow

- Long-lived branch: `audit/continuous-improvement`.
- Purpose: keep recurring code-audit, verification, and improvement documentation work isolated from feature branches while production/source fixes stay as findings/backlog until explicitly requested.
- Before future audit/improvement work, update `main` and this branch first, then continue on `audit/continuous-improvement`.
- Safe default sync policy: fetch remotes, fast-forward local `main`, fast-forward the audit branch if a remote exists, then merge `origin/main` into the audit branch. Rebase only if explicitly requested and safe for the branch sharing state.
