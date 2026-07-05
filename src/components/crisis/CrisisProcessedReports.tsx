'use client';

import { ShieldAlert, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReportCard } from '@/components/report/ReportCard';
import type { RiskReport } from '@/types/report';
import {
  YOUTUBE_METADATA_EXPIRED_LABEL,
  getYoutubeDisplayTitle,
  getYoutubeMetadataNotice,
} from '@/lib/youtubeMetadata';

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  requested: { label: '요청 완료', className: 'bg-slate-100 text-slate-600' },
  pending: { label: '삭제 처리 중', className: 'bg-amber-50 text-amber-600' },
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

interface CrisisProcessedReportsProps {
  /** resolved/rejected 만 추려낸 처리 결과 리스트 */
  reports: RiskReport[];
  hasArmor: boolean;
  onUpgradeClick: () => void;
}

export function CrisisProcessedReports({
  reports,
  hasArmor,
  onUpgradeClick,
}: CrisisProcessedReportsProps) {
  return (
    <div>
      <ReportCard px={20} py={!hasArmor ? 32 : 10}>
        {!hasArmor ? (
          <div className="flex items-center justify-center py-10">
            <UpgradePrompt onClick={onUpgradeClick} />
          </div>
        ) : reports.length === 0 ? (
          <>
            <div className="flex items-center justify-center py-10">
              <EmptyState message="처리된 내역이 없습니다." />
            </div>
            <p className="text-xs text-text-muted text-center py-2">총 0건</p>
          </>
        ) : (
          <>
            <DesktopTable reports={reports} />
            <MobileList reports={reports} />
            <p className="text-xs text-text-muted text-center py-2">
              총 {reports.length}건
            </p>
          </>
        )}
      </ReportCard>
      <p className="text-xs text-text-muted mt-3 leading-relaxed">
        공휴일에는 신고 처리가 불가합니다. 공휴일에 신고를 요청하시는 경우, 공휴일 다음 영업일부터 순차적으로 신고 처리를 진행합니다.
      </p>
    </div>
  );
}

function UpgradePrompt({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
      <ShieldAlert size={32} className="text-bg-accent" />
      <p className="text-base font-semibold text-text-dark">서비스 업그레이드가 필요합니다</p>
      <p className="text-sm text-text-muted leading-relaxed">
        신고 대행(아머)은 별도 구독이 필요한 서비스입니다.
      </p>
      <Button variant="outlineAccent" size="lg" onClick={onClick} className="mt-2">
        서비스 신청하기
      </Button>
    </div>
  );
}

function DesktopTable({ reports }: { reports: RiskReport[] }) {
  return (
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
      <div className="max-h-[600px] overflow-y-auto">
        {reports.map((rr) => {
          const statusCfg = STATUS_STYLES[rr.status] ?? { label: rr.status, className: 'bg-slate-100 text-slate-600' };
          const displayTitle = getYoutubeDisplayTitle(rr);
          const metadataNotice = getYoutubeMetadataNotice(rr);
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
              <div className="px-3 flex items-center gap-2 min-w-0">
                <a
                  href={rr.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-text-dark hover:text-blue-600 hover:underline transition-colors truncate"
                >
                  {displayTitle}
                </a>
                {metadataNotice && (
                  <span
                    className="text-[10px] font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 shrink-0"
                    title={metadataNotice}
                  >
                    {YOUTUBE_METADATA_EXPIRED_LABEL}
                  </span>
                )}
                {rr.file_urls?.length > 0 && (
                  <span className="flex items-center gap-0.5 text-slate-400 shrink-0">
                    <Paperclip size={12} />
                    <span className="text-[10px]">{rr.file_urls.length}</span>
                  </span>
                )}
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
  );
}

function MobileList({ reports }: { reports: RiskReport[] }) {
  return (
    <div className="lg:hidden flex flex-col gap-3 py-3 max-h-[400px] overflow-y-auto">
      {reports.map((rr) => {
        const statusCfg = STATUS_STYLES[rr.status] ?? { label: rr.status, className: 'bg-slate-100 text-slate-600' };
        const displayTitle = getYoutubeDisplayTitle(rr);
        const metadataNotice = getYoutubeMetadataNotice(rr);
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
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <a
                  href={rr.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-text-dark hover:text-blue-600 hover:underline transition-colors"
                >
                  {displayTitle}
                </a>
                {metadataNotice && (
                  <span
                    className="w-fit text-[10px] font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5"
                    title={metadataNotice}
                  >
                    {YOUTUBE_METADATA_EXPIRED_LABEL}
                  </span>
                )}
              </div>
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
  );
}
