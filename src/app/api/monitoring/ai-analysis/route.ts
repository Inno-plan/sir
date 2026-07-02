import { NextRequest } from 'next/server';
import { proxyBackendJson, requireAuthorization } from './_proxy';

/** 모니터링 AI 분석 — 백엔드(`/api/monitoring/ai-analysis`) proxy.
 *
 * 클라이언트 → Next.js (same-origin) → sir-backend.
 * Authorization 헤더는 그대로 forward. 응답은 markdown content + usage 메타.
 */
export async function POST(req: NextRequest) {
  const auth = requireAuthorization(req);
  if (typeof auth !== 'string') return auth;

  return proxyBackendJson({
    path: '/api/monitoring/ai-analysis',
    method: 'POST',
    authorization: auth,
    body: await req.text(),
  });
}
