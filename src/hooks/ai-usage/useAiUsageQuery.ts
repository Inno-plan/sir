import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addAiUsageCredit,
  getAiUsageCredit,
  getAiUsageSummary,
  getAiUsageWorkspaceDetail,
  type AiUsageRangeParams,
} from '@/lib/api/aiUsageApi';

export const aiUsageKeys = {
  all: ['admin', 'ai-usage'] as const,
  summary: (range: AiUsageRangeParams) => ['admin', 'ai-usage', 'summary', range] as const,
  workspace: (workspaceId: string | null, range: AiUsageRangeParams) =>
    ['admin', 'ai-usage', 'workspace', workspaceId, range] as const,
  credit: () => ['admin', 'ai-usage', 'credit'] as const,
};

export function useAiUsageSummary(range: AiUsageRangeParams) {
  return useQuery({
    queryKey: aiUsageKeys.summary(range),
    queryFn: () => getAiUsageSummary(range),
  });
}

export function useAiUsageWorkspaceDetail(
  workspaceId: string | null,
  range: AiUsageRangeParams,
) {
  return useQuery({
    queryKey: aiUsageKeys.workspace(workspaceId, range),
    queryFn: () => {
      if (!workspaceId) throw new Error('workspaceId is required');
      return getAiUsageWorkspaceDetail(workspaceId, range);
    },
    enabled: !!workspaceId,
  });
}

export function useAiUsageCredit() {
  return useQuery({
    queryKey: aiUsageKeys.credit(),
    queryFn: getAiUsageCredit,
  });
}

export function useAddAiUsageCredit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addAiUsageCredit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiUsageKeys.all });
    },
  });
}
