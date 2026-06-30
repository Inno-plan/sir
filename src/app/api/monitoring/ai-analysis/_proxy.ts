import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_PROXY_TIMEOUT_MS = 30_000;
const JSON_CONTENT_TYPE = 'application/json';

interface ProxyBackendJsonOptions {
  path: string;
  authorization: string;
  method?: 'GET' | 'POST';
  body?: string;
  cache?: RequestCache;
  timeoutMs?: number;
}

export function requireAuthorization(req: NextRequest): string | NextResponse {
  const auth = req.headers.get('authorization');
  if (!auth) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }
  return auth;
}

function getBackendUrl(): string | NextResponse {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!backendUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_API_URL 미설정' }, { status: 500 });
  }
  return backendUrl;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError';
}

export async function proxyBackendJson({
  path,
  authorization,
  method = 'GET',
  body,
  cache,
  timeoutMs = DEFAULT_PROXY_TIMEOUT_MS,
}: ProxyBackendJsonOptions): Promise<NextResponse> {
  const backendUrl = getBackendUrl();
  if (typeof backendUrl !== 'string') return backendUrl;

  const headers: Record<string, string> = { Authorization: authorization };
  if (body !== undefined) headers['Content-Type'] = JSON_CONTENT_TYPE;

  try {
    const res = await fetch(`${backendUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body } : {}),
      ...(cache !== undefined ? { cache } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? JSON_CONTENT_TYPE },
    });
  } catch (error) {
    const timeout = isTimeoutError(error);
    const status = timeout ? 504 : 502;
    const message = timeout ? '백엔드 호출 시간 초과' : '백엔드 호출 실패';
    const logMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ai-analysis proxy] ${method} ${path} ${status}:`, logMessage.slice(0, 300));
    return NextResponse.json({ error: message }, { status });
  }
}
