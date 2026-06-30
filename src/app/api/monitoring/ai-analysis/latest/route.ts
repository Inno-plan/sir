import { NextRequest, NextResponse } from 'next/server';
import { proxyBackendJson, requireAuthorization } from '../_proxy';

/** 가장 최근 분석 결과 1건 — 백엔드(`/api/monitoring/ai-analysis/latest`) proxy.
 *  AiAnalysisCard mount 시 default 표시용. 없으면 backend 가 null 반환.
 */
export async function GET(req: NextRequest) {
  const auth = requireAuthorization(req);
  if (typeof auth !== 'string') return auth;

  const workspaceId = new URL(req.url).searchParams.get('workspace_id');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id 필요' }, { status: 400 });
  }

  return proxyBackendJson({
    path: `/api/monitoring/ai-analysis/latest?workspace_id=${encodeURIComponent(workspaceId)}`,
    authorization: auth,
    cache: 'no-store',
  });
}
