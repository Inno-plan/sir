import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export const dynamic = 'force-dynamic';

const RISK_STATUS_VALUES = new Set(['detected', 'requested', 'pending', 'resolved', 'rejected']);

type RiskReportUpdate = Database['public']['Tables']['risk_reports']['Update'];

function createAdmin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function getCaller() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await getCaller();
  if (!caller) {
    return NextResponse.json({ detail: '인증 필요' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ detail: 'risk report id 필수' }, { status: 400 });
  }

  const admin = createAdmin();

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('role')
    .eq('id', caller.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json({ detail: profileError.message }, { status: 500 });
  }
  if (profile?.role !== 'super_admin' && profile?.role !== 'admin') {
    return NextResponse.json({ detail: '관리자 권한 필요' }, { status: 403 });
  }

  const { data: riskReport, error: riskError } = await admin
    .from('risk_reports')
    .select('id, workspace_id, file_urls')
    .eq('id', id)
    .maybeSingle();
  if (riskError) {
    return NextResponse.json({ detail: riskError.message }, { status: 500 });
  }
  if (!riskReport) {
    return NextResponse.json({ detail: '리스크 항목을 찾을 수 없습니다' }, { status: 404 });
  }

  if (profile.role === 'admin') {
    const { data: membership, error: memberError } = await admin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', riskReport.workspace_id)
      .eq('profile_id', caller.id)
      .limit(1)
      .maybeSingle();
    if (memberError) {
      return NextResponse.json({ detail: memberError.message }, { status: 500 });
    }
    if (!membership) {
      return NextResponse.json({ detail: '해당 워크스페이스에 접근 권한이 없습니다' }, { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: 'JSON body가 필요합니다' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ detail: '잘못된 요청 body입니다' }, { status: 400 });
  }

  const input = body as { status?: unknown; admin_note?: unknown };
  const update: RiskReportUpdate = {};

  if ('status' in input) {
    if (typeof input.status !== 'string') {
      return NextResponse.json({ detail: 'status는 문자열이어야 합니다' }, { status: 400 });
    }
    const status = input.status.trim().toLowerCase();
    if (!RISK_STATUS_VALUES.has(status)) {
      return NextResponse.json({ detail: '허용되지 않은 status입니다' }, { status: 400 });
    }
    update.status = status;
    update.resolved_at = status === 'resolved' || status === 'rejected'
      ? new Date().toISOString()
      : null;

    if ((status === 'resolved' || status === 'rejected') && riskReport.file_urls.length > 0) {
      const { error: storageError } = await admin.storage
        .from('risk-attachments')
        .remove(riskReport.file_urls);
      if (storageError) {
        return NextResponse.json({ detail: storageError.message }, { status: 500 });
      }
      update.file_urls = [];
    }
  }

  if ('admin_note' in input) {
    if (input.admin_note !== null && typeof input.admin_note !== 'string') {
      return NextResponse.json({ detail: 'admin_note는 문자열 또는 null이어야 합니다' }, { status: 400 });
    }
    update.admin_note = input.admin_note ?? null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ detail: '업데이트할 필드가 없습니다' }, { status: 400 });
  }

  const { error: updateError } = await admin
    .from('risk_reports')
    .update(update)
    .eq('id', id);
  if (updateError) {
    return NextResponse.json({ detail: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'updated' });
}
