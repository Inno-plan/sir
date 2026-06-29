'use client';

import { useStrategiesSuspense, useWorkspaceSirSuspense, useReportInfoSuspense } from '@/hooks/report/useReportQuery';
import { ReportSection, ReportSubSection } from '@/components/report/ReportSection';
import { StrategyCard } from '@/components/report/strategy/StrategyCard';
import { EditableStrategy } from '@/components/report/strategy/EditableStrategy';
import { EmptyState } from '@/components/ui/EmptyState';
import { StrategyIcon } from '@/components/icons/StrategyIcon';
import { strategyPeriodPhrase } from '@/components/report/strategy/strategyPeriod';

interface StrategyProps {
  workspaceId: string;
  reportId: string;
  editable?: boolean;
  pdfMode?: boolean;
}

export function Strategy({ workspaceId, reportId, editable = false, pdfMode = false }: StrategyProps) {
  const { data: strategies } = useStrategiesSuspense(workspaceId, reportId);
  const { data: workspace } = useWorkspaceSirSuspense(workspaceId);
  const { data: report } = useReportInfoSuspense(workspaceId, reportId);
  const sectionTitle = `${workspace?.company_name ?? ''} 평판 제고 전략 제안`.trim();
  const periodPhrase = strategyPeriodPhrase(report?.type);
  const channelDesc = `${periodPhrase} 평판 분석 결과를 바탕으로, 각 채널별 긍정 여론 확산 및 부정 여론 완화를 위한 실행 전략을 제안합니다.`;

  if (editable) {
    return (
      <div className="print-break">
        <ReportSection id="section-strategy" icon={<StrategyIcon size={36} />} title={sectionTitle}>
          <EditableStrategy
            strategies={strategies}
            workspaceId={workspaceId}
            reportId={reportId}
            channelDesc={channelDesc}
          />
        </ReportSection>
      </div>
    );
  }

  return (
    <div className="print-break">
      <ReportSection id="section-strategy" icon={<StrategyIcon size={36} />} title={sectionTitle}>
        <ReportSubSection title="채널별 대응 전략" description={channelDesc}>
          {strategies.length > 0 ? (
            <div className="flex flex-col gap-4">
              {strategies.map((s) => (
                <div key={s.category} className="print-keep">
                  <StrategyCard category={s.category} label={s.label} strategy={s.strategy} pdfMode={pdfMode} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message={"전략 데이터가 없습니다.\n전략 생성을 실행해주세요."} />
          )}
        </ReportSubSection>
      </ReportSection>
    </div>
  );
}
