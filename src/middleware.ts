import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // 루트 `/` 매치 명시 — 일부 Next.js 환경에서 `.*` 패턴이 빈 경로를 놓치는 경우가 있어 별도로 지정
    '/',
    /*
     * 정적 파일과 API health 엔드포인트, /report-pdf (Playwright 가 injected session 으로 자체 인증) 를 제외한 모든 경로
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|api/health|report-pdf|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
