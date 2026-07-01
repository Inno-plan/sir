'use client';

import { useMemo } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useRiskItemsSuspense, useRiskReportsSuspense, useReportInfoSuspense, useChannelItemsSuspense } from '@/hooks/report/useReportQuery';
import { useDeleteRiskReport } from '@/hooks/report/useReportMutation';
import { useWorkspaceSubscription } from '@/hooks/workspace/useWorkspaceQuery';
import { ReportSection } from '@/components/report/ReportSection';
import { ReportCard } from '@/components/report/ReportCard';
import { Button } from '@/components/ui/Button';
import { RiskDetectionTable } from '@/components/report/risk-content/RiskDetectionTable';
import { RiskResultTable } from '@/components/report/risk-content/RiskResultTable';
import { LiskContentIcon } from '@/components/icons/LiskContentIcon';
import { openContactPage } from '@/lib/contact';

interface RiskContentProps {
  workspaceId: string;
  reportId: string;
  editable?: boolean;
  /** 신고 대행 요청 버튼 노출 여부. 보고서 내부에선 false, 위기 대응 센터에선 true */
  allowReport?: boolean;
  pdfMode?: boolean;
}

export function RiskContent({ workspaceId, reportId, editable = false, allowReport = false, pdfMode = false }: RiskContentProps) {
  const { data: report } = useReportInfoSuspense(workspaceId, reportId);
  const { data: riskItems } = useRiskItemsSuspense(workspaceId, reportId);
  const { data: riskReports } = useRiskReportsSuspense(workspaceId, reportId);
  const { data: channelItems } = useChannelItemsSuspense(workspaceId, reportId);
  const { data: subscription } = useWorkspaceSubscription(workspaceId);
  const deleteMutation = useDeleteRiskReport(workspaceId);

  // 그 기간 수집된 콘텐츠가 0건이면 "리스크 0건" vs "데이터 부족" 의미 혼동.
  // 0건이면 분석 불가 안내, 그 외엔 RiskDetectionTable 의 기존 empty state ("리스크 없음") 유지.
  const isNoData = channelItems.length === 0;

  const { reportedSourceIds, riskReportBySourceId, processedSourceIds } = useMemo(() => {
    const ids = new Set<string>();
    const map = new Map<string, string>();
    const processed = new Set<string>();
    for (const rr of riskReports) {
      // detected 는 관리자 리스크 관리용 자동 감지 상태이며,
      // 사용자가 신고 대행을 요청한 상태로 보지 않는다.
      if (rr.status === 'detected') continue;
      ids.add(rr.source_id);
      map.set(rr.source_id, rr.id);
      if (rr.status !== 'requested') processed.add(rr.source_id);
    }
    return { reportedSourceIds: ids, riskReportBySourceId: map, processedSourceIds: processed };
  }, [riskReports]);

  const isDaily = report?.type === 'daily';
  // has_armor=false 워크스페이스는 신고 대행 자체가 차단 (RLS + UI)
  const hasArmor = subscription?.has_armor ?? false;
  // 보고서 페이지는 단순 확인용 — 신고는 위기 대응 센터에서만 진행 (allowReport default false)
  const effectiveAllowReport = allowReport && hasArmor;

  return (
    <div className="print-break">
      <ReportSection id="section-risk" icon={<LiskContentIcon size={36} />} title="리스크 콘텐츠 관리">
        <div className="print-keep">
          {isNoData ? (
            <ReportCard px={20} py={32}>
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <span className="text-sm font-semibold text-text-muted">이번 기간 수집된 데이터가 없습니다.</span>
                <span className="text-xs text-text-muted">분석할 콘텐츠가 없어 리스크 탐지가 보류됩니다.</span>
              </div>
            </ReportCard>
          ) : (
            <RiskDetectionTable
              riskItems={riskItems}
              workspaceId={workspaceId}
              reportId={reportId}
              reportedSourceIds={reportedSourceIds}
              riskReportBySourceId={riskReportBySourceId}
              processedSourceIds={processedSourceIds}
              onCancelReport={deleteMutation.mutate}
              editable={editable}
              allowReport={effectiveAllowReport}
              pdfMode={pdfMode}
            />
          )}
        </div>
        {!hasArmor ? (
          <div className="print-keep flex flex-col gap-3">
            <h3 className="text-base font-bold text-text-accent">리스크 콘텐츠 처리 결과</h3>
            <ReportCard px={20} py={32}>
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                <ShieldAlert size={32} className="text-bg-accent" />
                <p className="text-base font-semibold text-text-dark">
                  서비스 업그레이드가 필요합니다
                </p>
                <p className="text-sm text-text-muted leading-relaxed">
                  신고 대행(아머)은 별도 구독이 필요한 서비스입니다.
                </p>
                {!pdfMode && (
                  <Button
                    variant="outlineAccent"
                    size="lg"
                    onClick={openContactPage}
                    className="mt-2"
                  >
                    서비스 신청하기
                  </Button>
                )}
              </div>
            </ReportCard>
          </div>
        ) : (
          report?.period_start && report?.period_end && (
            <div className="print-keep">
              <RiskResultTable
                workspaceId={workspaceId}
                periodStart={report.period_start}
                periodEnd={report.period_end}
                isDaily={isDaily}
                reportType={report.type}
              />
            </div>
          )
        )}
      </ReportSection>
    </div>
  );
}
