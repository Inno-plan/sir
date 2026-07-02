import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMarkRiskNoticeRead } from '@/hooks/report/useReportMutation';
import { markRiskNoticeRead } from '@/lib/api/reportApi';

const queryMocks = vi.hoisted(() => {
  const queryClient = {
    invalidateQueries: vi.fn(),
  };
  const useMutation = vi.fn((options) => options);
  const useQueryClient = vi.fn(() => queryClient);

  return {
    queryClient,
    useMutation,
    useQueryClient,
  };
});

vi.mock('@tanstack/react-query', () => ({
  useMutation: queryMocks.useMutation,
  useQueryClient: queryMocks.useQueryClient,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
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

describe('useMarkRiskNoticeRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the supplied latest risk timestamp for the workspace', async () => {
    const mutation = useMarkRiskNoticeRead('workspace-id') as unknown as {
      mutationFn: (latestRiskAt: string) => Promise<void>;
    };

    await mutation.mutationFn('2026-07-02T00:00:00.000Z');

    expect(markRiskNoticeRead).toHaveBeenCalledWith(
      'workspace-id',
      '2026-07-02T00:00:00.000Z',
    );
  });

  it('invalidates the workspace risk notice read query on success', () => {
    const mutation = useMarkRiskNoticeRead('workspace-id') as unknown as {
      onSuccess: () => void;
    };

    mutation.onSuccess();

    expect(queryMocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['report', 'workspace-id', 'riskNoticeRead'],
    });
  });
});
