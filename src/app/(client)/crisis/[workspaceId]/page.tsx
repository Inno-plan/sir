'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useDeleteRiskReport, useMarkRiskNoticeRead } from '@/hooks/report/useReportMutation';
import { useRiskItemSummary, useRiskItems, useRiskReports } from '@/hooks/report/useReportQuery';
import { useReports, useWorkspaceSubscription } from '@/hooks/workspace/useWorkspaceQuery';
import { createClient } from '@/lib/supabase/client';
import { Loading } from '@/components/ui/Loading';
import { Tooltip } from '@/components/ui/Tooltip';
import { ReportCard } from '@/components/report/ReportCard';
import { ReportCalendarSelector } from '@/components/report/ReportCalendarSelector';
import { RiskTable } from '@/components/report/risk-content/RiskTable';
import { CrisisHeader } from '@/components/crisis/CrisisHeader';
import { CrisisProcessedReports } from '@/components/crisis/CrisisProcessedReports';
import { ReportDisclaimer } from '@/components/report/ReportDisclaimer';
import { openContactPage } from '@/lib/contact';

const TAB_INFO = {
  detection: {
    label: '탐지 내역',
    description:
      '부정적 게시물 중 위험 수위가 높은 게시물을 AI가 분류한 것으로 고객 확인을 거쳐 신고 및 게시물 삭제 등의 후속조치 여부 결정이 필요합니다.',
    tooltip: '뉴스는 공공성을 고려해 수집 대상에서 제외됩니다.',
  },
  reports: {
    label: '처리 결과',
    description: 'SIR 팀에서 진행한 리스크 콘텐츠 삭제, 신고 처리 결과를 확인할 수 있습니다.',
    tooltip:
      '신고된 게시물은 해당 채널 운영자의 판단에 의해 삭제되지 않을 수 있으며, 신고 후 2주가 지나도 삭제되지 않을 경우 자동으로 반려된 것으로 간주합니다.',
  },
} as const;
type Tab = keyof typeof TAB_INFO;

/** sessions 테이블에서 workspace 의 session→report_id 매핑 조회 */
function useSessionToReportMap(workspaceId: string) {
  return useQuery({
    queryKey: ['sessions', 'workspace-report-map', workspaceId],
    queryFn: async () => {
      const { data } = await createClient()
        .from('sessions')
        .select('id, report_id')
        .eq('workspace_id', workspaceId);
      const map = new Map<string, string>();
      for (const s of data ?? []) {
        if (s.report_id) map.set(s.id, s.report_id);
      }
      return map;
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  });
}

export default function CrisisCenterPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const workspaceId = params?.workspaceId as string;

  const { data: subscription, isLoading: subLoading } = useWorkspaceSubscription(workspaceId);
  const hasArmor = subscription?.has_armor ?? false;
  const armorReady = !subLoading && subscription !== undefined;

  const tabParam = searchParams?.get('tab');
  const activeTab: Tab = tabParam === 'reports' ? 'reports' : 'detection';
  const handleTabChange = (tab: Tab) => {
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    next.set('tab', tab);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  // 빈 문자열 = 전체 보고서 통합 뷰 (default). 특정 reportId 선택 시 해당 보고서로 필터.
  const [selectedReportId, setSelectedReportId] = useState('');
  const reportFilter = selectedReportId || undefined;

  const { data: riskItems, isLoading: itemsLoading } = useRiskItems(workspaceId, reportFilter);
  const { data: riskReports, isLoading: reportsLoading } = useRiskReports(
    workspaceId,
    reportFilter
  );
  const { data: riskItemSummary } = useRiskItemSummary(workspaceId);
  const { data: sessionToReportMap } = useSessionToReportMap(workspaceId);
  const { data: reportsList } = useReports(workspaceId);
  const markRiskNoticeRead = useMarkRiskNoticeRead(workspaceId);

  useEffect(() => {
    if (workspaceId && riskItemSummary?.latestRiskAt) {
      markRiskNoticeRead.mutate(riskItemSummary.latestRiskAt);
    }
    // 위기 대응 센터 방문 시 현재 최신 리스크를 확인 완료로 기록.
    // API 내부에서 role='user' 인 client 사용자만 upsert 하므로 admin 방문은 read-state 를 바꾸지 않는다.
  }, [workspaceId, riskItemSummary?.latestRiskAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const reportTypeMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of reportsList ?? []) m.set(r.id, r.type);
    return m;
  }, [reportsList]);
  const deleteMutation = useDeleteRiskReport(workspaceId);

  // detected = AI가 자동 감지만 한 상태라 사용자가 아직 신고 대행을 요청한 것으로 보지 않는다.
  // requested = 사용자가 요청만 한 상태(취소 가능). pending/resolved/rejected = admin 처리 시작 → 취소 불가.
  const { reportedSourceIds, riskReportBySourceId, processedSourceIds } = useMemo(() => {
    const ids = new Set<string>();
    const map = new Map<string, string>();
    const processed = new Set<string>();
    for (const rr of riskReports ?? []) {
      if (rr.status === 'detected') continue;
      ids.add(rr.source_id);
      map.set(rr.source_id, rr.id);
      if (rr.status !== 'requested') processed.add(rr.source_id);
    }
    return { reportedSourceIds: ids, riskReportBySourceId: map, processedSourceIds: processed };
  }, [riskReports]);

  // 리스크 콘텐츠 처리 결과: 신고 등록 이후 모든 단계만 노출.
  // detected 는 관리자 리스크 관리용 자동 감지 상태라 고객의 신고 요청/처리 결과로 보지 않는다.
  // (requested 요청 완료 / pending 삭제 처리 중 / resolved 삭제 완료 / rejected 삭제 불가)
  const processedReports = useMemo(() => {
    return (riskReports ?? [])
      .filter((rr) => rr.status !== 'detected')
      .slice()
      .sort((a, b) =>
        (b.resolved_at ?? b.requested_at ?? '').localeCompare(a.resolved_at ?? a.requested_at ?? '')
      );
  }, [riskReports]);

  const loading = itemsLoading || reportsLoading;

  return (
    <div className="bg-white">
      <div className="mx-auto w-full max-w-[1240px] px-4 lg:px-10 py-6 lg:py-10 flex flex-col gap-6">
        <CrisisHeader />

        {/* 탭 + 기간 필터 — 콘텐츠 컨트롤 한 줄 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200">
          <div className="flex">
            {(['detection', 'reports'] as Tab[]).map((t) => {
              const active = activeTab === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTabChange(t)}
                  className={`px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                    active
                      ? 'border-text-accent text-text-dark'
                      : 'border-transparent text-text-muted hover:text-text-dark'
                  }`}
                >
                  {TAB_INFO[t].label}
                </button>
              );
            })}
          </div>
          <div className="pb-2">
            <ReportCalendarSelector
              workspaceId={workspaceId}
              selectedReportId={selectedReportId}
              onChange={setSelectedReportId}
              placeholder="기간별 리스크 콘텐츠 확인"
              accent
            />
          </div>
        </div>

        {/* 탭 설명 */}
        <div className="flex items-center gap-1.5 -mt-2">
          <p className="text-xs lg:text-sm text-text-muted leading-relaxed">
            {TAB_INFO[activeTab].description}
          </p>
          <Tooltip text={TAB_INFO[activeTab].tooltip} />
        </div>

        {!armorReady || loading ? (
          <Loading />
        ) : activeTab === 'detection' ? (
          <ReportCard px={20} py={10}>
            <RiskTable
              riskItems={riskItems ?? []}
              workspaceId={workspaceId}
              reportId={selectedReportId}
              reportedSourceIds={reportedSourceIds}
              riskReportBySourceId={riskReportBySourceId}
              processedSourceIds={processedSourceIds}
              onCancelReport={deleteMutation.mutate}
              allowReport={hasArmor}
              sessionToReportMap={sessionToReportMap ?? undefined}
              reportTypeMap={reportTypeMap}
            />
          </ReportCard>
        ) : (
          <CrisisProcessedReports
            reports={processedReports}
            hasArmor={hasArmor}
            onUpgradeClick={openContactPage}
          />
        )}

        <ReportDisclaimer />
      </div>
    </div>
  );
}
