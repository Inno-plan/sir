import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/types/database.types';
import { resolveUserReportPath } from '@/lib/auth/resolveLandingPath';

export async function updateSession(request: NextRequest) {
  // /report-pdf — Playwright headless 가 init script injected session 으로 자체 setSession 하므로
  // middleware 의 cookie 기반 인증 검사를 통째로 우회. (matcher negative lookahead 가
  // 일부 환경에서 안 먹어 코드 레벨 early return 으로 처리)
  if (request.nextUrl.pathname.startsWith('/report-pdf')) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith('/auth/login') || pathname.startsWith('/auth/signup');
  const isCallback = pathname.startsWith('/auth/callback');

  // 미인증 사용자 → 로그인 페이지로 리다이렉트
  if (!user && !isAuthPage && !isCallback) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // 인증된 사용자 → 역할 기반 라우팅
  if (user) {
    // auth 페이지 접근 → 역할에 따라 리다이렉트
    if (isAuthPage) {
      const role = await getUserRole(supabase, user.id);
      const url = request.nextUrl.clone();
      url.pathname = role === 'user' ? '/' : '/workspace';
      return NextResponse.redirect(url);
    }

    // user 역할은 관리자 페이지 접근 차단 (/workspace, /risk-reports, /users)
    // /users 는 super_admin 전용 — 일반 admin 도 차단
    const isAdminRoute =
      pathname.startsWith('/workspace') ||
      pathname.startsWith('/risk-reports') ||
      pathname.startsWith('/users');
    const isSuperAdminRoute = pathname.startsWith('/users');
    if (isAdminRoute) {
      const role = await getUserRole(supabase, user.id);
      if (role === 'user') {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
      if (isSuperAdminRoute && role !== 'super_admin') {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
    }

    // / (홈) — user 역할은 (app) 레이아웃(관리자 사이드바) 진입 자체를 막고
    // 본인 최신 published report 로 직접 이동. admin/super_admin 은 (app)/page.tsx 가 홈 대시보드 렌더.
    if (pathname === '/') {
      const role = await getUserRole(supabase, user.id);
      if (role === 'user') {
        const target = (await resolveUserReportPath(supabase, user.id)) ?? '/no-report';
        const url = request.nextUrl.clone();
        url.pathname = target;
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

// 역할 조회 (캐시 없이 매번 조회 — middleware는 서버에서 실행)
async function getUserRole(supabase: SupabaseClient<Database>, userId: string): Promise<string> {
  const { data } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();
  return data?.role ?? 'user';
}
