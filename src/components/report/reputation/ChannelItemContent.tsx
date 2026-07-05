'use client';
'use no memo';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { SentimentIcon, SentimentBadge } from '@/components/report/reputation/SentimentIcon';
import { SentimentFilter } from '@/components/report/reputation/SentimentFilter';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ChannelItem } from '@/lib/api/reportApi';
import {
  YOUTUBE_METADATA_EXPIRED_LABEL,
  getYoutubeDisplayTitle,
  getYoutubeMetadataNotice,
} from '@/lib/youtubeMetadata';

const CHANNEL_SORT: Record<string, (a: ChannelItem, b: ChannelItem) => number> = {
  블로그: (a, b) => (b.impact_score ?? 0) - (a.impact_score ?? 0),
  유튜브: (a, b) => (b.views ?? 0) - (a.views ?? 0),
  커뮤니티: (a, b) => (b.views ?? 0) - (a.views ?? 0),
};

interface ChannelItemContentProps {
  name: string;
  items: ChannelItem[];
}

function formatMeta(name: string, item: ChannelItem): string | null {
  if (item.platform_id === 'youtube' && item.metadata_purged_at) {
    return null;
  }
  if (name === '블로그' && item.impact_score != null) {
    return `영향력 ${item.impact_score.toFixed(1)}`;
  }
  if ((name === '유튜브' || name === '커뮤니티') && item.views != null) {
    return `조회수 ${item.views.toLocaleString()}`;
  }
  return null;
}

export function ChannelItemContent({ name, items }: ChannelItemContentProps) {
  const [filter, setFilter] = useState<string>('all');
  const parentRef = useRef<HTMLDivElement>(null);

  const showSource = name !== '블로그' && name !== '유튜브';
  const showBody = true;
  const sortFn = CHANNEL_SORT[name];
  const sorted = sortFn ? [...items].sort(sortFn) : items;
  const filtered = filter === 'all' ? sorted : sorted.filter((i) => i.sentiment === filter);

  const counts = {
    all: sorted.length,
    positive: sorted.filter((i) => i.sentiment === 'positive').length,
    neutral: sorted.filter((i) => i.sentiment === 'neutral').length,
    negative: sorted.filter((i) => i.sentiment === 'negative').length,
  };

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  // 필터 변경 시 스크롤 상단으로
  useEffect(() => {
    rowVirtualizer.scrollToOffset(0, { behavior: 'smooth' });
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const emptyMessage = useMemo(() => {
    return `${{ all: '수집된', positive: '긍정', neutral: '중립', negative: '부정' }[filter] ?? '수집된'} 데이터가 없습니다.`;
  }, [filter]);

  return (
    <>
      <SentimentFilter value={filter} onChange={setFilter} counts={counts} />
      {filtered.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div ref={parentRef} className="max-h-[600px] overflow-y-auto">
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = filtered[virtualRow.index];
              const meta = formatMeta(name, item);
              const displayTitle = getYoutubeDisplayTitle(item);
              const metadataNotice = getYoutubeMetadataNotice(item);
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="border-b border-border-light pr-1 lg:pr-4"
                >
                  <div className={`flex gap-2 py-4 ${showBody ? '' : 'items-center'}`}>
                    <div className="hidden lg:block">
                      <SentimentIcon sentiment={item.sentiment} />
                    </div>
                    <div className="flex-1 min-w-0 lg:pl-4">
                      {/* 데스크톱 */}
                      <div className="hidden lg:flex items-center gap-2">
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-text-dark font-semibold hover:text-blue-600 hover:underline transition-colors"
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
                        {showSource && item.source && (
                          <span className="text-[10px] text-text-muted shrink-0">
                            {item.source}
                          </span>
                        )}
                        <div className="ml-auto flex items-center gap-2 shrink-0">
                          {meta && (
                            <span className="text-[10px] text-text-muted tabular-nums">{meta}</span>
                          )}
                        </div>
                      </div>
                      {/* 모바일 */}
                      <span className="lg:hidden inline-flex flex-wrap items-center gap-2 mr-1 align-middle">
                        <SentimentBadge sentiment={item.sentiment} />
                        {meta && (
                          <span className="text-[10px] text-text-muted tabular-nums">{meta}</span>
                        )}
                      </span>
                      <p className="lg:hidden text-sm text-text-dark font-semibold leading-relaxed">
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-600 hover:underline transition-colors"
                        >
                          {displayTitle}
                        </a>
                      </p>
                      {metadataNotice && (
                        <p className="lg:hidden text-[11px] text-amber-600 mt-1">
                          {YOUTUBE_METADATA_EXPIRED_LABEL}
                        </p>
                      )}
                      {showBody && (item.summary || item.content) && (
                        <p className="text-[14px] lg:text-sm text-text-dark mt-0.5">
                          {(item.summary || item.content || '').length > 200
                            ? (item.summary || item.content || '').slice(0, 200) + '…'
                            : item.summary || item.content}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <p className="text-xs text-text-muted text-center py-2">총 {filtered.length}건</p>
    </>
  );
}
