import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useMarkRiskNoticeRead,
  usePublishReport,
  useUpdateStrategies,
  useUpdateSummary,
} from '@/hooks/report/useReportMutation';
import {
  markRiskNoticeRead,
  publishReport,
  updateStrategies,
  upsertWeeklySummary,
} from '@/lib/api/reportApi';
import type { StrategyGroup, SummarySection } from '@/lib/api/reportApi';

const queryMocks = vi.hoisted(() => {
  const queryClient = {
    cancelQueries: vi.fn(),
    getQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    refetchQueries: vi.fn(),
    setQueryData: vi.fn(),
  };
  const useMutation = vi.fn((options) => options);
  const useQueryClient = vi.fn(() => queryClient);

  return {
    queryClient,
    useMutation,
    useQueryClient,
  };
});

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: queryMocks.useMutation,
  useQueryClient: queryMocks.useQueryClient,
}));

vi.mock('sonner', () => ({
  toast: toastMocks,
}));

vi.mock('@/lib/api/reportApi', () => ({
  clearCriticalType: vi.fn(),
  deleteRiskReport: vi.fn(),
  markRiskNoticeRead: vi.fn(),
  publishReport: vi.fn(),
  submitRiskReport: vi.fn(),
  updateRiskReport: vi.fn(),
  updateStrategies: vi.fn(),
  upsertWeeklySummary: vi.fn(),
}));

vi.mock('@/hooks/report/useReportQuery', () => ({
  reportKeys: {
    riskNoticeRead: (id: string) => ['report', id, 'riskNoticeRead'] as const,
    riskItems: (id: string) => ['report', id, 'riskItems'] as const,
    riskItemSummary: (id: string) => ['report', id, 'riskItemSummary'] as const,
    riskReportsAll: (id: string) => ['report', id, 'riskReports'] as const,
    resolvedRiskReportsAll: (id: string) => ['report', id, 'resolvedRiskReports'] as const,
    summary: (id: string) => ['report', id, 'summary'] as const,
    strategies: (id: string) => ['report', id, 'strategies'] as const,
    info: (workspaceId: string, reportId: string) =>
      ['report', workspaceId, reportId, 'info'] as const,
  },
}));

vi.mock('@/hooks/workspace/workspaceKeys', () => ({
  workspaceKeys: {
    detail: (id: string) => ['workspace', id, 'detail'] as const,
    progress: (id: string) => ['workspace', id, 'progress'] as const,
    reports: (id: string) => ['workspace', id, 'reports'] as const,
  },
}));

type MutationOptions<TVariables, TContext = unknown> = {
  mutationFn: (variables: TVariables) => Promise<unknown>;
  onMutate?: (variables: TVariables) => Promise<TContext>;
  onError?: (error: Error, variables: TVariables, context?: TContext) => void;
  onSuccess?: () => void;
  onSettled?: () => void;
};

const summarySections: SummarySection[] = [
  {
    summary: '요약',
    subsections: [
      {
        title: '세부',
        points: ['포인트'],
      },
    ],
  },
];

const previousSummary: SummarySection[] = [
  {
    summary: '이전 요약',
    subsections: [],
  },
];

const strategyGroups: StrategyGroup[] = [
  {
    category: 'news',
    label: '뉴스',
    strategy: {
      background: { summary: '배경', points: ['근거'] },
      proposal: {
        summary: '제안',
        actions: [{ platform: 'news', topic: '토픽', contents: ['액션'] }],
      },
    },
  },
];

const previousStrategies: StrategyGroup[] = [
  {
    category: 'community',
    label: '커뮤니티',
    strategy: {
      background: { summary: '이전 배경', points: [] },
      proposal: { summary: '이전 제안', actions: [] },
    },
  },
];

describe('report mutation hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useMarkRiskNoticeRead', () => {
    it('marks the supplied latest risk timestamp for the workspace', async () => {
      const mutation = useMarkRiskNoticeRead('workspace-id') as unknown as MutationOptions<string>;

      await mutation.mutationFn('2026-07-02T00:00:00.000Z');

      expect(markRiskNoticeRead).toHaveBeenCalledWith(
        'workspace-id',
        '2026-07-02T00:00:00.000Z',
      );
    });

    it('invalidates the workspace risk notice read query on success', () => {
      const mutation = useMarkRiskNoticeRead('workspace-id') as unknown as MutationOptions<string>;

      mutation.onSuccess?.();

      expect(queryMocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['report', 'workspace-id', 'riskNoticeRead'],
      });
    });
  });

  describe('usePublishReport', () => {
    it('publishes by reportId and refreshes report/workspace caches on success', async () => {
      const mutation = usePublishReport('report-id', 'workspace-id') as unknown as MutationOptions<void>;

      await mutation.mutationFn(undefined as never);
      mutation.onSuccess?.();

      expect(publishReport).toHaveBeenCalledWith('report-id');
      expect(queryMocks.queryClient.refetchQueries).toHaveBeenCalledWith({
        queryKey: ['report', 'workspace-id', 'report-id', 'info'],
      });
      expect(queryMocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['workspace', 'workspace-id', 'reports'],
      });
      expect(queryMocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['workspace', 'workspace-id', 'progress'],
      });
      expect(queryMocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['workspace', 'workspace-id', 'detail'],
      });
      expect(toastMocks.success).toHaveBeenCalledWith('보고서가 발행되었습니다.');
    });
  });

  describe('useUpdateSummary', () => {
    it('optimistically updates and refetches the report summary cache', async () => {
      queryMocks.queryClient.getQueryData.mockReturnValueOnce(previousSummary);
      const mutation = useUpdateSummary('workspace-id', 'report-id') as unknown as MutationOptions<
        SummarySection[],
        { previous?: SummarySection[] }
      >;

      await mutation.mutationFn(summarySections);
      const context = await mutation.onMutate?.(summarySections);
      mutation.onSettled?.();

      const queryKey = ['report', 'workspace-id', 'summary', 'report-id'];
      expect(upsertWeeklySummary).toHaveBeenCalledWith('workspace-id', 'report-id', summarySections);
      expect(queryMocks.queryClient.cancelQueries).toHaveBeenCalledWith({ queryKey });
      expect(queryMocks.queryClient.getQueryData).toHaveBeenCalledWith(queryKey);
      expect(queryMocks.queryClient.setQueryData).toHaveBeenCalledWith(queryKey, summarySections);
      expect(context).toEqual({ previous: previousSummary });
      expect(queryMocks.queryClient.refetchQueries).toHaveBeenCalledWith({ queryKey });
    });

    it('rolls back the report summary cache on error', async () => {
      const mutation = useUpdateSummary('workspace-id', 'report-id') as unknown as MutationOptions<
        SummarySection[],
        { previous?: SummarySection[] }
      >;
      const queryKey = ['report', 'workspace-id', 'summary', 'report-id'];

      mutation.onError?.(new Error('failed'), summarySections, { previous: previousSummary });

      expect(queryMocks.queryClient.setQueryData).toHaveBeenCalledWith(queryKey, previousSummary);
      expect(toastMocks.error).toHaveBeenCalledWith('failed');
    });
  });

  describe('useUpdateStrategies', () => {
    it('optimistically updates and refetches the report strategy cache', async () => {
      queryMocks.queryClient.getQueryData.mockReturnValueOnce(previousStrategies);
      const mutation = useUpdateStrategies('workspace-id', 'report-id') as unknown as MutationOptions<
        StrategyGroup[],
        { previous?: StrategyGroup[] }
      >;

      await mutation.mutationFn(strategyGroups);
      const context = await mutation.onMutate?.(strategyGroups);
      mutation.onSettled?.();

      const queryKey = ['report', 'workspace-id', 'strategies', 'report-id'];
      expect(updateStrategies).toHaveBeenCalledWith('workspace-id', 'report-id', strategyGroups);
      expect(queryMocks.queryClient.cancelQueries).toHaveBeenCalledWith({ queryKey });
      expect(queryMocks.queryClient.setQueryData).toHaveBeenCalledWith(queryKey, strategyGroups);
      expect(context).toEqual({ previous: previousStrategies });
      expect(queryMocks.queryClient.refetchQueries).toHaveBeenCalledWith({ queryKey });
    });

    it('rolls back the report strategy cache on error', () => {
      const mutation = useUpdateStrategies('workspace-id', 'report-id') as unknown as MutationOptions<
        StrategyGroup[],
        { previous?: StrategyGroup[] }
      >;
      const queryKey = ['report', 'workspace-id', 'strategies', 'report-id'];

      mutation.onError?.(new Error('failed'), strategyGroups, { previous: previousStrategies });

      expect(queryMocks.queryClient.setQueryData).toHaveBeenCalledWith(queryKey, previousStrategies);
      expect(toastMocks.error).toHaveBeenCalledWith('failed');
    });
  });
});
