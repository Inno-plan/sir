import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useChannelStats,
  usePrevDailySnapshotSuspense,
  useReportInfo,
  useResolvedRiskReports,
  useRiskReports,
  useWeeklySummary,
} from '@/hooks/report/useReportQuery';
import {
  getChannelStats,
  getPrevDailySnapshot,
  getReportInfo,
  getResolvedRiskReports,
  getRiskReports,
  getWeeklySummary,
} from '@/lib/api/reportApi';

const reactQueryMocks = vi.hoisted(() => ({
  useQuery: vi.fn((options) => options),
  useSuspenseQuery: vi.fn((options) => options),
}));

const reportApiMocks = vi.hoisted(() => ({
  getReportInfo: vi.fn(),
  getWeeklySummary: vi.fn(),
  getSirStockData: vi.fn(),
  getSirRanking: vi.fn(),
  getChannelStats: vi.fn(),
  getChannelItems: vi.fn(),
  getNewsClusters: vi.fn(),
  getRiskItems: vi.fn(),
  getStrategies: vi.fn(),
  getPrevReport: vi.fn(),
  getPrevDailySnapshot: vi.fn(),
  getRiskReports: vi.fn(),
  getResolvedRiskReports: vi.fn(),
  getRiskItemSummary: vi.fn(),
  getRiskNoticeRead: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => reactQueryMocks);

vi.mock('@/lib/api/reportApi', () => reportApiMocks);

vi.mock('@/lib/api/workspaceApi', () => ({
  getWorkspace: vi.fn(),
}));

vi.mock('@/lib/api/monitoringApi', () => ({
  getMonitoringDaily: vi.fn(),
}));

vi.mock('@/hooks/workspace/workspaceKeys', () => ({
  workspaceKeys: {
    detail: (id: string) => ['workspace', id, 'detail'] as const,
  },
}));

type QueryOptions = {
  queryKey: readonly unknown[];
  queryFn: () => unknown;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchOnWindowFocus?: boolean;
};

function asQueryOptions(value: unknown): QueryOptions {
  return value as QueryOptions;
}

describe('report query hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses workspaceId and reportId together for report info lookups', async () => {
    const options = asQueryOptions(useReportInfo('workspace-id', 'report-id'));

    expect(options.queryKey).toEqual(['report', 'workspace-id', 'report-id', 'info']);
    expect(options.enabled).toBe(true);
    expect(options.staleTime).toBe(Infinity);
    expect(options.refetchOnWindowFocus).toBe(false);

    await options.queryFn();

    expect(getReportInfo).toHaveBeenCalledWith('workspace-id', 'report-id');
  });

  it('disables report info lookups until both route params exist', () => {
    const options = asQueryOptions(useReportInfo(undefined, 'report-id'));

    expect(options.queryKey).toEqual(['report', '', 'report-id', 'info']);
    expect(options.enabled).toBe(false);
  });

  it('keys weekly summary by workspace and report to avoid cross-report cache reuse', async () => {
    const options = asQueryOptions(useWeeklySummary('workspace-id', 'report-id'));

    expect(options.queryKey).toEqual(['report', 'workspace-id', 'summary', 'report-id']);
    expect(options.enabled).toBe(true);

    await options.queryFn();

    expect(getWeeklySummary).toHaveBeenCalledWith('workspace-id', 'report-id');
  });

  it('waits for channel items before deriving channel stats and preserves period keys', async () => {
    const disabled = asQueryOptions(useChannelStats(
      'workspace-id',
      undefined,
      'report-id',
      '2026-06-22',
      '2026-06-28',
    ));

    expect(disabled.queryKey).toEqual([
      'report',
      'workspace-id',
      'channelStats',
      'report-id',
      '2026-06-22',
      '2026-06-28',
    ]);
    expect(disabled.enabled).toBe(false);

    const channelItems = [{ id: 'item-id', sentiment: 'positive' }];
    const enabled = asQueryOptions(useChannelStats(
      'workspace-id',
      channelItems as never,
      'report-id',
      '2026-06-22',
      '2026-06-28',
    ));

    expect(enabled.enabled).toBe(true);

    await enabled.queryFn();

    expect(getChannelStats).toHaveBeenCalledWith(
      'workspace-id',
      channelItems,
      'report-id',
      '2026-06-22',
      '2026-06-28',
    );
  });

  it('skips previous daily snapshot suspense fetches when the period is not ready', async () => {
    const options = asQueryOptions(usePrevDailySnapshotSuspense('workspace-id', undefined, true));

    expect(options.queryKey).toEqual(['report', 'workspace-id', 'prevDailySnapshot', '']);
    await expect(options.queryFn()).resolves.toBeNull();
    expect(getPrevDailySnapshot).not.toHaveBeenCalled();
  });

  it('keys risk report queries by workspace/report and keeps a short freshness window', async () => {
    const options = asQueryOptions(useRiskReports('workspace-id', 'report-id'));

    expect(options.queryKey).toEqual(['report', 'workspace-id', 'riskReports', 'report-id']);
    expect(options.enabled).toBe(true);
    expect(options.staleTime).toBe(30 * 1000);
    expect(options.gcTime).toBe(5 * 60 * 1000);

    await options.queryFn();

    expect(getRiskReports).toHaveBeenCalledWith('workspace-id', 'report-id');
  });

  it('does not fetch resolved risk reports until both period bounds exist', async () => {
    const disabled = asQueryOptions(useResolvedRiskReports(
      'workspace-id',
      '2026-06-22',
      undefined,
    ));

    expect(disabled.queryKey).toEqual([
      'report',
      'workspace-id',
      'resolvedRiskReports',
      '2026-06-22',
      '',
    ]);
    expect(disabled.enabled).toBe(false);

    const enabled = asQueryOptions(useResolvedRiskReports(
      'workspace-id',
      '2026-06-22',
      '2026-06-28',
    ));

    expect(enabled.enabled).toBe(true);

    await enabled.queryFn();

    expect(getResolvedRiskReports).toHaveBeenCalledWith(
      'workspace-id',
      '2026-06-22',
      '2026-06-28',
    );
  });
});
