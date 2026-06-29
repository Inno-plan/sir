import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import {
  getReportInfo,
  getWeeklySummary,
  getSirStockData,
  getSirRanking,
  getChannelStats,
  getChannelItems,
  getNewsClusters,
  getRiskItems,
  getStrategies,
  getPrevReport,
  getPrevDailySnapshot,
  getRiskReports,
  getResolvedRiskReports,
  getRiskItemSummary,
  getRiskNoticeRead,
} from '@/lib/api/reportApi';
import type { ChannelItem } from '@/lib/api/reportApi';
import { workspaceKeys } from '@/hooks/workspace/workspaceKeys';
import { getWorkspace } from '@/lib/api/workspaceApi';
import { getMonitoringDaily } from '@/lib/api/monitoringApi';

export const reportKeys = {
  info: (workspaceId: string, reportId: string) => ['report', workspaceId, reportId, 'info'] as const,
  summary: (id: string) => ['report', id, 'summary'] as const,
  sirStock: (id: string) => ['report', id, 'sirStock'] as const,
  sirRanking: (id: string) => ['report', id, 'sirRanking'] as const,
  channelItems: (id: string) => ['report', id, 'channelItems'] as const,
  newsClusters: (id: string) => ['report', id, 'newsClusters'] as const,
  channelStats: (id: string) => ['report', id, 'channelStats'] as const,
  riskItems: (id: string) => ['report', id, 'riskItems'] as const,
  riskItemSummary: (id: string) => ['report', id, 'riskItemSummary'] as const,
  riskNoticeRead: (id: string) => ['report', id, 'riskNoticeRead'] as const,
  strategies: (id: string) => ['report', id, 'strategies'] as const,
  prevReport: (id: string, reportId: string) => ['report', id, 'prevReport', reportId] as const,
  prevDailySnapshot: (id: string, periodEnd?: string) => ['report', id, 'prevDailySnapshot', periodEnd ?? ''] as const,
  riskReports: (id: string, reportId?: string) => ['report', id, 'riskReports', reportId] as const,
  /** workspace 의 모든 reportId 변형(undefined/''/특정id) 을 한 번에 invalidate 하기 위한 prefix 키. */
  riskReportsAll: (id: string) => ['report', id, 'riskReports'] as const,
  resolvedRiskReports: (id: string, from: string, to: string) => ['report', id, 'resolvedRiskReports', from, to] as const,
  /** 모든 period 변형을 prefix 로 잡는 키 — status 변경 후 일괄 invalidate 용. */
  resolvedRiskReportsAll: (id: string) => ['report', id, 'resolvedRiskReports'] as const,
  dailyCollection7d: (id: string, periodEnd?: string) => ['report', id, 'dailyCollection7d', periodEnd ?? ''] as const,
};

// 리포트 데이터는 주간 보고서 — 페이지 내 refetch 불필요, 캐시 공유 극대화
const REPORT_OPTS = {
  staleTime: Infinity,
  gcTime: 10 * 60 * 1000,
  refetchOnWindowFocus: false,
} as const;

/** 리포트 기본 정보 (type, period, status, sir_score) */
export function useReportInfo(workspaceId: string | undefined, reportId: string | undefined) {
  return useQuery({
    queryKey: reportKeys.info(workspaceId ?? '', reportId ?? ''),
    queryFn: () => getReportInfo(workspaceId!, reportId!),
    enabled: !!workspaceId && !!reportId,
    ...REPORT_OPTS,
  });
}

// ── 기초 쿼리 (네트워크 요청) ──

/** workspace sir_score — workspaceKeys 캐시 재사용 */
export function useWorkspaceSir(workspaceId: string) {
  return useQuery({
    queryKey: workspaceKeys.detail(workspaceId),
    queryFn: () => getWorkspace(workspaceId),
    enabled: !!workspaceId,
    ...REPORT_OPTS,
  });
}

/** 총평 — session_strategies(platform_id=null) */
export function useWeeklySummary(workspaceId: string, reportId?: string) {
  return useQuery({
    queryKey: [...reportKeys.summary(workspaceId), reportId],
    queryFn: () => getWeeklySummary(workspaceId, reportId),
    enabled: !!workspaceId,
    ...REPORT_OPTS,
  });
}

export function useSirStockData(workspaceId: string, reportId?: string) {
  return useQuery({
    queryKey: [...reportKeys.sirStock(workspaceId), reportId],
    queryFn: () => getSirStockData(workspaceId, reportId),
    enabled: !!workspaceId,
    ...REPORT_OPTS,
  });
}

export function useSirRanking(workspaceId: string, reportId?: string) {
  return useQuery({
    queryKey: [...reportKeys.sirRanking(workspaceId), reportId],
    queryFn: () => getSirRanking(workspaceId, reportId),
    enabled: !!workspaceId,
    ...REPORT_OPTS,
  });
}

/** 모든 관련 아이템 — channelStats, sentimentDetail, topContent에서 공유 */
export function useChannelItems(workspaceId: string, reportId?: string) {
  return useQuery({
    queryKey: [...reportKeys.channelItems(workspaceId), reportId],
    queryFn: () => getChannelItems(workspaceId, reportId),
    enabled: !!workspaceId,
    ...REPORT_OPTS,
  });
}

export function useNewsClusters(workspaceId: string, reportId?: string) {
  return useQuery({
    queryKey: [...reportKeys.newsClusters(workspaceId), reportId],
    queryFn: () => getNewsClusters(workspaceId, reportId),
    enabled: !!workspaceId,
    ...REPORT_OPTS,
  });
}

/** channelItems(감정 집계) + period 기반 daily_platform_stats(채널별 SIR) 파생.
 *  주간/월간 보고서도 정확한 채널별 SIR 표시되도록 period 필수.
 */
export function useChannelStats(
  workspaceId: string,
  channelItems?: ChannelItem[],
  reportId?: string,
  periodStart?: string,
  periodEnd?: string,
) {
  return useQuery({
    queryKey: [...reportKeys.channelStats(workspaceId), reportId, periodStart, periodEnd],
    queryFn: () => getChannelStats(workspaceId, channelItems!, reportId, periodStart, periodEnd),
    enabled: !!workspaceId && !!channelItems,
    ...REPORT_OPTS,
  });
}

export function useRiskItems(workspaceId: string, reportId?: string) {
  return useQuery({
    queryKey: [...reportKeys.riskItems(workspaceId), reportId],
    queryFn: () => getRiskItems(workspaceId, reportId),
    enabled: !!workspaceId,
    ...REPORT_OPTS,
  });
}

export function useRiskItemSummary(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: reportKeys.riskItemSummary(workspaceId),
    queryFn: () => getRiskItemSummary(workspaceId),
    enabled: enabled && !!workspaceId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useRiskNoticeRead(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: reportKeys.riskNoticeRead(workspaceId),
    queryFn: () => getRiskNoticeRead(workspaceId),
    enabled: enabled && !!workspaceId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useStrategies(workspaceId: string, reportId?: string) {
  return useQuery({
    queryKey: [...reportKeys.strategies(workspaceId), reportId],
    queryFn: () => getStrategies(workspaceId, reportId),
    enabled: !!workspaceId,
    ...REPORT_OPTS,
  });
}

export function usePrevReport(workspaceId: string, reportId: string) {
  return useQuery({
    queryKey: reportKeys.prevReport(workspaceId, reportId),
    queryFn: () => getPrevReport(workspaceId, reportId),
    enabled: !!workspaceId && !!reportId,
    ...REPORT_OPTS,
  });
}

/** daily 보고서 전일 비교용 snapshot (daily_snapshots + items 기반) */
export function usePrevDailySnapshot(workspaceId: string, periodEnd: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: reportKeys.prevDailySnapshot(workspaceId, periodEnd),
    queryFn: () => getPrevDailySnapshot(workspaceId, periodEnd!),
    enabled: enabled && !!workspaceId && !!periodEnd,
    ...REPORT_OPTS,
  });
}

export function useRiskReports(workspaceId: string, reportId?: string) {
  return useQuery({
    queryKey: reportKeys.riskReports(workspaceId, reportId),
    queryFn: () => getRiskReports(workspaceId, reportId),
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/** 보고서 기간 내 결과 확정(resolved/rejected)된 신고 — 처리 결과 섹션용 */
export function useResolvedRiskReports(workspaceId: string, periodStart?: string, periodEnd?: string) {
  return useQuery({
    queryKey: reportKeys.resolvedRiskReports(workspaceId, periodStart ?? '', periodEnd ?? ''),
    queryFn: () => getResolvedRiskReports(workspaceId, periodStart!, periodEnd!),
    enabled: !!workspaceId && !!periodStart && !!periodEnd,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

// ── Suspense 변형 ──
// 보고서 상세 페이지(관리자 / 클라이언트 / PDF)처럼 '모든 데이터가 준비된 뒤 한 번에 렌더'가
// 필요한 곳 전용. 호출 측은 반드시 <Suspense fallback={...}> 경계 안에 있어야 한다.
// 의존 체인(예: channelItems → channelStats) 는 호출 측에서 순서대로 훅을 호출하면
// React 가 자동 waterfall 처리.
// enabled 조건이 필요한 쿼리는 skipToken 으로 스킵 (이 경우 data 가 undefined 가능).

export function useReportInfoSuspense(workspaceId: string, reportId: string) {
  return useSuspenseQuery({
    queryKey: reportKeys.info(workspaceId, reportId),
    queryFn: () => getReportInfo(workspaceId, reportId),
    ...REPORT_OPTS,
  });
}

export function useWorkspaceSirSuspense(workspaceId: string) {
  return useSuspenseQuery({
    queryKey: workspaceKeys.detail(workspaceId),
    queryFn: () => getWorkspace(workspaceId),
    ...REPORT_OPTS,
  });
}

export function useWeeklySummarySuspense(workspaceId: string, reportId?: string) {
  return useSuspenseQuery({
    queryKey: [...reportKeys.summary(workspaceId), reportId],
    queryFn: () => getWeeklySummary(workspaceId, reportId),
    ...REPORT_OPTS,
  });
}

export function useSirStockDataSuspense(workspaceId: string, reportId?: string) {
  return useSuspenseQuery({
    queryKey: [...reportKeys.sirStock(workspaceId), reportId],
    queryFn: () => getSirStockData(workspaceId, reportId),
    ...REPORT_OPTS,
  });
}

export function useSirRankingSuspense(workspaceId: string, reportId?: string) {
  return useSuspenseQuery({
    queryKey: [...reportKeys.sirRanking(workspaceId), reportId],
    queryFn: () => getSirRanking(workspaceId, reportId),
    ...REPORT_OPTS,
  });
}

export function useChannelItemsSuspense(workspaceId: string, reportId?: string) {
  return useSuspenseQuery({
    queryKey: [...reportKeys.channelItems(workspaceId), reportId],
    queryFn: () => getChannelItems(workspaceId, reportId),
    ...REPORT_OPTS,
  });
}

export function useNewsClustersSuspense(workspaceId: string, reportId?: string) {
  return useSuspenseQuery({
    queryKey: [...reportKeys.newsClusters(workspaceId), reportId],
    queryFn: () => getNewsClusters(workspaceId, reportId),
    ...REPORT_OPTS,
  });
}

export function useChannelStatsSuspense(
  workspaceId: string,
  channelItems: ChannelItem[],
  reportId?: string,
  periodStart?: string,
  periodEnd?: string,
) {
  return useSuspenseQuery({
    queryKey: [...reportKeys.channelStats(workspaceId), reportId, periodStart, periodEnd],
    queryFn: () => getChannelStats(workspaceId, channelItems, reportId, periodStart, periodEnd),
    ...REPORT_OPTS,
  });
}

export function useRiskItemsSuspense(workspaceId: string, reportId?: string) {
  return useSuspenseQuery({
    queryKey: [...reportKeys.riskItems(workspaceId), reportId],
    queryFn: () => getRiskItems(workspaceId, reportId),
    ...REPORT_OPTS,
  });
}

export function useStrategiesSuspense(workspaceId: string, reportId?: string) {
  return useSuspenseQuery({
    queryKey: [...reportKeys.strategies(workspaceId), reportId],
    queryFn: () => getStrategies(workspaceId, reportId),
    ...REPORT_OPTS,
  });
}

export function usePrevReportSuspense(workspaceId: string, reportId: string) {
  return useSuspenseQuery({
    queryKey: reportKeys.prevReport(workspaceId, reportId),
    queryFn: () => getPrevReport(workspaceId, reportId),
    ...REPORT_OPTS,
  });
}

/** enabled=false 또는 periodEnd 부재면 즉시-resolve 로 스킵 — data=null. */
export function usePrevDailySnapshotSuspense(workspaceId: string, periodEnd: string | undefined, enabled: boolean) {
  const shouldFetch = enabled && !!periodEnd;
  return useSuspenseQuery({
    queryKey: reportKeys.prevDailySnapshot(workspaceId, periodEnd),
    queryFn: shouldFetch
      ? () => getPrevDailySnapshot(workspaceId, periodEnd)
      : () => Promise.resolve(null),
    ...REPORT_OPTS,
  });
}

export function useRiskReportsSuspense(workspaceId: string, reportId?: string) {
  return useSuspenseQuery({
    queryKey: reportKeys.riskReports(workspaceId, reportId),
    queryFn: () => getRiskReports(workspaceId, reportId),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/** Daily Snapshot 의 채널별 7일 평균용. periodEnd 기준 오늘 포함 직전 7일(=오늘 포함). */
export function useDailyCollectionStatsSuspense(
  workspaceId: string,
  periodEnd: string | undefined,
  enabled: boolean,
) {
  const shouldFetch = enabled && !!periodEnd;
  return useSuspenseQuery({
    queryKey: reportKeys.dailyCollection7d(workspaceId, periodEnd),
    queryFn: shouldFetch
      ? () => {
          const end = new Date(`${periodEnd}T00:00:00+09:00`);
          const start = new Date(end);
          start.setDate(start.getDate() - 6);
          const startStr = start.toISOString().slice(0, 10);
          return getMonitoringDaily(workspaceId, startStr, periodEnd);
        }
      : () => Promise.resolve([]),
    ...REPORT_OPTS,
  });
}

export function useResolvedRiskReportsSuspense(workspaceId: string, periodStart: string, periodEnd: string) {
  return useSuspenseQuery({
    queryKey: reportKeys.resolvedRiskReports(workspaceId, periodStart, periodEnd),
    queryFn: () => getResolvedRiskReports(workspaceId, periodStart, periodEnd),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
