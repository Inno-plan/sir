'use client';

import { useResolvedRiskReportsSuspense } from '@/hooks/report/useReportQuery';
import { ReportSubSection } from '@/components/report/ReportSection';
import { ReportCard } from '@/components/report/ReportCard';
import { EmptyState } from '@/components/ui/EmptyState';

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  resolved: { label: '삭제 완료', className: 'bg-blue-50 text-blue-600' },
  rejected: { label: '삭제 불가', className: 'bg-red-50 text-red-600' },
};

const PLATFORM_LABELS: Record<string, string> = {
  naver_blog: '블로그',
  youtube: '유튜브',
  naver_stock: '종토방',
  dcinside: '디시인사이드',
};

const COL_TEMPLATE = '12% 10% 10% 1fr 12%';

interface RiskResultTableProps {
  workspaceId: string;
  periodStart: string;
  periodEnd: string;
  isDaily?: boolean;
  reportType?: string | null;
}

export function RiskResultTable({ workspaceId, periodStart, periodEnd, isDaily = false, reportType }: RiskResultTableProps) {
  const { data: reports } = useResolvedRiskReportsSuspense(workspaceId, periodStart, periodEnd);

  const periodPhrase =
    reportType === 'daily' || isDaily ? '오늘'
    : reportType === 'initial' ? '이번 달'
    : '이번 주';
  const description = `${periodPhrase} SIR 팀에서 진행한 리스크 콘텐츠 삭제, 신고 처리 결과를 확인할 수 있습니다.`;
  const emptyMessage = `${periodPhrase} 처리된 내역이 없습니다.`;

  return (
    <ReportSubSection
      title="리스크 콘텐츠 처리 결과"
      description={description}
      tooltip="신고된 게시물은 해당 채널 운영자의 판단에 의해 삭제되지 않을 수 있으며, 신고 후 2주가 지나도 삭제되지 않을 경우 자동으로 반려된 것으로 간주합니다."
    >
      <ReportCard px={20} py={10}>
        {reports.length === 0 ? (
          <>
            <EmptyState message={emptyMessage} />
            <p className="text-xs text-text-muted text-center py-2">총 0건</p>
          </>
        ) : (
          <>
            {/* 데스크톱: grid 테이블 */}
            <div className="hidden lg:block">
              <div
                className="grid border-b border-border-light py-3 px-3 text-xs font-semibold text-text-muted text-center"
                style={{ gridTemplateColumns: COL_TEMPLATE }}
              >
                <div>신고일</div>
                <div>채널명</div>
                <div>유형</div>
                <div>신고 게시물</div>
                <div>처리 결과</div>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {reports.map((rr) => {
                  const statusCfg = STATUS_STYLES[rr.status] ?? { label: rr.status, className: 'bg-slate-100 text-slate-600' };
                  return (
                    <div
                      key={rr.id}
                      className="grid items-center py-4 px-3 border-b border-border-light"
                      style={{ gridTemplateColumns: COL_TEMPLATE }}
                    >
                      <div className="text-center text-xs text-text-muted">
                        {rr.requested_at?.slice(0, 10).replace(/-/g, '.') ?? ''}
                      </div>
                      <div className="text-center text-xs text-text-muted">
                        {PLATFORM_LABELS[rr.platform_id] ?? rr.platform_id}
                      </div>
                      <div className="text-center text-xs text-text-muted">{rr.reason}</div>
                      <div className="px-3">
                        <a href={rr.link} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-text-dark hover:text-blue-600 hover:underline transition-colors">
                          {rr.title}
                        </a>
                      </div>
                      <div className="text-center">
                        <span className={`inline-block text-xs font-semibold px-3 py-1.5 rounded-lg ${statusCfg.className}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 모바일: 카드 리스트 */}
            <div className="lg:hidden flex flex-col gap-3 py-3 max-h-[400px] overflow-y-auto">
              {reports.map((rr) => {
                const statusCfg = STATUS_STYLES[rr.status] ?? { label: rr.status, className: 'bg-slate-100 text-slate-600' };
                return (
                  <div key={rr.id} className="border border-border-light rounded-xl p-4 flex flex-col gap-2.5">
                    <div className="flex gap-2">
                      <span className="w-14 shrink-0 text-sm text-text-mobile-muted pt-0.5">신고일</span>
                      <span className="text-sm text-text-dark">
                        {rr.requested_at?.slice(0, 10).replace(/-/g, '.') ?? '-'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-14 shrink-0 text-sm text-text-mobile-muted pt-0.5">채널명</span>
                      <span className="text-sm text-text-dark">
                        {PLATFORM_LABELS[rr.platform_id] ?? rr.platform_id}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-14 shrink-0 text-sm text-text-mobile-muted pt-0.5">유형</span>
                      <span className="text-sm text-text-dark">{rr.reason}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-14 shrink-0 text-sm text-text-mobile-muted pt-0.5">게시물</span>
                      <a href={rr.link} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-text-dark hover:text-blue-600 hover:underline transition-colors flex-1 min-w-0">
                        {rr.title}
                      </a>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-14 shrink-0 text-sm text-text-mobile-muted pt-0.5">처리 결과</span>
                      <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-lg ${statusCfg.className}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-text-muted text-center py-2">총 {reports.length}건</p>
          </>
        )}
      </ReportCard>
      <p className="text-xs text-text-muted mt-3 leading-relaxed">
        공휴일에는 신고 처리가 불가합니다. 공휴일에 신고를 요청하시는 경우, 공휴일 다음 영업일부터 순차적으로 신고 처리를 진행합니다.
      </p>
    </ReportSubSection>
  );
}
