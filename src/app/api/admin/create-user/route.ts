import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { getErrorMessage } from '@/lib/utils';
import { checkPassword, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/passwordPolicy';

export const dynamic = 'force-dynamic';

type CreateUserRole = 'super_admin' | 'admin' | 'user';

const VALID_ROLES = new Set<CreateUserRole>(['super_admin', 'admin', 'user']);
const VALID_TIERS = new Set([
  'white',
  'red',
  'blue',
  'black',
  'white_plus',
  'red_plus',
  'blue_plus',
  'black_plus',
]);
const VALID_CONTRACT_TYPES = new Set(['trial', 'paid']);
const TRIAL_DURATION_MS = 10 * 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  // 호출자 권한 검증 — 계정 생성은 super_admin 만 허용
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
    return NextResponse.json({ detail: '최고 관리자 권한 필요' }, { status: 403 });
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

  const {
    password,
  } = body;
  const email = requiredString(body.email);
  const company_name = requiredString(body.company_name);
  const roleValue = typeof body.role === 'string' ? body.role : 'user';
  if (!VALID_ROLES.has(roleValue as CreateUserRole)) {
    return NextResponse.json({ detail: 'role 값이 올바르지 않습니다' }, { status: 400 });
  }
  const role = roleValue as CreateUserRole;
  const ticker = requiredString(body.ticker);
  const tier = typeof body.tier === 'string' ? body.tier : '';
  const contract_type = typeof body.contract_type === 'string' ? body.contract_type : 'paid';
  const subscription_start =
    typeof body.subscription_start === 'string' ? body.subscription_start : '';
  const subscription_end =
    typeof body.subscription_end === 'string' ? body.subscription_end : '';
  const industry = optionalString(body.industry);
  const business_summary = optionalString(body.business_summary);

  if (!email || !password || !company_name) {
    return NextResponse.json(
      { detail: '이메일, 비밀번호, 회사명은 필수입니다' },
      { status: 400 },
    );
  }
  if (typeof password !== 'string' || !checkPassword(password).ok) {
    return NextResponse.json({ detail: PASSWORD_POLICY_MESSAGE }, { status: 400 });
  }
  if (
    role === 'user' &&
    (!ticker || !tier || !subscription_start || !subscription_end)
  ) {
    return NextResponse.json(
      { detail: '일반 유저 생성 시 종목코드·티어·계약 기간은 필수입니다' },
      { status: 400 },
    );
  }
  if (role === 'user' && !VALID_TIERS.has(tier)) {
    return NextResponse.json({ detail: 'tier 값이 올바르지 않습니다' }, { status: 400 });
  }
  if (role === 'user' && !VALID_CONTRACT_TYPES.has(contract_type)) {
    return NextResponse.json({ detail: 'contract_type 값이 올바르지 않습니다' }, { status: 400 });
  }
  if (role === 'user') {
    const startedAt = Date.parse(subscription_start);
    const endedAt = Date.parse(subscription_end);
    if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || startedAt >= endedAt) {
      return NextResponse.json(
        { detail: '계약 시작일은 종료일보다 이전이어야 합니다' },
        { status: 400 },
      );
    }
    if (contract_type === 'trial' && endedAt !== startedAt + TRIAL_DURATION_MS) {
      return NextResponse.json(
        { detail: '무료 체험 기간은 시작일부터 10일이어야 합니다' },
        { status: 400 },
      );
    }
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 1. auth.users 생성 (트리거로 user_profiles 자동 생성, 기본 role='user')
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { company_name },
  });

  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 400 });
  }

  const userId = data.user.id;

  try {
    if (role !== 'user') {
      const { error: profErr } = await supabaseAdmin
        .from('user_profiles')
        .update({ role, company_name })
        .eq('id', userId);
      if (profErr) throw profErr;
    } else {
      const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc(
        'create_user_workspace_bundle',
        {
          p_user_id: userId,
          p_company_name: company_name,
          p_ticker: ticker,
          p_industry: industry ?? null,
          p_business_summary: business_summary ?? null,
          p_tier: tier,
          p_started_at: subscription_start,
          p_ended_at: subscription_end,
          p_contract_type: contract_type,
        },
      );
      if (rpcErr) throw rpcErr;

      const bundle = rpcData as {
        workspace_id: string;
        report_id: string;
        period_start: string;
        period_end: string;
      };
      return NextResponse.json({
        id: userId,
        email,
        workspace_id: bundle.workspace_id,
        report_id: bundle.report_id,
        period_start: bundle.period_start,
        period_end: bundle.period_end,
      });
    }

    return NextResponse.json({ id: userId, email });
  } catch (e) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { detail: getErrorMessage(e, '계정 생성 실패') },
      { status: 500 },
    );
  }
}
