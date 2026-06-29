import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';
import type { ChannelItem, NewsClusterResponse } from '@/types/report';

const supabase = createClient();

type Tables = Database['public']['Tables'];
type Row<T extends keyof Tables> = Tables[T]['Row'];

// ── 채널 매핑 ─────────────────────────────────────────────────────────
// platforms 테이블의 5종을 4채널로 묶음 (커뮤니티 = naver_stock + dcinside)

export type Channel = 'news' | 'blog' | 'youtube' | 'community';

export const MONITORING_CHANNELS: { id: Channel; label: string }[] = [
  { id: 'news', label: '뉴스' },
  { id: 'blog', label: '블로그' },
  { id: 'youtube', label: '유튜브' },
  { id: 'community', label: '커뮤니티' },
];

const PLATFORM_TO_CHANNEL: Record<string, Channel> = {
  naver_news: 'news',
  naver_blog: 'blog',
  youtube: 'youtube',
  naver_stock: 'community',
  dcinside: 'community',
};

export type CriticalType = Database['public']['Enums']['critical_type'];

export const CRITICAL_TYPES: { id: CriticalType; label: string }[] = [
  { id: 'defamation', label: '명예훼손' },
  { id: 'insult', label: '욕설/비방' },
  { id: 'rumor', label: '루머' },
  { id: 'spam', label: '스팸' },
];

// ── 반환 타입 ─────────────────────────────────────────────────────────

export interface MonitoringDayPoint {
  date: string;                                    // YYYY-MM-DD
  isCarried: boolean;
  channelVolume: Record<Channel, number>;
  totalVolume: number;
  positive: number;
  neutral: number;
  negative: number;
}

export interface MonitoringStockPoint {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
}

export interface MonitoringRiskPoint {
  date: string;
  byType: Record<CriticalType, number>;
  total: number;
}

export interface MonitoringSearchPoint {
  date: string;
  naver: number | null;
}

// ── 채널 매트릭스 (E 탭 sentiment 토글용) ─────────────────────────
// 일자×채널×sentiment 카운트. is_relevant=true 인 항목만 집계해 동명 노이즈
// (예: "대교" 검색 시 "광안대교") 를 제외한다.

export type Sentiment = 'positive' | 'neutral' | 'negative';
export type SentimentFilter = 'all' | Sentiment;

export interface ChannelMatrixCell {
  positive: number;
  neutral: number;
  negative: number;
  unknown: number; // sentiment === null (분석 실패/대기)
}

export interface MonitoringChannelMatrixPoint {
  date: string;
  byChannel: Record<Channel, ChannelMatrixCell>;
}

// ── 페이지네이션 헬퍼 (reportApi.ts 와 동일 패턴) ────────────────────
const _PAGE = 1000;
async function fetchAllPaged<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
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

function emptyChannelVolume(): Record<Channel, number> {
  return { news: 0, blog: 0, youtube: 0, community: 0 };
}

function emptyByType(): Record<CriticalType, number> {
  return { defamation: 0, insult: 0, rumor: 0, spam: 0 };
}

function emptyMatrixCell(): ChannelMatrixCell {
  return { positive: 0, neutral: 0, negative: 0, unknown: 0 };
}

function emptyByChannelMatrix(): Record<Channel, ChannelMatrixCell> {
  return {
    news: emptyMatrixCell(),
    blog: emptyMatrixCell(),
    youtube: emptyMatrixCell(),
    community: emptyMatrixCell(),
  };
}

/** sentiment 토글로 한 셀의 카운트를 슬라이스. 'all' 은 unknown(분석 미완) 도 포함. */
export function pickMatrixCount(cell: ChannelMatrixCell, sentiment: SentimentFilter): number {
  if (sentiment === 'all') return cell.positive + cell.neutral + cell.negative + cell.unknown;
  return cell[sentiment];
}

// ── API ───────────────────────────────────────────────────────────────

/** daily_snapshots + daily_platform_stats 머지. 채널별 수집량/감정 일자 시계열. */
export async function getMonitoringDaily(
  workspaceId: string,
  startDate: string,
  endDate: string,
): Promise<MonitoringDayPoint[]> {
  const snapshots = await fetchAllPaged((from, to) =>
    supabase
      .from('daily_snapshots')
      .select('id, date, is_carried')
      .eq('workspace_id', workspaceId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')
      .range(from, to),
  );

  if (snapshots.length === 0) return [];

  const ids = snapshots.map((s) => s.id);
  const stats = await fetchAllPaged((from, to) =>
    supabase
      .from('daily_platform_stats')
      .select(
        'daily_snapshot_id, platform_id, content_count, positive_count, negative_count, neutral_count',
      )
      .in('daily_snapshot_id', ids)
      .range(from, to),
  );

  type Acc = {
    channelVolume: Record<Channel, number>;
    positive: number;
    neutral: number;
    negative: number;
    totalVolume: number;
  };
  const accBySnap = new Map<string, Acc>();
  for (const s of stats) {
    const channel = PLATFORM_TO_CHANNEL[s.platform_id];
    if (!channel) continue;
    const cur =
      accBySnap.get(s.daily_snapshot_id) ?? {
        channelVolume: emptyChannelVolume(),
        positive: 0,
        neutral: 0,
        negative: 0,
        totalVolume: 0,
      };
    cur.channelVolume[channel] += s.content_count;
    cur.positive += s.positive_count;
    cur.neutral += s.neutral_count;
    cur.negative += s.negative_count;
    cur.totalVolume += s.content_count;
    accBySnap.set(s.daily_snapshot_id, cur);
  }

  return snapshots.map((s) => {
    const acc = accBySnap.get(s.id) ?? {
      channelVolume: emptyChannelVolume(),
      positive: 0,
      neutral: 0,
      negative: 0,
      totalVolume: 0,
    };
    return {
      date: s.date,
      isCarried: s.is_carried,
      channelVolume: acc.channelVolume,
      totalVolume: acc.totalVolume,
      positive: acc.positive,
      neutral: acc.neutral,
      negative: acc.negative,
    };
  });
}

/** stock_prices 시계열. close 는 NOT NULL, 나머지는 nullable. */
export async function getMonitoringStock(
  workspaceId: string,
  startDate: string,
  endDate: string,
): Promise<MonitoringStockPoint[]> {
  const rows = await fetchAllPaged((from, to) =>
    supabase
      .from('stock_prices')
      .select('date, open_price, high_price, low_price, close_price')
      .eq('workspace_id', workspaceId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')
      .range(from, to),
  );

  return rows.map((r) => ({
    date: r.date,
    open: r.open_price,
    high: r.high_price,
    low: r.low_price,
    close: r.close_price,
  }));
}

/** news_items + community_items + sns_items 의 critical_type 발생을 일자/타입별로 집계.
 *  published_at 기준. 필터에 `+09:00` offset 을 명시해 KST 자정 경계 어긋남 방지. */
export async function getMonitoringRisks(
  workspaceId: string,
  startDate: string,
  endDate: string,
): Promise<MonitoringRiskPoint[]> {
  const startISO = `${startDate}T00:00:00+09:00`;
  // endDate 자정까지 포함 → 다음날 00:00 미만
  const endNext = new Date(`${endDate}T00:00:00+09:00`);
  endNext.setDate(endNext.getDate() + 1);
  const endISO = endNext.toISOString();

  type Row = { published_at: string | null; critical_type: CriticalType | null };

  const buildItemQuery = (table: 'news_items' | 'community_items' | 'sns_items') => (
    from: number,
    to: number,
  ) =>
    supabase
      .from(table)
      .select('published_at, critical_type')
      .eq('workspace_id', workspaceId)
      .not('critical_type', 'is', null)
      .gte('published_at', startISO)
      .lt('published_at', endISO)
      .range(from, to);

  const [news, community, sns] = await Promise.all([
    fetchAllPaged<Row>(buildItemQuery('news_items')),
    fetchAllPaged<Row>(buildItemQuery('community_items')),
    fetchAllPaged<Row>(buildItemQuery('sns_items')),
  ]);

  const byDate = new Map<string, Record<CriticalType, number>>();
  for (const r of [...news, ...community, ...sns]) {
    if (!r.published_at || !r.critical_type) continue;
    // published_at 은 UTC ISO. KST 일자로 변환해서 묶음.
    const kst = new Date(new Date(r.published_at).getTime() + 9 * 60 * 60 * 1000);
    const date = kst.toISOString().slice(0, 10);
    const cur = byDate.get(date) ?? emptyByType();
    cur[r.critical_type] += 1;
    byDate.set(date, cur);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, byType]) => ({
      date,
      byType,
      total: byType.defamation + byType.insult + byType.rumor + byType.spam,
    }));
}

/** news_items + community_items + sns_items 의 raw row 를 일자×채널×sentiment 카운트로 집계.
 *  is_relevant=true 인 항목만 포함해 동명 노이즈를 제외한다. published_at 기준 KST 일자. */
export async function getMonitoringChannelMatrix(
  workspaceId: string,
  startDate: string,
  endDate: string,
): Promise<MonitoringChannelMatrixPoint[]> {
  const startISO = `${startDate}T00:00:00+09:00`;
  const endNext = new Date(`${endDate}T00:00:00+09:00`);
  endNext.setDate(endNext.getDate() + 1);
  const endISO = endNext.toISOString();

  type Row = {
    published_at: string | null;
    platform_id: string;
    sentiment: string | null;
  };

  const buildItemQuery = (table: 'news_items' | 'community_items' | 'sns_items') => (
    from: number,
    to: number,
  ) =>
    supabase
      .from(table)
      .select('published_at, platform_id, sentiment')
      .eq('workspace_id', workspaceId)
      .eq('is_relevant', true)
      .gte('published_at', startISO)
      .lt('published_at', endISO)
      .range(from, to);

  const [news, community, sns] = await Promise.all([
    fetchAllPaged<Row>(buildItemQuery('news_items')),
    fetchAllPaged<Row>(buildItemQuery('community_items')),
    fetchAllPaged<Row>(buildItemQuery('sns_items')),
  ]);

  const byDate = new Map<string, Record<Channel, ChannelMatrixCell>>();

  for (const r of [...news, ...community, ...sns]) {
    if (!r.published_at) continue;
    const channel = PLATFORM_TO_CHANNEL[r.platform_id];
    if (!channel) continue;

    const kst = new Date(new Date(r.published_at).getTime() + 9 * 60 * 60 * 1000);
    const date = kst.toISOString().slice(0, 10);

    const dayMap = byDate.get(date) ?? emptyByChannelMatrix();
    const cell = dayMap[channel];

    const s = r.sentiment;
    if (s === 'positive') cell.positive += 1;
    else if (s === 'neutral') cell.neutral += 1;
    else if (s === 'negative') cell.negative += 1;
    else cell.unknown += 1;

    byDate.set(date, dayMap);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, byChannel]) => ({ date, byChannel }));
}

// ── 최신 종가 — 상단 "현재 주가" 카드 전용 (기간 무관) ─────────────
// 수집량/리스크 KPI 는 페이지에서 선택 기간 daily/risks 합산으로 산정하므로
// 여기서는 가장 최근 종가만 단일 쿼리로 가져온다.

export async function getMonitoringLatestClose(
  workspaceId: string,
): Promise<number | null> {
  const { data: stockRow } = await supabase
    .from('stock_prices')
    .select('close_price')
    .eq('workspace_id', workspaceId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return stockRow?.close_price ?? null;
}

// ── 네이버 데이터랩 라이브 검색 트렌드 ─────────────────────────────
// 365일치 시계열을 한 번 가져와 클라이언트가 5 프리셋(7/30/90/180/365)으로 슬라이스 + 재정규화한다.
// 보고서별 정규화 baseline 차이로 인한 시각적 점프 문제를 해결.

export interface NaverSearchTrendLiveResponse {
  keyword: string;
  start: string;            // YYYY-MM-DD KST
  end: string;              // YYYY-MM-DD KST
  points: { date: string; ratio: number }[];
  cached?: boolean;         // 서버 캐시 hit 여부 (디버그용)
  stale?: boolean;          // 네이버 호출 실패 시 직전 캐시 fallback
}

export async function getNaverSearchTrendLive(
  workspaceId: string,
): Promise<NaverSearchTrendLiveResponse> {
  const res = await fetch('/api/monitoring/search-trend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`검색 트렌드 조회 실패 (${res.status}): ${detail.slice(0, 100)}`);
  }
  return res.json();
}

// ── AI 분석 ─────────────────────────────────────────────────────────

export interface MonitoringAiAnalysisResult {
  content: string;       // markdown
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
  stop_reason: string;
  cached: boolean;          // history row 조회면 true, 신규 분석이면 false
  generated_at: string;     // 생성 시각 (ISO timestamptz)
  period_start?: string;    // YYYY-MM-DD KST
  period_end?: string;      // YYYY-MM-DD KST
  used_tokens?: number;     // 신규 분석 시 실제 차감된 토큰 (input + output)
  token_balance?: number | null; // 신규 분석 후 워크스페이스 잔여 토큰. super_admin = null.
  unlimited?: boolean;      // super_admin 호출 시 true (차감 skip)
}

export interface MonitoringAiAnalysisEstimate {
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  estimated_total_tokens: number;
  token_balance: number;
  monthly_quota: number;
  unlimited: boolean;
}

export async function getMonitoringAiAnalysis(
  workspaceId: string,
  periodStart: string,
  periodEnd: string,
): Promise<MonitoringAiAnalysisResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('로그인이 필요합니다');

  // Next.js route handler 로 proxy (same-origin → CORS 회피, 백엔드 URL 클라이언트 미노출)
  const res = await fetch(`/api/monitoring/ai-analysis`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      period_start: periodStart,
      period_end: periodEnd,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`AI 분석 실패 (${res.status}): ${detail.slice(0, 100)}`);
  }
  return res.json();
}

/** 가장 최근 분석 결과 1건 (캐시 정책 제거 후 — 마이그 062). backend `/api/monitoring/ai-analysis/latest`.
 *  AiAnalysisCard 가 mount 시 자동 호출 → 페이지 진입 즉시 최신 분석 노출. 없으면 null.
 */
export async function getMonitoringAiAnalysisLatest(
  workspaceId: string,
): Promise<MonitoringAiAnalysisResult | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('로그인이 필요합니다');

  const res = await fetch(
    `/api/monitoring/ai-analysis/latest?workspace_id=${encodeURIComponent(workspaceId)}`,
    { headers: { Authorization: `Bearer ${session.access_token}` } },
  );
  if (!res.ok) {
    if (res.status === 404) return null;
    const detail = await res.text().catch(() => '');
    throw new Error(`최신 분석 조회 실패 (${res.status}): ${detail.slice(0, 100)}`);
  }
  const data = await res.json();
  return data || null;
}

/** 분석 히스토리 페이지용 — monitoring_ai_analyses 시간순 list.
 *  RLS(user_has_workspace_access) 로 본인 ws 만 조회. limit 100 (분석 빈도상 충분).
 */
export interface MonitoringAiAnalysisHistoryRow {
  id: string;
  content: string;
  model: string;
  period_start: string;
  period_end: string;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
}

export async function getMonitoringAiAnalysisHistory(
  workspaceId: string,
): Promise<MonitoringAiAnalysisHistoryRow[]> {
  const { data, error } = await supabase
    .from('monitoring_ai_analyses')
    .select('id, content, model, period_start, period_end, input_tokens, output_tokens, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data as MonitoringAiAnalysisHistoryRow[];
}

/** AI 분석 카드 헤더의 잔여 토큰 칩용 — 모달 거치지 않고 가볍게 표시.
 *  workspaces SELECT RLS(user_has_workspace_access) 로 본인 ws 의 토큰 컬럼 read 가능. */
export interface WorkspaceTokenStatus {
  token_balance: number;
  monthly_quota: number;
}

export async function getWorkspaceTokenStatus(workspaceId: string): Promise<WorkspaceTokenStatus | null> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('token_balance, monthly_quota')
    .eq('id', workspaceId)
    .maybeSingle();
  if (error || !data) return null;
  return { token_balance: data.token_balance, monthly_quota: data.monthly_quota };
}

/** 모달 기간 선택 즉시 예상 토큰 + 잔여량 표시용. backend `/api/monitoring/ai-analysis/estimate`. */
export async function getMonitoringAiAnalysisEstimate(
  workspaceId: string,
  periodStart: string,
  periodEnd: string,
): Promise<MonitoringAiAnalysisEstimate> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('로그인이 필요합니다');

  const res = await fetch(`/api/monitoring/ai-analysis/estimate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      period_start: periodStart,
      period_end: periodEnd,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`예상 토큰 조회 실패 (${res.status}): ${detail.slice(0, 100)}`);
  }
  return res.json();
}

// ── 일자별 수집 데이터 상세 (차트 클릭 시 drawer 노출용) ───────────────
// 차트 X축 = KST 일자. 클릭한 일자 하루치 raw items 를 채널별로 묶어서 반환.
// is_relevant=true 인 항목만 (reportApi.getChannelItems 와 동일 정책 → 동명 노이즈 차단).
// 뉴스는 cluster_id 가 붙은 row 들의 클러스터 본체(news_clusters) 도 함께 가져와 묶음 보기 가능.

type NewsItemDayRow = Pick<
  Row<'news_items'>,
  'id' | 'platform_id' | 'title' | 'summary' | 'sentiment' | 'link' | 'source' | 'published_at' | 'cluster_id'
>;
type CommunityItemDayRow = Pick<
  Row<'community_items'>,
  'id' | 'platform_id' | 'title' | 'content' | 'sentiment' | 'link' | 'views' | 'published_at'
>;
type SnsItemDayRow = Pick<
  Row<'sns_items'>,
  'id' | 'platform_id' | 'title' | 'content' | 'summary' | 'sentiment' | 'link' | 'author' | 'views' | 'published_at' | 'impact_score'
>;
type NewsClusterDayRow = Pick<
  Row<'news_clusters'>,
  'id' | 'representative_title' | 'sentiment' | 'summary'
>;

export interface DayItemsTotals {
  total: number;
  byChannel: Record<Channel, number>;
  bySentiment: { positive: number; neutral: number; negative: number; unknown: number };
}

export interface MonitoringDayItems {
  date: string;
  newsClusters: NewsClusterResponse[];
  newsUnclustered: ChannelItem[];
  blog: ChannelItem[];
  youtube: ChannelItem[];
  community: ChannelItem[];
  totals: DayItemsTotals;
}

function toChannelItemFromNews(r: NewsItemDayRow): ChannelItem {
  return {
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
  };
}

function toChannelItemFromCommunity(r: CommunityItemDayRow): ChannelItem {
  return {
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
  };
}

function toChannelItemFromSns(r: SnsItemDayRow): ChannelItem {
  return {
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
  };
}

function bumpSentiment(t: DayItemsTotals['bySentiment'], s: string | null) {
  if (s === 'positive') t.positive += 1;
  else if (s === 'negative') t.negative += 1;
  else if (s === 'neutral') t.neutral += 1;
  else t.unknown += 1;
}

export async function getMonitoringDayItems(
  workspaceId: string,
  date: string,
): Promise<MonitoringDayItems> {
  const startISO = `${date}T00:00:00+09:00`;
  const nextDay = new Date(`${date}T00:00:00+09:00`);
  nextDay.setDate(nextDay.getDate() + 1);
  const endISO = nextDay.toISOString();

  const [news, community, sns] = await Promise.all([
    fetchAllPaged<NewsItemDayRow>((from, to) =>
      supabase
        .from('news_items')
        .select('id, platform_id, title, summary, sentiment, link, source, published_at, cluster_id')
        .eq('workspace_id', workspaceId)
        .eq('is_relevant', true)
        .gte('published_at', startISO)
        .lt('published_at', endISO)
        .range(from, to),
    ),
    fetchAllPaged<CommunityItemDayRow>((from, to) =>
      supabase
        .from('community_items')
        .select('id, platform_id, title, content, sentiment, link, views, published_at')
        .eq('workspace_id', workspaceId)
        .eq('is_relevant', true)
        .gte('published_at', startISO)
        .lt('published_at', endISO)
        .range(from, to),
    ),
    fetchAllPaged<SnsItemDayRow>((from, to) =>
      supabase
        .from('sns_items')
        .select('id, platform_id, title, content, summary, sentiment, link, author, views, published_at, impact_score')
        .eq('workspace_id', workspaceId)
        .eq('is_relevant', true)
        .gte('published_at', startISO)
        .lt('published_at', endISO)
        .range(from, to),
    ),
  ]);

  // 뉴스 클러스터 본체 — 그날 뉴스 row 의 cluster_id 합집합으로만 조회.
  // (cross-session matching 도 결국 row 의 cluster_id 가 정답이므로 row 기준 fetch.)
  const clusterIds = Array.from(
    new Set(news.map((n) => n.cluster_id).filter((v): v is string => !!v)),
  );

  let clusters: NewsClusterDayRow[] = [];
  if (clusterIds.length > 0) {
    clusters = await fetchAllPaged<NewsClusterDayRow>((from, to) =>
      supabase
        .from('news_clusters')
        .select('id, representative_title, sentiment, summary')
        .eq('workspace_id', workspaceId)
        .eq('is_relevant', true)
        .in('id', clusterIds)
        .range(from, to),
    );
  }

  const clusterMap = new Map(clusters.map((c) => [c.id, c]));
  const itemsByCluster = new Map<
    string,
    { title: string; source: string; link: string; published_at: string | null }[]
  >();
  for (const n of news) {
    if (!n.cluster_id || !clusterMap.has(n.cluster_id)) continue;
    if (!itemsByCluster.has(n.cluster_id)) itemsByCluster.set(n.cluster_id, []);
    itemsByCluster.get(n.cluster_id)!.push({
      title: n.title ?? '',
      source: n.source ?? '',
      link: n.link ?? '#',
      published_at: n.published_at ?? null,
    });
  }

  const newsClusters: NewsClusterResponse[] = clusters.map((c) => ({
    id: c.id,
    representative_title: c.representative_title,
    sentiment: c.sentiment,
    summary: c.summary,
    items: itemsByCluster.get(c.id) ?? [],
  }));

  // 비클러스터 뉴스 — cluster_id null 또는 cluster row 가 is_relevant=false 라 본체 fetch 에서 빠진 케이스
  const validClusterSet = new Set(clusters.map((c) => c.id));
  const newsUnclustered: ChannelItem[] = news
    .filter((n) => !n.cluster_id || !validClusterSet.has(n.cluster_id))
    .map(toChannelItemFromNews);

  const blog = sns
    .filter((s) => s.platform_id === 'naver_blog')
    .map(toChannelItemFromSns);
  const youtube = sns
    .filter((s) => s.platform_id === 'youtube')
    .map(toChannelItemFromSns);
  const communityItems = community.map(toChannelItemFromCommunity);

  const totals: DayItemsTotals = {
    total: news.length + community.length + sns.length,
    byChannel: {
      news: news.length,
      blog: blog.length,
      youtube: youtube.length,
      community: communityItems.length,
    },
    bySentiment: { positive: 0, neutral: 0, negative: 0, unknown: 0 },
  };
  for (const r of news) bumpSentiment(totals.bySentiment, r.sentiment);
  for (const r of community) bumpSentiment(totals.bySentiment, r.sentiment);
  for (const r of sns) bumpSentiment(totals.bySentiment, r.sentiment);

  return {
    date,
    newsClusters,
    newsUnclustered,
    blog,
    youtube,
    community: communityItems,
    totals,
  };
}
