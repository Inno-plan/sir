import { NextRequest } from 'next/server';
import { proxyBackendJson, requireAuthorization } from '../_proxy';

/** 모니터링 AI 분석 예상 토큰 — 백엔드(`/api/monitoring/ai-analysis/estimate`) proxy.
 *  모달에서 기간 선택 즉시 호출 → input 실측 + output 추정 + 잔여량 반환.
 */
export async function POST(req: NextRequest) {
  const auth = requireAuthorization(req);
  if (typeof auth !== 'string') return auth;

  return proxyBackendJson({
    path: '/api/monitoring/ai-analysis/estimate',
    method: 'POST',
    authorization: auth,
    body: await req.text(),
  });
}
