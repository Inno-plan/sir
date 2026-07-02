import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';

type Tables = Database['public']['Tables'];
type Row<T extends keyof Tables> = Tables[T]['Row'];

// ── 타입 re-export (기존 import 호환) ──
export type {
  SummarySubsection,
  SummarySection,
  SirStockPoint,
  TierItem,
  SirRanking,
  ChannelStat,
  ChannelItem,
  RiskItem,
  StrategyAction,
  StrategyData,
  StrategyGroup,
  PrevReport,
  RiskReport,
  NewsClusterResponse as NewsCluster,
} from '@/types/report';

import { summarySectionSchema, strategyDataSchema } from '@/types/report';
import { calculateSir } from '@/utils/sirChannel';
import type {
  SummarySection,
  SirStockPoint,
  SirRanking,
  ChannelStat,
  ChannelItem,
  RiskItem,
  StrategyData,
  StrategyGroup,
  PrevReport,
  RiskReport,
  NewsClusterResponse,
} from '@/types/report';

const supabase = createClient();

async function readRouteError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json() as { detail?: unknown; error?: unknown };
    if (typeof body.detail === 'string' && body.detail.trim()) return body.detail;
    if (typeof body.error === 'string' && body.error.trim()) return body.error;
  } catch {
    // non-JSON error body — fall through to fallback
  }
  return fallback;
}

// ── PostgREST 페이지네이션 헬퍼 ──
// PostgREST 기본 Range 는 0-999 (1000건 상한). 대용량 워크스페이스 initial 등에서
// 잘리지 않도록 range + while 루프로 전체 조회.

const _PAGE = 1000;

async function fetchAllPaged<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const all: T[] = [];
  let off = 0;
  while (true) {
    const { data } = await build(off, off + _PAGE - 1);
    const chunk = data ?? [];
    all.push(...chunk);
    if (chunk.length < _PAGE) break;
    off += _PAGE;
  }
  return all;
}

// ── fetchAllPaged 호출지에서 select 컬럼에 맞춰 좁힌 row 타입 ──
type NewsItemMinRow = Pick<
  Row<'news_items'>,
  'cluster_id' | 'title' | 'source' | 'link' | 'published_at'
>;
type NewsClusterMinRow = Pick<
  Row<'news_clusters'>,
  'id' | 'representative_title' | 'sentiment' | 'summary'
>;
type NewsItemChannelRow = Pick<
  Row<'news_items'>,
  | 'id'
  | 'platform_id'
  | 'title'
  | 'summary'
  | 'sentiment'
  | 'link'
  | 'source'
  | 'published_at'
  | 'cluster_id'
>;
type CommunityItemChannelRow = Pick<
  Row<'community_items'>,
  'id' | 'platform_id' | 'title' | 'content' | 'sentiment' | 'link' | 'views' | 'published_at'
>;
type SnsItemChannelRow = Pick<
  Row<'sns_items'>,
  | 'id'
  | 'platform_id'
  | 'title'
  | 'content'
  | 'summary'
  | 'sentiment'
  | 'link'
  | 'author'
  | 'views'
  | 'published_at'
  | 'impact_score'
>;
type CommunityItemRiskRow = Pick<
  Row<'community_items'>,
  | 'id'
  | 'platform_id'
  | 'title'
  | 'link'
  | 'critical_type'
  | 'critical_reason'
  | 'published_at'
  | 'session_id'
>;
type SnsItemRiskRow = Pick<
  Row<'sns_items'>,
  | 'id'
  | 'platform_id'
  | 'title'
  | 'link'
  | 'critical_type'
  | 'critical_reason'
  | 'published_at'
  | 'session_id'
>;

// ── Report Meta 캐시 (session IDs + period) ──

interface ReportMeta {
  sessionIds: string[];
  periodStart: string;
  periodEnd: string;
  sirScore: number;
  type: string;
}

const reportMetaCache = new Map<string, ReportMeta>();

async function getReportMeta(reportId: string): Promise<ReportMeta> {
  if (reportMetaCache.has(reportId)) return reportMetaCache.get(reportId)!;

  const [reportRes, sessionsRes] = await Promise.all([
    supabase
      .from('reports')
      .select('workspace_id, type, period_start, period_end, sir_score')
      .eq('id', reportId)
      .maybeSingle(),
    supabase.from('sessions').select('id').eq('report_id', reportId),
  ]);

  let sessionIds: string[] = (sessionsRes.data ?? []).map((s) => s.id);

  // 일간 구독자의 weekly compile: 자체 sessions 가 없는 경우
  // period 안의 daily reports 들의 sessions 합집합으로 fallback.
  // 백엔드 _resolve_sessions_for_report 와 동일한 분기.
  const r = reportRes.data;
  if (
    sessionIds.length === 0 &&
    r?.type === 'weekly' &&
    r?.workspace_id &&
    r?.period_start &&
    r?.period_end
  ) {
    const dailyReports = await supabase
      .from('reports')
      .select('id')
      .eq('workspace_id', r.workspace_id)
      .eq('type', 'daily')
      .gte('period_start', r.period_start)
      .lte('period_end', r.period_end);
    const dailyReportIds = (dailyReports.data ?? []).map((row) => row.id);
    if (dailyReportIds.length > 0) {
      const dailySessions = await supabase
        .from('sessions')
        .select('id')
        .in('report_id', dailyReportIds);
      sessionIds = (dailySessions.data ?? []).map((s) => s.id);
    }
  }

  const meta: ReportMeta = {
    sessionIds,
    periodStart: r?.period_start ?? '',
    periodEnd: r?.period_end ?? '',
    sirScore: r?.sir_score ?? 0,
    type: r?.type ?? '',
  };

  reportMetaCache.set(reportId, meta);
  return meta;
}

// ── 리포트 기본 정보 ──

export async function getReportInfo(workspaceId: string, reportId: string) {
  const { data } = await supabase
    .from('reports')
    .select('id, workspace_id, type, period_start, period_end, created_at, sir_score, status')
    .eq('id', reportId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return data;
}

// ── 리포트 발행 (관리자 전용) ──

export async function publishReport(reportId: string): Promise<void> {
  const res = await fetch('/api/admin/publish-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report_id: reportId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? '발행 실패');
  }
}

/** 보고서 내 failed 플랫폼 일괄 재시도 + 성공 시 자동 regenerate.
 *  백엔드: POST /api/reports/{id}/retry-failed — 순차 retry 후 전 플랫폼 done 되면 finalize. */
export async function retryFailedReport(reportId: string): Promise<void> {
  const {
    data: { session: auth },
  } = await supabase.auth.getSession();
  if (!auth) throw new Error('로그인이 필요합니다.');

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/reports/${reportId}/retry-failed`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.access_token}` },
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? '재시도 요청 실패');
  }
}

/** 전략·총평만 재생성 (sessions 는 손대지 않음).
 *  백엔드: POST /api/reports/{id}/regenerate — session_strategies 삭제 후 SIR 재계산 + 전략·총평 재생성. */
export async function regenerateReport(reportId: string): Promise<void> {
  const {
    data: { session: auth },
  } = await supabase.auth.getSession();
  if (!auth) throw new Error('로그인이 필요합니다.');

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/reports/${reportId}/regenerate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.access_token}` },
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? '재생성 요청 실패');
  }
}

// ── 주간 총평 ──

export async function getWeeklySummary(
  workspaceId: string,
  reportId?: string
): Promise<SummarySection[]> {
  let query = supabase
    .from('session_strategies')
    .select('all_strategy')
    .eq('workspace_id', workspaceId)
    .eq('category', 'summary')
    .order('created_at', { ascending: false })
    .limit(1);

  if (reportId) {
    query = query.eq('report_id', reportId);
  }

  const { data } = await query;
  const raw = data?.[0]?.all_strategy;
  if (!raw) return [];
  return summarySectionSchema.array().parse(raw);
}

export async function upsertWeeklySummary(
  workspaceId: string,
  reportId: string,
  sections: SummarySection[]
): Promise<void> {
  // 기존 row 확인
  const { data: existing } = await supabase
    .from('session_strategies')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('report_id', reportId)
    .eq('category', 'summary')
    .limit(1);

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from('session_strategies')
      .update({ all_strategy: sections })
      .eq('id', existing[0].id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('session_strategies').insert({
      workspace_id: workspaceId,
      report_id: reportId,
      category: 'summary',
      all_strategy: sections,
    });
    if (error) throw error;
  }
}

// ── SIR & 주가 차트 ──

export async function getSirStockData(
  workspaceId: string,
  reportId?: string
): Promise<SirStockPoint[]> {
  let snapshotQuery = supabase
    .from('daily_snapshots')
    .select('date, sir_score, is_carried')
    .eq('workspace_id', workspaceId)
    .order('date');
  let stockQuery = supabase
    .from('stock_prices')
    .select('date, open_price, high_price, low_price, close_price')
    .eq('workspace_id', workspaceId)
    .order('date');

  if (reportId) {
    const meta = await getReportMeta(reportId);
    if (meta.periodEnd) {
      // 최대 1년치 (weekly 52주 대응)
      const end = new Date(meta.periodEnd);
      const start365 = new Date(end);
      start365.setDate(start365.getDate() - 364);
      const startStr = start365.toISOString().slice(0, 10);
      snapshotQuery = snapshotQuery.gte('date', startStr).lte('date', meta.periodEnd);
      stockQuery = stockQuery.gte('date', startStr).lte('date', meta.periodEnd);
    }
  }

  const [snapshotsRes, stockRes] = await Promise.all([snapshotQuery, stockQuery]);

  const sirMap = new Map<string, number>();
  const carriedSet = new Set<string>();
  for (const s of snapshotsRes.data ?? []) {
    if (s.sir_score != null) sirMap.set(s.date, s.sir_score);
    if (s.is_carried) carriedSet.add(s.date);
  }

  const stockMap = new Map<
    string,
    { open_price: number; high_price: number; low_price: number; close_price: number }
  >();
  for (const s of stockRes.data ?? []) {
    stockMap.set(s.date, {
      open_price: s.open_price,
      high_price: s.high_price,
      low_price: s.low_price,
      close_price: s.close_price,
    });
  }

  const allDates = new Set([...sirMap.keys(), ...stockMap.keys()]);
  const sorted = Array.from(allDates).sort();
  const sirValues = sorted.map((date) => sirMap.get(date) ?? null);

  // [임시 검증] 3일 이동평균 비활성화 — raw sir_score 그대로 차트 표시
  return sorted.map((date, i) => ({
    date: date.slice(5),
    fullDate: date,
    sir: sirValues[i],
    isCarried: carriedSet.has(date),
    open_price: stockMap.get(date)?.open_price ?? null,
    high_price: stockMap.get(date)?.high_price ?? null,
    low_price: stockMap.get(date)?.low_price ?? null,
    close_price: stockMap.get(date)?.close_price ?? null,
  }));
}

// ── SIR 순위 ──

export async function getSirRanking(workspaceId: string, reportId?: string): Promise<SirRanking> {
  // RLS 멤버십 격리 후 cross-workspace fetch 가 막히므로 SECURITY DEFINER RPC 로 위임.
  // RPC 안에서만 raw 점수 사용, 클라이언트엔 aggregate (tiers/rank/total/average) 만 노출.
  const { data, error } = await supabase.rpc('get_sir_ranking', {
    p_workspace_id: workspaceId,
    p_report_id: reportId,
  });
  if (error) throw error;
  return data as SirRanking;
}

// ── 채널별 통계 ──

const PLATFORM_TO_CHANNEL: Record<string, string> = {
  naver_news: 'news',
  naver_blog: 'blog',
  youtube: 'youtube',
  naver_stock: 'community',
  dcinside: 'community',
};

const CHANNEL_CONFIG: { id: string; label: string; color: string }[] = [
  { id: 'news', label: '뉴스', color: '#6366f1' },
  { id: 'blog', label: '블로그', color: '#38bdf8' },
  { id: 'youtube', label: '유튜브', color: '#f43f5e' },
  { id: 'community', label: '커뮤니티', color: '#22c55e' },
];

/** channelItems(raw is_relevant=true items) 로 채널별 통계 + SIR 직접 계산.
 *
 * 이전: daily_platform_stats.sir_score 의 보고서 기간 평균.
 *       SIR 공식이 4/30 / 5/4 두 차례 변경됐지만 daily_platform_stats 행은 재계산 안 됨 →
 *       옛 공식 값이 stale 로 잔존 → 카운트와 sir 불일치 (예: 4/28 news pos=10/0/0인데 sir=389).
 *       또 carry(cnt=0) 일자도 단순 평균에 들어가서 결과를 500 쪽으로 끌어내림.
 * 이후: channelItems 의 sentiment 분포를 그대로 calculateSir() 에 넣어 그 자리에서 산출.
 *       SIR 공식의 confidence 보정 + negativity bias 가 주간 합계 기준으로 한 번에 정확히 적용.
 *       stale 의존 0. daily_platform_stats 의 sir_score 컬럼은 더 이상 채널 SIR 산정에 안 쓰임
 *       (다만 채널 일별 시계열 차트 등 다른 곳에서 여전히 참조되니 컬럼 자체는 유지).
 *
 * periodStart / periodEnd 인자는 시그니처 유지 (호출자 호환). 내부 미사용.
 */
export async function getChannelStats(
  _workspaceId: string,
  channelItems: ChannelItem[],
  _reportId?: string,
  _periodStart?: string,
  _periodEnd?: string,
): Promise<ChannelStat[]> {
  // channelItems 가 비어 있어도 4채널 placeholder stat 을 반환해야 SirCard 가 렌더됨
  // (이전: return [] 로 차트/카드 통째로 사라짐 — 5/4 SB성보 같은 전체 0건 케이스에서 빈 화면)
  // SirCard 의 stat.value === 0 분기가 amber 배지 + "직전 일자 기준" 표시로 빈 상태 명시.

  // 채널별 감정 집계 (positive/negative/neutral count) + raw items
  const byChannel = new Map<
    string,
    { positive: number; negative: number; neutral: number; items: ChannelItem[] }
  >();
  for (const item of channelItems) {
    const channel = PLATFORM_TO_CHANNEL[item.platform_id] ?? item.platform_id;
    if (!byChannel.has(channel)) {
      byChannel.set(channel, { positive: 0, negative: 0, neutral: 0, items: [] });
    }
    const bucket = byChannel.get(channel)!;
    bucket.items.push(item);
    if (item.sentiment === 'positive') bucket.positive++;
    else if (item.sentiment === 'negative') bucket.negative++;
    else bucket.neutral++;
  }

  return CHANNEL_CONFIG.map((c) => {
    const bucket = byChannel.get(c.id) ?? { positive: 0, negative: 0, neutral: 0, items: [] };
    const sir =
      bucket.items.length > 0
        ? calculateSir(
            bucket.items.map((it) => ({
              platform_id: it.platform_id,
              sentiment: it.sentiment ?? null,
            })),
          )
        : 500;
    return {
      id: c.id,
      label: c.label,
      value: bucket.positive + bucket.negative + bucket.neutral,
      color: c.color,
      sir,
      positive: bucket.positive,
      negative: bucket.negative,
      neutral: bucket.neutral,
    };
  });
}

// ── 뉴스 클러스터 ──

export async function getNewsClusters(
  workspaceId: string,
  reportId?: string
): Promise<NewsClusterResponse[]> {
  if (reportId) {
    const meta = await getReportMeta(reportId);
    if (meta.sessionIds.length === 0) return [];

    // articles 를 먼저 fetch — 그 articles 의 cluster_id 합집합으로 cluster 조회.
    // cross-session matching 도입 후엔 cluster row 의 session_id 가 처음 만든 session 만 가리키므로
    // session_id IN 으로 cluster 를 찾으면 다른 session 에서 매칭 추가된 cluster 가 누락된다.
    const items = await fetchAllPaged<NewsItemMinRow>((from, to) =>
      supabase
        .from('news_items')
        .select('cluster_id, title, source, link, published_at')
        .eq('workspace_id', workspaceId)
        .not('cluster_id', 'is', null)
        .in('session_id', meta.sessionIds)
        .range(from, to)
    );

    const clusterIds = Array.from(
      new Set(items.map((i) => i.cluster_id).filter((v): v is string => !!v))
    );
    if (clusterIds.length === 0) return [];

    const clusters = await fetchAllPaged<NewsClusterMinRow>((from, to) =>
      supabase
        .from('news_clusters')
        .select('id, representative_title, sentiment, summary')
        .eq('workspace_id', workspaceId)
        .eq('is_relevant', true)
        .in('id', clusterIds)
        .order('created_at', { ascending: false })
        .range(from, to)
    );

    return buildClusters(clusters, items);
  }

  const [clusters, items] = await Promise.all([
    fetchAllPaged<NewsClusterMinRow>((from, to) =>
      supabase
        .from('news_clusters')
        .select('id, representative_title, sentiment, summary')
        .eq('workspace_id', workspaceId)
        .eq('is_relevant', true)
        .order('created_at', { ascending: false })
        .range(from, to)
    ),
    fetchAllPaged<NewsItemMinRow>((from, to) =>
      supabase
        .from('news_items')
        .select('cluster_id, title, source, link, published_at')
        .eq('workspace_id', workspaceId)
        .not('cluster_id', 'is', null)
        .range(from, to)
    ),
  ]);

  return buildClusters(clusters, items);
}

function buildClusters(
  clusters: NewsClusterMinRow[],
  items: NewsItemMinRow[]
): NewsClusterResponse[] {
  const itemsByCluster = new Map<
    string,
    { title: string; source: string; link: string; published_at: string | null }[]
  >();
  for (const item of items) {
    if (!item.cluster_id) continue;
    if (!itemsByCluster.has(item.cluster_id)) itemsByCluster.set(item.cluster_id, []);
    itemsByCluster.get(item.cluster_id)!.push({
      title: item.title,
      source: item.source ?? '',
      link: item.link ?? '#',
      published_at: item.published_at ?? null,
    });
  }

  return clusters.map((c) => ({
    id: c.id,
    representative_title: c.representative_title,
    sentiment: c.sentiment,
    summary: c.summary,
    items: itemsByCluster.get(c.id) ?? [],
  }));
}

// ── 채널별 아이템 (감정 상세 + 상위 콘텐츠 공유) ──

export async function getChannelItems(
  workspaceId: string,
  reportId?: string
): Promise<ChannelItem[]> {
  const toNewsItem = (r: NewsItemChannelRow): ChannelItem => ({
    id: r.id,
    platform_id: r.platform_id,
    title: r.title ?? '',
    content: null,
    summary: r.summary ?? null,
    sentiment: r.sentiment ?? 'neutral',
    link: r.link ?? '#',
    source: r.source ?? null,
    views: null,
    published_at: r.published_at ?? null,
    cluster_id: r.cluster_id ?? null,
    impact_score: null,
  });
  const toCommunityItem = (r: CommunityItemChannelRow): ChannelItem => ({
    id: r.id,
    platform_id: r.platform_id,
    title: r.title ?? '',
    content: r.content ?? null,
    summary: null,
    sentiment: r.sentiment ?? 'neutral',
    link: r.link ?? '#',
    source: null,
    views: r.views ?? null,
    published_at: r.published_at ?? null,
    cluster_id: null,
    impact_score: null,
  });
  const toSnsItem = (r: SnsItemChannelRow): ChannelItem => ({
    id: r.id,
    platform_id: r.platform_id,
    title: r.title ?? '',
    content: r.content ?? null,
    summary: r.summary ?? null,
    sentiment: r.sentiment ?? 'neutral',
    link: r.link ?? '#',
    source: r.author ?? null,
    views: r.views ?? null,
    published_at: r.published_at ?? null,
    cluster_id: null,
    impact_score: r.impact_score ?? null,
  });

  if (reportId) {
    const meta = await getReportMeta(reportId);
    if (meta.sessionIds.length === 0) return [];
    const [news, community, sns] = await Promise.all([
      fetchAllPaged<NewsItemChannelRow>((from, to) =>
        supabase
          .from('news_items')
          .select(
            'id, platform_id, title, summary, sentiment, link, source, published_at, cluster_id'
          )
          .eq('workspace_id', workspaceId)
          .eq('is_relevant', true)
          .in('session_id', meta.sessionIds)
          .range(from, to)
      ),
      fetchAllPaged<CommunityItemChannelRow>((from, to) =>
        supabase
          .from('community_items')
          .select('id, platform_id, title, content, sentiment, link, views, published_at')
          .eq('workspace_id', workspaceId)
          .eq('is_relevant', true)
          .in('session_id', meta.sessionIds)
          .range(from, to)
      ),
      fetchAllPaged<SnsItemChannelRow>((from, to) =>
        supabase
          .from('sns_items')
          .select(
            'id, platform_id, title, content, summary, sentiment, link, author, views, published_at, impact_score'
          )
          .eq('workspace_id', workspaceId)
          .eq('is_relevant', true)
          .in('session_id', meta.sessionIds)
          .range(from, to)
      ),
    ]);
    return [...news.map(toNewsItem), ...community.map(toCommunityItem), ...sns.map(toSnsItem)];
  }

  const [news, community, sns] = await Promise.all([
    fetchAllPaged<NewsItemChannelRow>((from, to) =>
      supabase
        .from('news_items')
        .select(
          'id, platform_id, title, summary, sentiment, link, source, published_at, critical_type, cluster_id'
        )
        .eq('workspace_id', workspaceId)
        .eq('is_relevant', true)
        .range(from, to)
    ),
    fetchAllPaged<CommunityItemChannelRow>((from, to) =>
      supabase
        .from('community_items')
        .select(
          'id, platform_id, title, content, sentiment, link, views, published_at, critical_type'
        )
        .eq('workspace_id', workspaceId)
        .eq('is_relevant', true)
        .range(from, to)
    ),
    fetchAllPaged<SnsItemChannelRow>((from, to) =>
      supabase
        .from('sns_items')
        .select(
          'id, platform_id, title, content, summary, sentiment, link, author, views, published_at, critical_type, impact_score'
        )
        .eq('workspace_id', workspaceId)
        .eq('is_relevant', true)
        .range(from, to)
    ),
  ]);
  return [...news.map(toNewsItem), ...community.map(toCommunityItem), ...sns.map(toSnsItem)];
}

// ── 리스크 콘텐츠 ──

export async function getRiskItems(workspaceId: string, reportId?: string): Promise<RiskItem[]> {
  // critical_type IS NOT NULL 필터를 PostgREST 에 걸어 들어오므로 row 타입을 NonNullable 로 좁힘
  type RiskRow = (CommunityItemRiskRow | SnsItemRiskRow) & {
    critical_type: NonNullable<CommunityItemRiskRow['critical_type']>;
  };
  const toRiskItem = (r: RiskRow): RiskItem => ({
    id: r.id,
    platform_id: r.platform_id,
    title: r.title ?? '',
    link: r.link ?? '#',
    critical_type: r.critical_type,
    critical_reason: r.critical_reason ?? null,
    published_at: r.published_at ?? null,
    session_id: r.session_id ?? null,
  });

  if (reportId) {
    const meta = await getReportMeta(reportId);
    if (meta.sessionIds.length === 0) return [];
    const [community, sns] = await Promise.all([
      fetchAllPaged<CommunityItemRiskRow>((from, to) =>
        supabase
          .from('community_items')
          .select(
            'id, platform_id, title, link, critical_type, critical_reason, published_at, session_id'
          )
          .eq('workspace_id', workspaceId)
          .eq('is_relevant', true)
          .not('critical_type', 'is', null)
          .in('session_id', meta.sessionIds)
          .range(from, to)
      ),
      fetchAllPaged<SnsItemRiskRow>((from, to) =>
        supabase
          .from('sns_items')
          .select(
            'id, platform_id, title, link, critical_type, critical_reason, published_at, session_id'
          )
          .eq('workspace_id', workspaceId)
          .eq('is_relevant', true)
          .not('critical_type', 'is', null)
          .in('session_id', meta.sessionIds)
          .range(from, to)
      ),
    ]);
    return [...community, ...sns]
      .filter((r): r is RiskRow => r.critical_type != null)
      .map(toRiskItem)
      .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''));
  }

  const [community, sns] = await Promise.all([
    fetchAllPaged<CommunityItemRiskRow>((from, to) =>
      supabase
        .from('community_items')
        .select(
          'id, platform_id, title, link, critical_type, critical_reason, published_at, session_id'
        )
        .eq('workspace_id', workspaceId)
        .eq('is_relevant', true)
        .not('critical_type', 'is', null)
        .range(from, to)
    ),
    fetchAllPaged<SnsItemRiskRow>((from, to) =>
      supabase
        .from('sns_items')
        .select(
          'id, platform_id, title, link, critical_type, critical_reason, published_at, session_id'
        )
        .eq('workspace_id', workspaceId)
        .eq('is_relevant', true)
        .not('critical_type', 'is', null)
        .range(from, to)
    ),
  ]);
  return [...community, ...sns]
    .filter((r): r is RiskRow => r.critical_type != null)
    .map(toRiskItem)
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''));
}

export interface RiskItemSummary {
  count: number;
  latestRiskAt: string | null;
}

export async function getRiskItemSummary(workspaceId: string): Promise<RiskItemSummary> {
  const buildCountQuery = (table: 'community_items' | 'sns_items') =>
    supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('is_relevant', true)
      .not('critical_type', 'is', null);

  const buildLatestQuery = (table: 'community_items' | 'sns_items') =>
    supabase
      .from(table)
      .select('created_at')
      .eq('workspace_id', workspaceId)
      .eq('is_relevant', true)
      .not('critical_type', 'is', null)
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

  const [community, sns, latestCommunity, latestSns] = await Promise.all([
    buildCountQuery('community_items'),
    buildCountQuery('sns_items'),
    buildLatestQuery('community_items'),
    buildLatestQuery('sns_items'),
  ]);

  if (community.error) throw community.error;
  if (sns.error) throw sns.error;
  if (latestCommunity.error) throw latestCommunity.error;
  if (latestSns.error) throw latestSns.error;

  const latestRiskAt = [latestCommunity.data?.created_at, latestSns.data?.created_at]
    .filter((v): v is string => !!v)
    .sort((a, b) => b.localeCompare(a))[0] ?? null;

  return {
    count: (community.count ?? 0) + (sns.count ?? 0),
    latestRiskAt,
  };
}

export interface RiskNoticeRead {
  latestSeenRiskAt: string | null;
}

async function getAuthenticatedUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function getRiskNoticeRead(workspaceId: string): Promise<RiskNoticeRead> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { latestSeenRiskAt: null };

  const { data, error } = await supabase
    .from('risk_notice_reads')
    .select('latest_seen_risk_at')
    .eq('profile_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(`리스크 알림 확인 상태 조회 실패: ${error.message}`);
  }

  return { latestSeenRiskAt: data?.latest_seen_risk_at ?? null };
}

export async function markRiskNoticeRead(
  workspaceId: string,
  latestRiskAt: string
): Promise<void> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();
  if (profile?.role !== 'user') return;

  const { error } = await supabase
    .from('risk_notice_reads')
    .upsert(
      {
        profile_id: userId,
        workspace_id: workspaceId,
        latest_seen_risk_at: latestRiskAt,
        seen_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,workspace_id' }
    );

  if (error) {
    throw new Error(`리스크 알림 확인 상태 저장 실패: ${error.message}`);
  }
}

// ── 대응 전략 ──

const CATEGORY_LABELS: Record<string, string> = {
  news: '뉴스 채널 대응 전략',
  sns: 'SNS 채널 대응 전략',
  community: '커뮤니티 채널 대응 전략',
};

const CATEGORY_ORDER = ['news', 'sns', 'community'];

export async function getStrategies(
  workspaceId: string,
  reportId?: string
): Promise<StrategyGroup[]> {
  let query = supabase
    .from('session_strategies')
    .select('category, strategy')
    .eq('workspace_id', workspaceId)
    .in('category', CATEGORY_ORDER)
    .order('created_at', { ascending: false });

  if (reportId) {
    query = query.eq('report_id', reportId);
  }

  const { data } = await query;

  const EMPTY_STRATEGY: StrategyData = {
    background: { summary: '', points: [] },
    proposal: { summary: '', actions: [] },
  };
  const items = (data ?? []).map((row) => {
    const parsed = strategyDataSchema.safeParse(row.strategy);
    return {
      category: row.category,
      label: CATEGORY_LABELS[row.category] ?? row.category,
      strategy: parsed.success ? parsed.data : EMPTY_STRATEGY,
    };
  });

  return items.sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
  );
}

// ── 이전 리포트 비교 ──

/**
 * daily ↔ daily, weekly ↔ weekly|initial 로 매칭해서 비교할 이전 보고서를 찾는다.
 * daily 가 있는 워크스페이스에서 daily 와 weekly 가 혼재해도 비교 기준 기간이 일관되도록.
 */
export async function getPrevReport(
  workspaceId: string,
  currentReportId: string
): Promise<PrevReport | null> {
  const { data } = await supabase
    .from('reports')
    .select('id, type, sir_score, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (!data || data.length < 2) return null;

  const currIdx = data.findIndex((r) => r.id === currentReportId);
  if (currIdx === -1) return null;

  const currType = data[currIdx].type;
  const compatibleTypes = currType === 'daily' ? ['daily'] : ['weekly', 'initial'];

  const prev = data.slice(currIdx + 1).find((r) => compatibleTypes.includes(r.type));
  if (!prev) return null;

  // 이전 report의 아이템/리스크 건수 조회 (session 기반)
  const meta = await getReportMeta(prev.id);
  let totalItems = 0;
  let riskCount = 0;

  if (meta.sessionIds.length > 0) {
    const [newsCount, communityCount, snsCount, newsRisk, communityRisk, snsRisk] =
      await Promise.all([
        supabase
          .from('news_items')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('is_relevant', true)
          .in('session_id', meta.sessionIds),
        supabase
          .from('community_items')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('is_relevant', true)
          .in('session_id', meta.sessionIds),
        supabase
          .from('sns_items')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('is_relevant', true)
          .in('session_id', meta.sessionIds),
        supabase
          .from('news_items')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .not('critical_type', 'is', null)
          .in('session_id', meta.sessionIds),
        supabase
          .from('community_items')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .not('critical_type', 'is', null)
          .in('session_id', meta.sessionIds),
        supabase
          .from('sns_items')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .not('critical_type', 'is', null)
          .in('session_id', meta.sessionIds),
      ]);
    totalItems = (newsCount.count ?? 0) + (communityCount.count ?? 0) + (snsCount.count ?? 0);
    riskCount = (newsRisk.count ?? 0) + (communityRisk.count ?? 0) + (snsRisk.count ?? 0);
  }

  // 이전 report의 채널별 SIR 평균
  const { data: prevSessions } = await supabase
    .from('sessions')
    .select('platform_id, sir_score')
    .eq('report_id', prev.id)
    .eq('status', 'done');

  const sirByChannel = new Map<string, number[]>();
  for (const s of prevSessions ?? []) {
    if (s.sir_score == null || !s.platform_id) continue;
    const channel = PLATFORM_TO_CHANNEL[s.platform_id] ?? s.platform_id;
    if (!sirByChannel.has(channel)) sirByChannel.set(channel, []);
    sirByChannel.get(channel)!.push(s.sir_score);
  }

  const channelSirMap: Record<string, number> = {};
  for (const [ch, scores] of sirByChannel) {
    channelSirMap[ch] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  return {
    id: prev.id,
    type: prev.type as string,
    sirScore: prev.sir_score ?? 0,
    createdAt: prev.created_at,
    totalItems,
    riskCount,
    channelSirMap,
  };
}

// ── 전일 스냅샷 (daily 보고서 전용 비교) ──
// daily 보고서는 이전 daily report 가 없어도 (첫 daily) daily_snapshots 테이블에
// 매일 점수가 쌓여있으므로 그걸 기준으로 "전일 대비" 비교.

export interface PrevDailySnapshot {
  date: string;
  sirScore: number;
  totalItems: number;
  riskCount: number;
  /** 채널(news/blog/youtube/community) 별 전일 SIR 평균 */
  channelSirMap: Record<string, number>;
}

export async function getPrevDailySnapshot(
  workspaceId: string,
  periodEnd: string
): Promise<PrevDailySnapshot | null> {
  // 1. 전날 snapshot — date < periodEnd 중 가장 최근
  const { data: snap } = await supabase
    .from('daily_snapshots')
    .select('id, date, sir_score')
    .eq('workspace_id', workspaceId)
    .lt('date', periodEnd)
    .not('sir_score', 'is', null)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!snap) return null;

  // 2. 해당 snapshot 의 platform_stats — content_count 합 + channel 별 SIR 평균
  const { data: stats } = await supabase
    .from('daily_platform_stats')
    .select('platform_id, content_count, sir_score')
    .eq('daily_snapshot_id', snap.id);
  const statsRows = stats ?? [];
  const totalItems = statsRows.reduce((sum, s) => sum + (s.content_count ?? 0), 0);

  const sirByChannel = new Map<string, number[]>();
  for (const s of statsRows) {
    if (s.sir_score == null) continue;
    const ch = PLATFORM_TO_CHANNEL[s.platform_id] ?? s.platform_id;
    if (!sirByChannel.has(ch)) sirByChannel.set(ch, []);
    sirByChannel.get(ch)!.push(s.sir_score);
  }
  const channelSirMap: Record<string, number> = {};
  for (const [ch, scores] of sirByChannel) {
    channelSirMap[ch] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  // 3. riskCount: items 테이블에서 해당 날짜 KST 범위 + critical_type NOT NULL + is_relevant=true
  const dayStart = new Date(`${snap.date}T00:00:00+09:00`).toISOString();
  const nextDay = new Date(`${snap.date}T00:00:00+09:00`);
  nextDay.setDate(nextDay.getDate() + 1);
  const dayEnd = nextDay.toISOString();

  const [newsRisk, communityRisk, snsRisk] = await Promise.all([
    supabase
      .from('news_items')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('is_relevant', true)
      .not('critical_type', 'is', null)
      .gte('published_at', dayStart)
      .lt('published_at', dayEnd),
    supabase
      .from('community_items')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('is_relevant', true)
      .not('critical_type', 'is', null)
      .gte('published_at', dayStart)
      .lt('published_at', dayEnd),
    supabase
      .from('sns_items')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('is_relevant', true)
      .not('critical_type', 'is', null)
      .gte('published_at', dayStart)
      .lt('published_at', dayEnd),
  ]);
  const riskCount = (newsRisk.count ?? 0) + (communityRisk.count ?? 0) + (snsRisk.count ?? 0);

  return {
    date: snap.date,
    sirScore: snap.sir_score ?? 0,
    totalItems,
    riskCount,
    channelSirMap,
  };
}

// ── 신고 대행 요청 ──

// DB 의 requested_at 은 NOT NULL DEFAULT now() 지만 supabase CLI 가 nullable 로 추출 →
// 도메인 RiskReport 와 맞추려 created_at fallback. 실제 fallback 은 거의 타지 않음.
function toRiskReport(row: Row<'risk_reports'>): RiskReport {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    report_id: row.report_id,
    source_table: row.source_table,
    source_id: row.source_id,
    platform_id: row.platform_id,
    title: row.title,
    link: row.link,
    critical_type: row.critical_type,
    reason: row.reason,
    evidence: row.evidence,
    file_urls: row.file_urls,
    status: row.status,
    admin_note: row.admin_note,
    requested_at: row.requested_at ?? row.created_at ?? '',
    resolved_at: row.resolved_at,
  };
}

export async function getRiskReports(
  workspaceId: string,
  reportId?: string
): Promise<RiskReport[]> {
  let query = supabase.from('risk_reports').select('*').order('requested_at', { ascending: false });
  if (workspaceId && workspaceId !== '_all') query = query.eq('workspace_id', workspaceId);
  if (reportId) query = query.eq('report_id', reportId);
  const { data } = await query;
  return (data ?? []).map(toRiskReport);
}

/**
 * 보고서 기간(period_start ~ period_end) 내에 "처리 완료"/"반려" 로 결과가
 * 확정된 신고 건을 모두 반환. daily(1일) / weekly(월~일) 공통.
 * 접수 시점이 아닌 resolved_at 기준 → 처리 결과가 확정된 날의 보고서(=익일 daily,
 * 또는 그 주 weekly) 에 반영됨.
 *
 * resolved_at 은 timestamptz(UTC 저장) 이고 period_start/end 는 KST 달력 일자이므로
 * `+09:00` 명시로 KST 자정 경계를 정확히 표현해야 한다 (없으면 PG 가 UTC 자정으로 해석해
 * 9시간 어긋남 — 4/28 새벽 KST 처리 건이 4/27 period 보고서에 잘못 들어가거나 누락됨).
 */
export async function getResolvedRiskReports(
  workspaceId: string,
  periodStart: string,
  periodEnd: string
): Promise<RiskReport[]> {
  const startIso = `${periodStart}T00:00:00+09:00`;
  const endIso = `${periodEnd}T23:59:59.999+09:00`;
  const { data } = await supabase
    .from('risk_reports')
    .select('*')
    .eq('workspace_id', workspaceId)
    .in('status', ['resolved', 'rejected'])
    .gte('resolved_at', startIso)
    .lte('resolved_at', endIso)
    .order('resolved_at', { ascending: false });
  return (data ?? []).map(toRiskReport);
}

export async function deleteRiskReport(id: string): Promise<void> {
  // Storage 파일 삭제 후 DB row 삭제
  const { data } = await supabase.from('risk_reports').select('file_urls').eq('id', id).single();
  const fileUrls = data?.file_urls ?? [];
  if (fileUrls.length > 0) {
    await supabase.storage.from('risk-attachments').remove(fileUrls);
  }
  const { error } = await supabase.from('risk_reports').delete().eq('id', id);
  if (error) throw error;
}

export interface SubmitRiskReportInput {
  workspaceId: string;
  reportId: string;
  item: RiskItem;
  reason: string;
  evidence: string;
  files: File[];
}

export async function submitRiskReport(input: SubmitRiskReportInput): Promise<void> {
  const { workspaceId, reportId, item, reason, evidence, files } = input;

  const fileUrls: string[] = [];
  for (const f of files) {
    const ext = f.name.split('.').pop() ?? '';
    const path = `${workspaceId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('risk-attachments').upload(path, f);
    if (error) throw error;
    fileUrls.push(path);
  }

  const res = await fetch('/api/risk-report/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspace_id: workspaceId,
      report_id: reportId,
      source_id: item.id,
      platform_id: item.platform_id,
      reason,
      evidence,
      file_urls: fileUrls,
    }),
  });
  if (!res.ok) {
    if (fileUrls.length > 0) {
      await supabase.storage.from('risk-attachments').remove(fileUrls).catch(() => undefined);
    }
    throw new Error(await readRouteError(res, '신고 대행 요청 실패'));
  }
}


export async function updateRiskReport(
  id: string,
  body: { status?: string; admin_note?: string }
): Promise<void> {
  const res = await fetch(`/api/risk-report/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readRouteError(res, '상태 업데이트 실패'));
}

// ── 대응 전략 수정 ──

// ── 리스크 해제 (관리자 전용) ──

export async function clearCriticalType(platformId: string, itemId: string): Promise<void> {
  const res = await fetch('/api/admin/clear-critical', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform_id: platformId, id: itemId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? '리스크 해제 실패');
  }
}

export async function updateStrategies(
  workspaceId: string,
  reportId: string,
  strategies: StrategyGroup[]
): Promise<void> {
  for (const group of strategies) {
    const { error } = await supabase
      .from('session_strategies')
      .update({ strategy: group.strategy })
      .eq('workspace_id', workspaceId)
      .eq('report_id', reportId)
      .eq('category', group.category);
    if (error) throw error;
  }
}

// ── 주가 데이터 ──

export async function getStockPrices(workspaceId: string) {
  const { data, error } = await supabase
    .from('stock_prices')
    .select('date, close_price')
    .eq('workspace_id', workspaceId)
    .order('date');
  if (error) throw error;
  return data as { date: string; close_price: number }[];
}
