import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest) {
  // 호출자 권한 검증 — super_admin/admin 만 허용
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ detail: '인증 필요' }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'super_admin' && profile?.role !== 'admin') {
    return NextResponse.json({ detail: '관리자 권한 필요' }, { status: 403 });
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

  const report_id = requiredString(body.report_id);
  if (!report_id) {
    return NextResponse.json({ detail: 'report_id 필수' }, { status: 400 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // status 가드: 'draft' 만 발행 가능 (null=분석 미완료, 'published'=이미 발행)
  const { data: report, error: readErr } = await admin
    .from('reports')
    .select('status')
    .eq('id', report_id)
    .single();
  if (readErr) {
    return NextResponse.json({ detail: readErr.message }, { status: 500 });
  }
  if (report?.status !== 'draft') {
    return NextResponse.json(
      { detail: `발행 불가 (현재 상태: ${report?.status ?? 'null'}). draft 상태만 발행할 수 있습니다.` },
      { status: 409 },
    );
  }

  const { error } = await admin
    .from('reports')
    .update({ status: 'published' })
    .eq('id', report_id);
  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ report_id, status: 'published' });
}
