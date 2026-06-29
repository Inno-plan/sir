'use client';

import { useMemo, useState } from 'react';
import {
  useWorkspaceSirSuspense,
  useWeeklySummarySuspense,
  useSirStockDataSuspense,
  useSirRankingSuspense,
  useChannelItemsSuspense,
  useRiskItemsSuspense,
  usePrevReportSuspense,
  usePrevDailySnapshotSuspense,
  useReportInfoSuspense,
  useDailyCollectionStatsSuspense,
} from '@/hooks/report/useReportQuery';
import { ReportSection, ReportSubSection } from '@/components/report/ReportSection';
import { SirSnapshot } from '@/components/report/highlight/SirSnapshot';
import { CollectionSnapshot } from '@/components/report/highlight/CollectionSnapshot';
import { ReportChannelDrawer } from '@/components/report/highlight/ReportChannelDrawer';
import { ReportRiskDrawer } from '@/components/report/highlight/ReportRiskDrawer';
import { RiskSnapshot } from '@/components/report/highlight/RiskSnapshot';
// ranking 카드(StatCard 기반)는 weekly/monthly 에서 v37 까지 4번째 카드로 노출.
// v38 에서 3 카드 새 디자인으로 통일하면서 일단 주석 처리. 필요 시 부활용으로 import 보존.
// import { Snapshot } from '@/components/report/highlight/Snapshot';
import { Reputation } from '@/components/report/highlight/Reputation';
import { EditableReputation } from '@/components/report/highlight/EditableReputation';
import { SirStockPanel } from '@/components/report/highlight/SirStockPanel';
import { SirRankingPanel } from '@/components/report/highlight/SirRankingPanel';
import { WeeklyHighlightIcon } from '@/components/icons/WeeklyHighlightIcon';
import type { SirRanking } from '@/lib/api/reportApi';
import {
  PLATFORM_TO_REPORT_CHANNEL,
  type ReportChannel,
} from '@/components/report/highlight/channelMeta';
import type { CriticalType } from '@/types/common';

const emptyChannelCount = (): Record<ReportChannel, number> => ({
  news: 0,
  blog: 0,
  youtube: 0,
  community: 0,
});

const emptyTypeCount = (): Record<CriticalType, number> => ({
  defamation: 0,
  insult: 0,
  rumor: 0,
  spam: 0,
});

export interface SnapshotDiff {
  scoreDiff: number;
  tierDiff: number;
  itemsDiff: number;
  riskDiff: number;
}

interface HighlightProps {
  workspaceId: string;
  reportId: string;
  pdfMode?: boolean;
  editable?: boolean;
}

const defaultRanking: SirRanking = { tiers: [], rank: 0, total: 0, average: 0 };

export function Highlight({ workspaceId, reportId, pdfMode = false, editable = false }: HighlightProps) {
  const [selectedChannel, setSelectedChannel] = useState<ReportChannel | null>(null);
  const [selectedRiskType, setSelectedRiskType] = useState<CriticalType | null>(null);
  const { data: workspace } = useWorkspaceSirSuspense(workspaceId);
  const { data: report } = useReportInfoSuspense(workspaceId, reportId);
  const { data: summary } = useWeeklySummarySuspense(workspaceId, reportId);
  const { data: sirStockData } = useSirStockDataSuspense(workspaceId, reportId);
  const { data: sirRanking } = useSirRankingSuspense(workspaceId, reportId);
  const { data: channelItems } = useChannelItemsSuspense(workspaceId, reportId);
  const { data: riskItems } = useRiskItemsSuspense(workspaceId, reportId);
  const { data: prevReport } = usePrevReportSuspense(workspaceId, reportId);

  const isInitial = report?.type === 'initial';
  const isDaily = report?.type === 'daily';
  const sirScore = report?.sir_score ?? 0;
  const totalItems = channelItems.length;
  const riskCount = riskItems.length;

  // daily 는 이전 daily report 가 없어도(첫 daily) daily_snapshots 로 전일 비교
  const { data: prevDaily } = usePrevDailySnapshotSuspense(workspaceId, report?.period_end, isDaily);
  // daily 의 7일 평균 (오늘 포함). 채널 평균 막대 tick + 평균 대비 % 비교용.
  const { data: dailyCollection7d } = useDailyCollectionStatsSuspense(workspaceId, report?.period_end, isDaily);

  const snapshotDiff = useMemo(() => {
    const getTierIdx = (s: number) => Math.min(Math.floor(s / 100), 9);

    // daily: daily_snapshots 기반 전일 비교 (tierDiff 는 순위 카드가 daily 에서 안 보이므로 계산만)
    if (isDaily && prevDaily) {
      return {
        scoreDiff: Math.round(sirScore - prevDaily.sirScore),
        tierDiff: getTierIdx(sirScore) - getTierIdx(prevDaily.sirScore),
        itemsDiff: totalItems - prevDaily.totalItems,
        riskDiff: riskCount - prevDaily.riskCount,
      };
    }

    if (!prevReport) {
      // 첫 보고서 — SIR 500 기준, 나머지 0 기준
      return {
        scoreDiff: Math.round(sirScore - 500),
        tierDiff: getTierIdx(sirScore) - getTierIdx(500),
        itemsDiff: totalItems,
        riskDiff: riskCount,
      };
    }

    return {
      scoreDiff: Math.round(sirScore - prevReport.sirScore),
      tierDiff: getTierIdx(sirScore) - getTierIdx(prevReport.sirScore),
      itemsDiff: totalItems - prevReport.totalItems,
      riskDiff: riskCount - prevReport.riskCount,
    };
  }, [isDaily, prevDaily, sirScore, totalItems, riskCount, prevReport]);

  const prevIsInitial = prevReport?.type === 'initial';
  const hasPrev = isDaily ? !!prevDaily : !!prevReport;
  const avgScore = workspace?.sir_score ?? 0;

  const period: '일간' | '주간' | '월간' = isDaily ? '일간' : isInitial ? '월간' : '주간';
  const prefix = !hasPrev
    ? '기준점 대비 '
    : isDaily
      ? '전일 대비 '
      : prevIsInitial
        ? '전월 대비 '
        : '전주 대비 ';

  const channelToday = useMemo(() => {
    const acc = emptyChannelCount();
    for (const it of channelItems) {
      const ch = PLATFORM_TO_REPORT_CHANNEL[it.platform_id];
      if (ch) acc[ch] += 1;
    }
    return acc;
  }, [channelItems]);

  const channelAvg = useMemo(() => {
    if (!isDaily || dailyCollection7d.length === 0) return undefined;
    const sum = emptyChannelCount();
    for (const day of dailyCollection7d) {
      sum.news += day.channelVolume.news;
      sum.blog += day.channelVolume.blog;
      sum.youtube += day.channelVolume.youtube;
      sum.community += day.channelVolume.community;
    }
    const n = dailyCollection7d.length;
    return {
      news: Math.round(sum.news / n),
      blog: Math.round(sum.blog / n),
      youtube: Math.round(sum.youtube / n),
      community: Math.round(sum.community / n),
    };
  }, [isDaily, dailyCollection7d]);

  const typeCounts = useMemo(() => {
    const acc = emptyTypeCount();
    for (const it of riskItems) {
      if (it.critical_type in acc) acc[it.critical_type as CriticalType] += 1;
    }
    return acc;
  }, [riskItems]);

  const sirStockProps = useMemo(
    () => ({ pdfMode, sirStockData }),
    [pdfMode, sirStockData],
  );

  const sirRankingProps = useMemo(
    () => ({ score: sirScore, avgScore, companyName: workspace?.company_name ?? '', sirRanking: sirRanking ?? defaultRanking, pdfMode, isDaily, isInitial }),
    [sirScore, avgScore, workspace?.company_name, sirRanking, pdfMode, isDaily, isInitial],
  );

  const isNoData = totalItems === 0;
  const handleChannelClick = (channel: ReportChannel) => {
    if (channelToday[channel] > 0) setSelectedChannel(channel);
  };
  const handleRiskTypeClick = (type: CriticalType) => {
    if (typeCounts[type] > 0) setSelectedRiskType(type);
  };

  return (
    <ReportSection icon={<WeeklyHighlightIcon size={36} />} title={isDaily ? '일간 하이라이트' : isInitial ? '월간 하이라이트' : '주간 하이라이트'}>
      {isNoData && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <span className="text-amber-700 text-base shrink-0 leading-none mt-0.5">⚠</span>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-amber-800">이번 기간 수집된 데이터가 없습니다.</span>
            <span className="text-xs text-amber-700 leading-relaxed">
              SIR 점수와 채널별 지표는 직전 일자 기준으로 표시되며, 변화량은 산출되지 않습니다.
            </span>
          </div>
        </div>
      )}
      <ReportSubSection title="Snapshot">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-5 print-keep">
          <SirSnapshot
            score={sirScore}
            diff={snapshotDiff.scoreDiff}
            prefix={prefix}
            period={period}
            isNoData={isNoData}
          />
          <CollectionSnapshot
            channelToday={channelToday}
            channelAvg={isDaily ? channelAvg : undefined}
            total={totalItems}
            diff={snapshotDiff.itemsDiff}
            prefix={prefix}
            period={period}
            isNoData={isNoData}
            onChannelClick={pdfMode ? undefined : handleChannelClick}
          />
          <RiskSnapshot
            typeCounts={typeCounts}
            total={riskCount}
            diff={snapshotDiff.riskDiff}
            prefix={prefix}
            period={period}
            isNoData={isNoData}
            onRiskTypeClick={pdfMode ? undefined : handleRiskTypeClick}
          />
        </div>
      </ReportSubSection>
      {!isDaily && (
        <>
          {editable ? (
            <EditableReputation summary={summary} workspaceId={workspaceId} reportId={reportId} isInitial={isInitial} />
          ) : (
            <Reputation summary={summary} pdfMode={pdfMode} isInitial={isInitial} />
          )}
          <div className="print-keep"><SirStockPanel {...sirStockProps} /></div>
          <div className="print-keep"><SirRankingPanel {...sirRankingProps} /></div>
        </>
      )}
      {!pdfMode && (
        <>
          <ReportChannelDrawer
            channel={selectedChannel}
            items={channelItems}
            onClose={() => setSelectedChannel(null)}
          />
          <ReportRiskDrawer
            type={selectedRiskType}
            items={riskItems}
            onClose={() => setSelectedRiskType(null)}
          />
        </>
      )}
    </ReportSection>
  );
}
