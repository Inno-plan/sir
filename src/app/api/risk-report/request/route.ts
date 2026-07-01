import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export const dynamic = 'force-dynamic';

type RiskSourceTable = 'news_items' | 'community_items' | 'sns_items';
type CriticalType = Database['public']['Enums']['critical_type'];
type RiskReportInsert = Database['public']['Tables']['risk_reports']['Insert'];
type RiskReportUpdate = Database['public']['Tables']['risk_reports']['Update'];

type SourceRow = {
  id: string;
  workspace_id: string;
  session_id: string | null;
  platform_id: string;
  title: string;
  link: string;
  critical_type: CriticalType | null;
  critical_reason: string | null;
  is_relevant: boolean | null;
};

const TABLE_BY_PLATFORM: Record<string, RiskSourceTable> = {
  naver_news: 'news_items',
  naver_blog: 'sns_items',
  youtube: 'sns_items',
  naver_stock: 'community_items',
  dcinside: 'community_items',
};

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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

async function fetchSourceItem(
  admin: ReturnType<typeof createAdmin>,
  table: RiskSourceTable,
  sourceId: string,
): Promise<{ data: SourceRow | null; error: Error | null }> {
  const select = 'id, workspace_id, session_id, platform_id, title, link, critical_type, critical_reason, is_relevant';
  const result = await admin.from(table).select(select).eq('id', sourceId).maybeSingle();
  return {
    data: result.data as SourceRow | null,
    error: result.error,
  };
}

export async function POST(request: NextRequest) {
  const caller = await getCaller();
  if (!caller) {
    return NextResponse.json({ detail: '인증 필요' }, { status: 401 });
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

  const input = body as {
    workspace_id?: unknown;
    report_id?: unknown;
    source_id?: unknown;
    platform_id?: unknown;
    reason?: unknown;
    evidence?: unknown;
    file_urls?: unknown;
  };

  if (
    typeof input.workspace_id !== 'string' ||
    typeof input.report_id !== 'string' ||
    typeof input.source_id !== 'string' ||
    typeof input.platform_id !== 'string' ||
    typeof input.reason !== 'string' ||
    typeof input.evidence !== 'string' ||
    !isStringArray(input.file_urls)
  ) {
    return NextResponse.json({ detail: '필수 요청값이 올바르지 않습니다' }, { status: 400 });
  }

  const workspaceId = input.workspace_id;
  const reportId = input.report_id;
  const sourceId = input.source_id;
  const platformId = input.platform_id;
  const fileUrls = input.file_urls;
  const sourceTable = TABLE_BY_PLATFORM[platformId];
  if (!sourceTable) {
    return NextResponse.json({ detail: `알 수 없는 platform: ${platformId}` }, { status: 400 });
  }
  if (!fileUrls.every((url) => url.startsWith(`${workspaceId}/`))) {
    return NextResponse.json({ detail: '첨부 파일 경로가 올바르지 않습니다' }, { status: 400 });
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

  const { data: membership, error: memberError } = await admin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('profile_id', caller.id)
    .limit(1)
    .maybeSingle();
  if (memberError) {
    return NextResponse.json({ detail: memberError.message }, { status: 500 });
  }
  if (profile?.role !== 'super_admin' && !membership) {
    return NextResponse.json({ detail: '해당 워크스페이스에 접근 권한이 없습니다' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const { data: subscription, error: subscriptionError } = await admin
    .from('subscriptions')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('has_armor', true)
    .lte('started_at', now)
    .gt('ended_at', now)
    .limit(1)
    .maybeSingle();
  if (subscriptionError) {
    return NextResponse.json({ detail: subscriptionError.message }, { status: 500 });
  }
  if (!subscription) {
    return NextResponse.json({ detail: '아머 서비스가 활성화된 워크스페이스만 신고 대행 요청이 가능합니다' }, { status: 403 });
  }

  const { data: report, error: reportError } = await admin
    .from('reports')
    .select('id, workspace_id, type')
    .eq('id', reportId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (reportError) {
    return NextResponse.json({ detail: reportError.message }, { status: 500 });
  }
  if (!report) {
    return NextResponse.json({ detail: '보고서를 찾을 수 없습니다' }, { status: 404 });
  }
  if (report.type === 'initial') {
    return NextResponse.json({ detail: '초기 보고서 리스크는 신고 대행 요청할 수 없습니다' }, { status: 400 });
  }

  const { data: sourceItem, error: sourceError } = await fetchSourceItem(admin, sourceTable, sourceId);
  if (sourceError) {
    return NextResponse.json({ detail: sourceError.message }, { status: 500 });
  }
  if (!sourceItem) {
    return NextResponse.json({ detail: '리스크 콘텐츠를 찾을 수 없습니다' }, { status: 404 });
  }
  if (sourceItem.workspace_id !== workspaceId || sourceItem.platform_id !== platformId) {
    return NextResponse.json({ detail: '리스크 콘텐츠가 요청 워크스페이스와 일치하지 않습니다' }, { status: 400 });
  }
  if (!sourceItem.session_id) {
    return NextResponse.json({ detail: '리스크 콘텐츠의 세션 정보가 없습니다' }, { status: 400 });
  }
  if (sourceItem.is_relevant !== true || !sourceItem.critical_type) {
    return NextResponse.json({ detail: '신고 가능한 리스크 콘텐츠가 아닙니다' }, { status: 400 });
  }

  const { data: session, error: sessionError } = await admin
    .from('sessions')
    .select('id, workspace_id, report_id')
    .eq('id', sourceItem.session_id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (sessionError) {
    return NextResponse.json({ detail: sessionError.message }, { status: 500 });
  }
  if (!session || session.report_id !== reportId) {
    return NextResponse.json({ detail: '리스크 콘텐츠가 요청 보고서에 속하지 않습니다' }, { status: 400 });
  }

  const { data: existing, error: existingError } = await admin
    .from('risk_reports')
    .select('id, status')
    .eq('source_table', sourceTable)
    .eq('source_id', sourceId)
    .maybeSingle();
  if (existingError) {
    return NextResponse.json({ detail: existingError.message }, { status: 500 });
  }

  const common = {
    workspace_id: workspaceId,
    report_id: reportId,
    platform_id: platformId,
    title: sourceItem.title || '(제목 없음)',
    link: sourceItem.link || '#',
    critical_type: sourceItem.critical_type,
    reason: input.reason,
    evidence: input.evidence,
    file_urls: fileUrls,
    status: 'requested',
    requested_at: now,
    resolved_at: null,
  } satisfies RiskReportUpdate;

  if (existing) {
    if (existing.status !== 'detected') {
      return NextResponse.json(
        { detail: '이미 신고 대행 요청이 등록되어 있습니다', id: existing.id, status: existing.status },
        { status: 409 },
      );
    }

    const { error: updateError } = await admin
      .from('risk_reports')
      .update(common)
      .eq('id', existing.id)
      .eq('status', 'detected');
    if (updateError) {
      return NextResponse.json({ detail: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ id: existing.id, status: 'requested', upgraded: true });
  }

  const insertPayload = {
    ...common,
    source_table: sourceTable,
    source_id: sourceId,
  } satisfies RiskReportInsert;

  const { data: inserted, error: insertError } = await admin
    .from('risk_reports')
    .insert(insertPayload)
    .select('id')
    .single();
  if (insertError) {
    return NextResponse.json({ detail: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.id, status: 'requested', upgraded: false });
}
