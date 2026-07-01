import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  upsertWeeklySummary,
  updateStrategies,
  clearCriticalType,
  deleteRiskReport,
  submitRiskReport,
  publishReport,
  createReport,
  updateRiskReport,
  markRiskNoticeRead,
} from '@/lib/api/reportApi';
import { reportKeys } from '@/hooks/report/useReportQuery';
import { workspaceKeys } from '@/hooks/workspace/workspaceKeys';
import { getErrorMessage } from '@/lib/utils';
import type {
  SummarySection,
  StrategyGroup,
  RiskItem,
  SubmitRiskReportInput,
  CreatedReport,
} from '@/lib/api/reportApi';

// ── 주간 총평 수정 ──

export function useUpdateSummary(workspaceId: string, reportId: string) {
  const queryClient = useQueryClient();
  const queryKey = [...reportKeys.summary(workspaceId), reportId];

  return useMutation({
    mutationFn: (sections: SummarySection[]) =>
      upsertWeeklySummary(workspaceId, reportId, sections),
    onMutate: async (sections) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SummarySection[]>(queryKey);
      queryClient.setQueryData(queryKey, sections);
      return { previous };
    },
    onError: (err, _sections, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error(getErrorMessage(err, '총평 수정에 실패했습니다.'));
    },
    onSuccess: () => {
      toast.success('총평 수정에 성공했습니다.');
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey });
    },
  });
}

// ── 보고서 생성 (관리자) ──

export function useCreateReport(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation<CreatedReport, Error, void>({
    mutationFn: () => createReport(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.reports(workspaceId) });
    },
  });
}

// ── 보고서 발행 (관리자) ──

export function usePublishReport(reportId: string, workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => publishReport(reportId),
    onSuccess: () => {
      // 보고서 자체 (status published)
      queryClient.refetchQueries({ queryKey: reportKeys.info(workspaceId, reportId) });
      // workspace 단위 query — 보고서 목록 / progress / sir_score 갱신.
      // 발행 시 update_workspace_sir 로 workspaces.sir_score 도 바뀌므로 detail 도 invalidate.
      queryClient.invalidateQueries({ queryKey: workspaceKeys.reports(workspaceId) });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.progress(workspaceId) });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) });
      toast.success('보고서가 발행되었습니다.');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, '발행에 실패했습니다.'));
    },
  });
}

// ── 리스크 해제 (관리자) ──

export function useClearCriticalType(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (item: RiskItem) => clearCriticalType(item.platform_id, item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportKeys.riskItems(workspaceId) });
      queryClient.invalidateQueries({ queryKey: reportKeys.riskItemSummary(workspaceId) });
      toast.success('리스크 분류를 해제했습니다.');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, '리스크 해제에 실패했습니다.'));
    },
  });
}

// ── 클라이언트 리스크 NEW 확인 상태 ──

export function useMarkRiskNoticeRead(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (latestRiskAt: string) => markRiskNoticeRead(workspaceId, latestRiskAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportKeys.riskNoticeRead(workspaceId) });
    },
  });
}

// ── 신고 대행 취소 ──

export function useDeleteRiskReport(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (riskReportId: string) => deleteRiskReport(riskReportId),
    onSuccess: () => {
      // riskReports 는 caller 마다 reportId(undefined/''/특정id) 가 달라 prefix 로 일괄 invalidate.
      queryClient.invalidateQueries({ queryKey: reportKeys.riskReportsAll(workspaceId) });
      toast.success('신고가 취소되었습니다.');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, '신고 대행 취소에 실패했습니다.'));
    },
  });
}

// ── 신고 처리 상태 변경 (관리자) ──

interface UpdateRiskReportInput {
  id: string;
  body: { status?: string; admin_note?: string };
}

/** admin 의 status/메모 변경. workspace 단위 riskReports 캐시 + admin '_all' 모드 캐시 +
 *  보고서 결과 섹션의 resolved 캐시까지 일괄 invalidate. */
export function useUpdateRiskReport(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: UpdateRiskReportInput) => updateRiskReport(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportKeys.riskReportsAll(workspaceId) });
      queryClient.invalidateQueries({ queryKey: reportKeys.riskReportsAll('_all') });
      queryClient.invalidateQueries({ queryKey: reportKeys.resolvedRiskReportsAll(workspaceId) });
    },
  });
}

// ── 신고 대행 요청 ──

export function useSubmitRiskReport(workspaceId: string, reportId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<SubmitRiskReportInput, 'workspaceId' | 'reportId'>) =>
      submitRiskReport({ ...input, workspaceId, reportId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportKeys.riskReportsAll(workspaceId) });
      queryClient.invalidateQueries({ queryKey: reportKeys.riskReportsAll('_all') });
      toast.success('신고 대행 요청이 접수되었습니다.');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, '신고 요청에 실패했습니다.'));
    },
  });
}

// ── 대응 전략 수정 ──

export function useUpdateStrategies(workspaceId: string, reportId: string) {
  const queryClient = useQueryClient();
  const queryKey = [...reportKeys.strategies(workspaceId), reportId];

  return useMutation({
    mutationFn: (strategies: StrategyGroup[]) =>
      updateStrategies(workspaceId, reportId, strategies),
    onMutate: async (strategies) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<StrategyGroup[]>(queryKey);
      queryClient.setQueryData(queryKey, strategies);
      return { previous };
    },
    onError: (err, _strategies, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error(getErrorMessage(err, '전략 수정에 실패했습니다.'));
    },
    onSuccess: () => {
      toast.success('전략 수정에 성공했습니다.');
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey });
    },
  });
}
