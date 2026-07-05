'use client';

import { SideDrawer } from '@/components/ui/SideDrawer';
import { cn } from '@/lib/utils';
import {
  YOUTUBE_METADATA_EXPIRED_LABEL,
  getYoutubeDisplayTitle,
  getYoutubeMetadataNotice,
} from '@/lib/youtubeMetadata';
import type { CriticalType } from '@/types/common';
import type { RiskItem } from '@/types/report';
import { REPORT_RISK_LABEL } from './riskMeta';

interface ReportRiskDrawerProps {
  type: CriticalType | null;
  items: RiskItem[];
  onClose: () => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  naver_news: '뉴스',
  naver_blog: '블로그',
  youtube: '유튜브',
  naver_stock: '커뮤니티',
  dcinside: '커뮤니티',
};

const PLATFORM_TONE: Record<string, string> = {
  naver_news: 'bg-blue-50 text-blue-600',
  naver_blog: 'bg-violet-50 text-violet-600',
  youtube: 'bg-red-50 text-red-600',
  naver_stock: 'bg-emerald-50 text-emerald-600',
  dcinside: 'bg-emerald-50 text-emerald-600',
};

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function RiskItemCard({ item }: { item: RiskItem }) {
  const date = formatDate(item.published_at);
  const displayTitle = getYoutubeDisplayTitle(item);
  const metadataNotice = getYoutubeMetadataNotice(item);
  const body = (
    <>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={cn(
            'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10.5px] font-semibold',
            PLATFORM_TONE[item.platform_id] ?? 'bg-slate-100 text-slate-500',
          )}
        >
          {PLATFORM_LABELS[item.platform_id] ?? item.platform_id}
        </span>
        {date && (
          <span className="ml-auto text-[10.5px] text-slate-400 tabular-nums">
            {date}
          </span>
        )}
        {metadataNotice && (
          <span
            className="inline-flex shrink-0 items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-600"
            title={metadataNotice}
          >
            {YOUTUBE_METADATA_EXPIRED_LABEL}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[13px] font-semibold leading-relaxed text-slate-900">
        {displayTitle}
      </p>
      {item.critical_reason && (
        <p className="mt-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-[12px] leading-relaxed text-slate-600">
          {item.critical_reason}
        </p>
      )}
    </>
  );

  if (!item.link || item.link === '#') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
        {body}
      </div>
    );
  }

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-slate-200 bg-white px-3.5 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      {body}
    </a>
  );
}

export function ReportRiskDrawer({ type, items, onClose }: ReportRiskDrawerProps) {
  const typeItems = type
    ? items
        .filter((item) => item.critical_type === type)
        .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
    : [];

  const channelCounts = typeItems.reduce<Record<string, number>>((acc, item) => {
    const label = PLATFORM_LABELS[item.platform_id] ?? item.platform_id;
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  const channelSummary = Object.entries(channelCounts)
    .map(([label, count]) => `${label} ${count}`)
    .join(' · ');

  return (
    <SideDrawer
      open={!!type}
      onClose={onClose}
      title={type ? `${REPORT_RISK_LABEL[type]} 콘텐츠` : ''}
      subtitle={
        type
          ? `전체 ${typeItems.length.toLocaleString()}건${channelSummary ? ` · ${channelSummary}` : ''}`
          : ''
      }
      width={480}
    >
      {!type ? null : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            {typeItems.length === 0 ? (
              <div className="py-10 text-center text-[12px] text-slate-400">
                해당 유형의 리스크 콘텐츠가 없습니다.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {typeItems.map((item) => (
                  <RiskItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </SideDrawer>
  );
}
