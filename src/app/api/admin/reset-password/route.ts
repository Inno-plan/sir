import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { checkPassword, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/passwordPolicy';

export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest) {
  // 호출자 권한 검증 — 비밀번호 재설정은 super_admin 만 허용 (create-user 보다 좁게)
  const supabaseUser = await createServerClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ detail: '인증 필요' }, { status: 401 });
  }
  const { data: profile } = await supabaseUser
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ detail: '최고관리자 권한이 필요합니다' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!isRecord(parsed)) {
      return NextResponse.json({ detail: 'JSON object body 필요' }, { status: 400 });
    }
    body = parsed;
  } catch {
    return NextResponse.json({ detail: '유효한 JSON body 필요' }, { status: 400 });
  }

  const userId = requiredString(body.userId);
  const password = body.password;
  if (!userId || !password) {
    return NextResponse.json(
      { detail: '대상 유저와 비밀번호는 필수입니다' },
      { status: 400 },
    );
  }
  if (typeof password !== 'string' || !checkPassword(password).ok) {
    return NextResponse.json({ detail: PASSWORD_POLICY_MESSAGE }, { status: 400 });
  }

  // service_role 키 — auth 제약을 우회하므로 원래 비밀번호 없이 강제 변경 가능.
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password,
  });
  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
