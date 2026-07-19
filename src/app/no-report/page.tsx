import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { resolveUserReportPath } from '@/lib/auth/resolveLandingPath';
import { logout } from '@/app/auth/actions';
import { ConsentGate } from '@/components/client/consent/ConsentGate';
import { needsConsent } from '@/lib/legal/consts';

export default async function NoReportPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  if (user.role === 'user' && needsConsent(user)) {
    return <ConsentGate />;
  }

  // 혹시 접근 사이에 배정/발행이 생겼으면 곧바로 해당 보고서로 이동
  if (user.role === 'user') {
    const supabase = await createClient();
    const target = await resolveUserReportPath(supabase, user.id);
    if (target) redirect(target);
  } else {
    // 관리자는 이 페이지에 올 일이 없음 → 관리자 홈으로
    redirect('/');
  }

  const greetingName = user.companyName || user.email.split('@')[0];

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 flex flex-col items-center text-center gap-4">
        <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-600 rounded-xl">
          <span className="text-white text-sm font-bold">S</span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-slate-800">
            {greetingName}님, 발행된 보고서가 아직 없습니다
          </h1>
          <p className="text-sm text-slate-500">
            워크스페이스 배정 또는 보고서 발행 후 다시 접속해주세요.
          </p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="mt-2 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            로그아웃
          </button>
        </form>
        <Link href="/auth/login" className="text-xs text-slate-400 hover:text-slate-600">
          다른 계정으로 로그인
        </Link>
      </div>
    </div>
  );
}
