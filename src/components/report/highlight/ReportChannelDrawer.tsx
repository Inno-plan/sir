'use client';

import { useMemo, useState } from 'react';
import { SideDrawer } from '@/components/ui/SideDrawer';
import { cn } from '@/lib/utils';
import {
  YOUTUBE_METADATA_EXPIRED_LABEL,
  getYoutubeDisplayTitle,
  getYoutubeMetadataNotice,
} from '@/lib/youtubeMetadata';
import type { ChannelItem } from '@/types/report';
import {
  PLATFORM_TO_REPORT_CHANNEL,
  REPORT_CHANNEL_LABEL,
  type ReportChannel,
} from './channelMeta';

type SentimentKey = 'all' | 'positive' | 'neutral' | 'negative';

interface ReportChannelDrawerProps {
  channel: ReportChannel | null;
  items: ChannelItem[];
  onClose: () => void;
}

const SENTIMENT_TABS: { id: SentimentKey; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'positive', label: '긍정' },
  { id: 'neutral', label: '중립' },
  { id: 'negative', label: '부정' },
];

function normalizeSentiment(sentiment?: string | null): Exclude<SentimentKey, 'all'> {
  if (sentiment === 'positive' || sentiment === 'negative') return sentiment;
  return 'neutral';
}

function getSentimentLabel(sentiment: string) {
  const normalized = normalizeSentiment(sentiment);
  if (normalized === 'positive') return '긍정';
  if (normalized === 'negative') return '부정';
  return '중립';
}

function getSentimentClass(sentiment: string) {
  const normalized = normalizeSentiment(sentiment);
  if (normalized === 'positive') return 'bg-emerald-50 text-emerald-600';
  if (normalized === 'negative') return 'bg-red-50 text-red-600';
  return 'bg-slate-100 text-slate-500';
}

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

function sortChannelItems(items: ChannelItem[], channel: ReportChannel) {
  return [...items].sort((a, b) => {
    if (channel === 'blog') {
      const av = a.impact_score ?? 0;
      const bv = b.impact_score ?? 0;
      if (av !== bv) return bv - av;
    }
    if (channel === 'youtube' || channel === 'community') {
      const av = a.views ?? 0;
      const bv = b.views ?? 0;
      if (av !== bv) return bv - av;
    }
    return (b.published_at ?? '').localeCompare(a.published_at ?? '');
  });
}

function SentimentTabBar({
  value,
  onChange,
  counts,
}: {
  value: SentimentKey;
  onChange: (value: SentimentKey) => void;
  counts: Record<SentimentKey, number>;
}) {
  return (
    <div className="flex items-center gap-1 px-5 pt-3 shrink-0">
      {SENTIMENT_TABS.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer',
              active
                ? 'bg-slate-100 border-slate-200 text-slate-900'
                : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700',
            )}
          >
            {tab.label} <span className="tabular-nums">{counts[tab.id]}</span>
          </button>
        );
      })}
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10.5px] font-semibold',
        getSentimentClass(sentiment),
      )}
    >
      {getSentimentLabel(sentiment)}
    </span>
  );
}

function ItemMeta({ item, channel }: { item: ChannelItem; channel: ReportChannel }) {
  const date = formatDate(item.published_at);

  return (
    <div className="mt-2 flex items-center gap-2 text-[10.5px] text-slate-400">
      {date && <span className="shrink-0 tabular-nums">{date}</span>}
      {channel === 'blog' && item.impact_score != null && (
        <span className="shrink-0 tabular-nums">영향력 {item.impact_score.toFixed(1)}</span>
      )}
      {(channel === 'youtube' || channel === 'community') && item.views != null && (
        <span className="shrink-0 tabular-nums">조회 {item.views.toLocaleString()}</span>
      )}
      {item.source && (
        <span className="ml-auto min-w-0 truncate text-right">{item.source}</span>
      )}
    </div>
  );
}

function ItemCard({ item, channel }: { item: ChannelItem; channel: ReportChannel }) {
  const description = item.summary ?? item.content;
  const displayTitle = getYoutubeDisplayTitle(item);
  const metadataNotice = getYoutubeMetadataNotice(item);
  const body = (
    <>
      <div className="flex items-center gap-1.5">
        <SentimentBadge sentiment={item.sentiment} />
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
      {description && (
        <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-slate-500">
          {description}
        </p>
      )}
      <ItemMeta item={item} channel={channel} />
    </>
  );

  if (!item.link) {
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

export function ReportChannelDrawer({ channel, items, onClose }: ReportChannelDrawerProps) {
  const [sentimentState, setSentimentState] = useState<{
    channel: ReportChannel | null;
    value: SentimentKey;
  }>({ channel: null, value: 'all' });
  const sentimentTab = sentimentState.channel === channel ? sentimentState.value : 'all';
  const setSentimentTab = (value: SentimentKey) => {
    setSentimentState({ channel, value });
  };

  const channelItems = useMemo(() => {
    if (!channel) return [];
    return items.filter((item) => PLATFORM_TO_REPORT_CHANNEL[item.platform_id] === channel);
  }, [channel, items]);

  const sentimentCounts: Record<SentimentKey, number> = useMemo(() => {
    const counts: Record<SentimentKey, number> = {
      all: channelItems.length,
      positive: 0,
      neutral: 0,
      negative: 0,
    };
    for (const item of channelItems) {
      counts[normalizeSentiment(item.sentiment)] += 1;
    }
    return counts;
  }, [channelItems]);

  const visibleItems = useMemo(() => {
    if (!channel) return [];
    const filtered =
      sentimentTab === 'all'
        ? channelItems
        : channelItems.filter((item) => normalizeSentiment(item.sentiment) === sentimentTab);
    return sortChannelItems(filtered, channel);
  }, [channel, channelItems, sentimentTab]);

  const title = channel ? `${REPORT_CHANNEL_LABEL[channel]} 데이터` : '';
  const subtitle = channel
    ? `전체 ${sentimentCounts.all.toLocaleString()}건 · 긍정 ${sentimentCounts.positive} · 중립 ${sentimentCounts.neutral} · 부정 ${sentimentCounts.negative}`
    : '';

  return (
    <SideDrawer
      open={!!channel}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      width={480}
    >
      {!channel ? null : (
        <>
          <SentimentTabBar
            value={sentimentTab}
            onChange={setSentimentTab}
            counts={sentimentCounts}
          />

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            {visibleItems.length === 0 ? (
              <div className="py-10 text-center text-[12px] text-slate-400">
                해당 조건의 데이터가 없습니다.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {visibleItems.map((item) => (
                  <ItemCard key={item.id} item={item} channel={channel} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </SideDrawer>
  );
}
