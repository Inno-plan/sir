'use client';
'use no memo';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { RiskReportRequestModal } from '@/components/report/risk-content/RiskReportRequestModal';
import { useClearCriticalType } from '@/hooks/report/useReportMutation';
import type { RiskItem } from '@/lib/api/reportApi';
import {
  YOUTUBE_METADATA_EXPIRED_LABEL,
  getYoutubeDisplayTitle,
  getYoutubeMetadataNotice,
} from '@/lib/youtubeMetadata';

const criticalTypeConfig: Record<
  string,
  { label: string; variant: 'red' | 'amber' | 'blue' | 'slate' }
> = {
  defamation: { label: '명예훼손', variant: 'red' },
  insult: { label: '욕설/비방', variant: 'amber' },
  rumor: { label: '루머', variant: 'blue' },
  spam: { label: '스팸', variant: 'slate' },
};

const criticalTypeDescriptions: Record<string, string> = {
  defamation: '구체적 사실 또는 허위사실로 평판을 떨어뜨리는 게시물',
  insult: '사실 주장 없이 상대를 깎아내리거나 조롱하는 게시물',
  rumor: '확인되지 않은 내용을 추정형으로 퍼뜨리는 게시물',
  spam: '리딩방 홍보/반복성 도배/상업성 링크 유도 게시물',
};

const PLATFORM_TO_CHANNEL: Record<string, string> = {
  naver_news: 'news',
  naver_blog: 'blog',
  youtube: 'youtube',
  naver_stock: 'community',
  dcinside: 'community',
};

const CHANNEL_TABS = [
  { key: 'all', label: '전체' },
  { key: 'blog', label: '블로그' },
  { key: 'youtube', label: '유튜브' },
  { key: 'community', label: '커뮤니티' },
] as const;

const PLATFORM_LABELS: Record<string, string> = {
  naver_news: '뉴스',
  naver_blog: '블로그',
  youtube: '유튜브',
  naver_stock: '커뮤니티',
  dcinside: '커뮤니티',
};

// 컬럼 너비 (grid-template-columns)
const COL_TEMPLATE = '10% 8% 10% 1fr 12%';

interface RiskTableProps {
  riskItems: RiskItem[];
  workspaceId: string;
  /** 기본 reportId — 보고서 페이지 모드. sessionToReportMap 에서 매칭 안 될 때 fallback. */
  reportId: string;
  reportedSourceIds: Set<string>;
  riskReportBySourceId: Map<string, string>;
  /** pending/resolved/rejected 등 admin 처리 시작 항목 — 사용자 취소 불가. */
  processedSourceIds?: Set<string>;
  onCancelReport: (riskReportId: string) => void;
  editable?: boolean;
  allowReport?: boolean;
  /** 위기 대응 센터(workspace 전체 모드) 용 — item.session_id → reportId 매핑. 있으면
   *  신고 대행 요청 모달에 해당 item 의 고유 reportId 가 전달됨. */
  sessionToReportMap?: Map<string, string>;
  /** 위기 대응 센터 모드: reportId → type 매핑. initial 보고서 item 의 신고 버튼 비활성용. */
  reportTypeMap?: Map<string, string>;
  /** true 면 부모(flex container)의 남은 높이를 채움 — 위기 대응 센터 전용. 보고서 페이지는 false (max-h 600). */
  fillHeight?: boolean;
  pdfMode?: boolean;
}

const INITIAL_NOT_REPORTABLE_MSG = '초기 종합 보고서에 대한 신고는 불가능합니다';

const PDF_ROW_LIMIT = 10;

export function RiskTable({
  riskItems,
  workspaceId,
  reportId,
  reportedSourceIds,
  riskReportBySourceId,
  processedSourceIds,
  onCancelReport,
  editable = false,
  allowReport = false,
  sessionToReportMap,
  reportTypeMap,
  fillHeight = false,
  pdfMode = false,
}: RiskTableProps) {
  const [tab, setTab] = useState<string>('all');
  const [reportTarget, setReportTarget] = useState<RiskItem | null>(null);
  // target item 에 매핑되는 reportId — map 이 있으면 우선, 아니면 기본 prop 사용
  const reportTargetReportId = reportTarget
    ? (sessionToReportMap?.get(reportTarget.session_id ?? '') ?? reportId)
    : reportId;

  // 각 item 이 속한 보고서 type — 위기 센터 모드(reportTypeMap 있음)에서만 의미. initial 신고 차단용.
  const getItemReportType = (item: RiskItem): string | undefined => {
    if (!reportTypeMap) return undefined;
    const itemReportId = sessionToReportMap?.get(item.session_id ?? '') ?? reportId;
    return reportTypeMap.get(itemReportId);
  };
  const parentRef = useRef<HTMLDivElement>(null);
  const clearMutation = useClearCriticalType(workspaceId);
  const clearingId = clearMutation.isPending ? clearMutation.variables?.id ?? null : null;

  const filtered = useMemo(() => {
    if (tab === 'all') return riskItems;
    return riskItems.filter((i) => PLATFORM_TO_CHANNEL[i.platform_id] === tab);
  }, [riskItems, tab]);

  // PDF 는 스크롤 없이 상위 N건만 펼친 상태로 렌더
  const displayed = pdfMode ? filtered.slice(0, PDF_ROW_LIMIT) : filtered;

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  // 탭 변경 시 스크롤 상단으로
  useEffect(() => {
    rowVirtualizer.scrollToOffset(0, { behavior: 'smooth' });
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // 채널별 카운트
  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = { all: riskItems.length };
    for (const tabItem of CHANNEL_TABS) {
      if (tabItem.key === 'all') continue;
      counts[tabItem.key] = riskItems.filter(
        (i) => PLATFORM_TO_CHANNEL[i.platform_id] === tabItem.key
      ).length;
    }
    return counts;
  }, [riskItems]);

  return (
    <div className={fillHeight ? 'flex flex-col min-h-0 flex-1' : ''}>
      {/* 채널 탭 */}
      <div className="flex gap-4 mt-1 border-b border-border-light shrink-0">
        {CHANNEL_TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex flex-col items-center gap-1 cursor-pointer flex-1 lg:flex-none"
            >
              <div
                className={`text-xs transition-colors ${
                  active ? 'text-text-dark font-semibold' : 'text-text-muted font-normal'
                }`}
              >
                {t.label} ({channelCounts[t.key] ?? 0})
              </div>
              <div
                className={`h-0.5 w-full rounded-full transition-colors ${
                  active ? 'bg-text-accent' : 'bg-transparent'
                }`}
              />
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className={fillHeight ? 'flex-1 min-h-0 flex items-center justify-center' : ''}>
          <EmptyState message="탐지된 리스크 콘텐츠가 없습니다." />
        </div>
      ) : (
        <>
          {/* 데스크톱: grid 테이블 */}
          <div className={fillHeight ? 'hidden lg:flex flex-col flex-1 min-h-0' : 'hidden lg:block'}>
            <div
              className="grid border-b border-border-light py-3 px-3 text-xs font-semibold text-text-muted text-center shrink-0"
              style={{ gridTemplateColumns: COL_TEMPLATE }}
            >
              <div>수집일</div>
              <div>채널명</div>
              <div>탐지 분류</div>
              <div>세부내용</div>
              <div></div>
            </div>
            <div
              ref={parentRef}
              className={
                pdfMode
                  ? ''
                  : fillHeight
                    ? 'flex-1 min-h-0 overflow-y-auto'
                    : 'max-h-[600px] overflow-y-auto'
              }
            >
              {pdfMode ? (
                displayed.map((item) => {
                  const config = criticalTypeConfig[item.critical_type] ?? {
                    label: item.critical_type,
                    variant: 'slate' as const,
                  };
                  const displayTitle = getYoutubeDisplayTitle(item);
                  const metadataNotice = getYoutubeMetadataNotice(item);
                  return (
                    <div key={item.id}>
                      <div
                        className="grid items-center py-4 px-3 border-b border-border-light"
                        style={{ gridTemplateColumns: COL_TEMPLATE }}
                      >
                        <div className="text-center text-xs text-text-muted">
                          {item.published_at
                            ? item.published_at.slice(0, 10).replace(/-/g, '.')
                            : ''}
                        </div>
                        <div className="text-center text-xs text-text-muted">
                          {PLATFORM_LABELS[item.platform_id] ?? item.platform_id}
                        </div>
                        <div className="text-center">
                          <Badge variant={config.variant} bordered>
                            {config.label}
                          </Badge>
                        </div>
                        <div className="px-3">
                          <div className="flex flex-col gap-2">
                            <span className="text-xs bg-bg-light text-text-muted w-fit px-2 py-0.5 rounded-[10px]">
                              {criticalTypeDescriptions[item.critical_type] ?? item.critical_type}
                            </span>
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-semibold text-text-dark">
                                {displayTitle}
                              </span>
                              {metadataNotice && (
                                <span
                                  className="text-[10px] font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 w-fit"
                                  title={metadataNotice}
                                >
                                  {YOUTUBE_METADATA_EXPIRED_LABEL}
                                </span>
                              )}
                              {item.critical_reason && (
                                <p className="text-xs text-text-dark leading-relaxed">
                                  {item.critical_reason}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div />
                      </div>
                    </div>
                  );
                })
              ) : (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const item = filtered[virtualRow.index];
                  const config = criticalTypeConfig[item.critical_type] ?? {
                    label: item.critical_type,
                    variant: 'slate' as const,
                  };
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
                    >
                      <div
                        className="grid items-center py-4 px-3 border-b border-border-light hover:bg-slate-50/50 transition-colors"
                        style={{ gridTemplateColumns: COL_TEMPLATE }}
                      >
                        <div className="text-center text-xs text-text-muted">
                          {item.published_at
                            ? item.published_at.slice(0, 10).replace(/-/g, '.')
                            : ''}
                        </div>
                        <div className="text-center text-xs text-text-muted">
                          {PLATFORM_LABELS[item.platform_id] ?? item.platform_id}
                        </div>
                        <div className="text-center">
                          <Badge variant={config.variant} bordered>
                            {config.label}
                          </Badge>
                        </div>
                        <div className="px-3">
                          <div className="flex flex-col gap-2">
                            <span className="text-xs bg-bg-light text-text-muted w-fit px-2 py-0.5 rounded-[10px]">
                              {criticalTypeDescriptions[item.critical_type] ?? item.critical_type}
                            </span>
                            <div className="flex flex-col gap-1">
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-semibold text-text-dark hover:text-blue-600 hover:underline transition-colors"
                              >
                                {displayTitle}
                              </a>
                              {metadataNotice && (
                                <span
                                  className="text-[10px] font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 w-fit"
                                  title={metadataNotice}
                                >
                                  {YOUTUBE_METADATA_EXPIRED_LABEL}
                                </span>
                              )}
                              {item.critical_reason && (
                                <p className="text-xs text-text-dark leading-relaxed">
                                  {item.critical_reason}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right pr-2">
                          {editable ? (
                            <button
                              type="button"
                              onClick={() => clearMutation.mutate(item)}
                              disabled={clearingId === item.id}
                              className="cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                            >
                              <Badge
                                variant="slate"
                                className="px-3 py-1.5 hover:bg-red-50 hover:text-red-600 transition-colors"
                              >
                                {clearingId === item.id ? '해제 중...' : '리스크 해제'}
                              </Badge>
                            </button>
                          ) : !allowReport ? null : processedSourceIds?.has(item.id) ? (
                            <Badge variant="amber" className="px-3 py-1.5">
                              삭제 처리 중
                            </Badge>
                          ) : reportedSourceIds.has(item.id) ? (
                            <button
                              type="button"
                              onClick={() => {
                                const rrId = riskReportBySourceId.get(item.id);
                                if (rrId) onCancelReport(rrId);
                              }}
                              className="cursor-pointer"
                            >
                              <Badge
                                variant="slate"
                                className="px-3 py-1.5 hover:bg-red-100 hover:text-red-600 transition-colors"
                              >
                                신고 대행 취소
                              </Badge>
                            </button>
                          ) : getItemReportType(item) === 'initial' ? (
                            <button
                              type="button"
                              disabled
                              title={INITIAL_NOT_REPORTABLE_MSG}
                              className="cursor-not-allowed"
                            >
                              <Badge
                                variant="slate"
                                className="px-3 py-1.5 opacity-50"
                              >
                                신고 대행 요청
                              </Badge>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setReportTarget(item)}
                              className="cursor-pointer"
                            >
                              <Badge
                                variant="blue"
                                className="px-3 py-1.5 hover:bg-bg-accent hover:text-white transition-colors"
                              >
                                신고 대행 요청
                              </Badge>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          </div>

          {/* 모바일: 카드 리스트 */}
          <div
            className={
              fillHeight
                ? 'lg:hidden flex flex-col gap-3 py-3 flex-1 min-h-0 overflow-y-auto'
                : 'lg:hidden flex flex-col gap-3 py-3 max-h-[400px] overflow-y-auto'
            }
          >
            {filtered.map((item) => {
              const config = criticalTypeConfig[item.critical_type] ?? {
                label: item.critical_type,
                variant: 'slate' as const,
              };
              const displayTitle = getYoutubeDisplayTitle(item);
              const metadataNotice = getYoutubeMetadataNotice(item);
              return (
                <div
                  key={item.id}
                  className="border border-border-light rounded-xl p-4 flex flex-col gap-2.5"
                >
                  <div className="flex gap-2">
                    <span className="w-14 shrink-0 text-sm text-text-mobile-muted pt-0.5">
                      수집일
                    </span>
                    <span className="text-sm text-text-dark">
                      {item.published_at ? item.published_at.slice(0, 10).replace(/-/g, '.') : '-'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-14 shrink-0 text-sm text-text-mobile-muted pt-0.5">
                      채널명
                    </span>
                    <span className="text-sm text-text-dark">
                      {PLATFORM_LABELS[item.platform_id] ?? item.platform_id}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-14 shrink-0 text-sm text-text-mobile-muted pt-0.5">
                      탐지 분류
                    </span>
                    <Badge variant={config.variant} bordered>
                      {config.label}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-14 shrink-0 text-sm text-text-mobile-muted pt-0.5">
                      세부 내용
                    </span>
                    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                      <span className="text-xs bg-bg-light text-text-mobile-muted w-fit px-2 py-0.5 rounded-[10px]">
                        {criticalTypeDescriptions[item.critical_type] ?? item.critical_type}
                      </span>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-text-dark hover:text-blue-600 hover:underline transition-colors"
                      >
                        {displayTitle}
                      </a>
                      {metadataNotice && (
                        <span
                          className="text-[10px] font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 w-fit"
                          title={metadataNotice}
                        >
                          {YOUTUBE_METADATA_EXPIRED_LABEL}
                        </span>
                      )}
                      {item.critical_reason && (
                        <p className="text-[14px] text-text-dark leading-relaxed">
                          {item.critical_reason}
                        </p>
                      )}
                    </div>
                  </div>
                  {editable ? (
                    <button
                      type="button"
                      onClick={() => clearMutation.mutate(item)}
                      disabled={clearingId === item.id}
                      className="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                    >
                      {clearingId === item.id ? '해제 중...' : '리스크 해제'}
                    </button>
                  ) : !allowReport ? null : processedSourceIds?.has(item.id) ? (
                    <div className="w-full py-2.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-700 text-center">
                      삭제 처리 중
                    </div>
                  ) : reportedSourceIds.has(item.id) ? (
                    <button
                      type="button"
                      onClick={() => {
                        const rrId = riskReportBySourceId.get(item.id);
                        if (rrId) onCancelReport(rrId);
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      신고 대행 취소
                    </button>
                  ) : getItemReportType(item) === 'initial' ? (
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        disabled
                        className="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-400 cursor-not-allowed"
                      >
                        신고 대행 요청
                      </button>
                      <p className="text-[11px] text-text-muted text-center">
                        {INITIAL_NOT_REPORTABLE_MSG}
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReportTarget(item)}
                      className="w-full py-2.5 rounded-xl text-xs font-semibold bg-bg-accent text-white hover:bg-blue-700 transition-colors cursor-pointer"
                    >
                      신고 대행 요청
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      <p className="text-xs text-text-muted text-center py-2 shrink-0">
        {pdfMode && filtered.length > PDF_ROW_LIMIT
          ? `총 ${filtered.length}건 중 상위 ${PDF_ROW_LIMIT}건 표시`
          : `총 ${filtered.length}건`}
      </p>

      <RiskReportRequestModal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        item={reportTarget}
        workspaceId={workspaceId}
        reportId={reportTargetReportId}
      />
    </div>
  );
}
