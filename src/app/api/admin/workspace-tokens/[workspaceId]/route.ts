import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

/** PATCH — 워크스페이스 토큰 수정. super_admin 만.
 *
 *  body: { monthly_quota?: number, add_tokens?: number }
 *  - monthly_quota: 절대값 set (월 자동 충전량 변경)
 *  - add_tokens: 잔여량에 delta 추가 (음수 = 차감). atomic decrement RPC 사용.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
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

  const hasMonthlyQuota = hasOwn(body, 'monthly_quota');
  const hasAddTokens = hasOwn(body, 'add_tokens');
  const monthly_quota = body.monthly_quota;
  const add_tokens = body.add_tokens;

  if (!hasMonthlyQuota && !hasAddTokens) {
    return NextResponse.json(
      { detail: 'monthly_quota 또는 add_tokens 중 하나는 필요합니다' },
      { status: 400 },
    );
  }
  if (
    hasMonthlyQuota &&
    (typeof monthly_quota !== 'number' ||
      !Number.isSafeInteger(monthly_quota) ||
      monthly_quota < 0)
  ) {
    return NextResponse.json(
      { detail: 'monthly_quota 는 0 이상의 정수여야 합니다' },
      { status: 400 },
    );
  }
  if (
    hasAddTokens &&
    (typeof add_tokens !== 'number' || !Number.isSafeInteger(add_tokens))
  ) {
    return NextResponse.json(
      { detail: 'add_tokens 는 정수여야 합니다' },
      { status: 400 },
    );
  }
  const monthlyQuotaValue = hasMonthlyQuota ? (monthly_quota as number) : undefined;
  const addTokensValue = hasAddTokens ? (add_tokens as number) : undefined;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // add_tokens 는 atomic RPC (race 안전). monthly_quota 는 단순 UPDATE.
  if (addTokensValue !== undefined && addTokensValue !== 0) {
    const { error: rpcErr } = await supabaseAdmin.rpc('decrement_workspace_tokens', {
      p_workspace_id: workspaceId,
      p_amount: -addTokensValue,
    });
    if (rpcErr) {
      return NextResponse.json({ detail: rpcErr.message }, { status: 500 });
    }
  }

  if (monthlyQuotaValue !== undefined) {
    const { error: updErr } = await supabaseAdmin
      .from('workspaces')
      .update({ monthly_quota: monthlyQuotaValue })
      .eq('id', workspaceId);
    if (updErr) {
      return NextResponse.json({ detail: updErr.message }, { status: 500 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .select('id, company_name, token_balance, monthly_quota, last_charged_at')
    .eq('id', workspaceId)
    .single();
  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
