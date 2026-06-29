'use client';

import { useMemo, useState } from 'react';
import {
  useChannelItemsSuspense,
  useChannelStatsSuspense,
  useNewsClustersSuspense,
  useReportInfoSuspense,
  usePrevReportSuspense,
  usePrevDailySnapshotSuspense,
} from '@/hooks/report/useReportQuery';
import { ReportSection } from '@/components/report/ReportSection';
import { ChannelVolumePanel } from '@/components/report/reputation/ChannelVolumePanel';
import { ChannelSirPanel } from '@/components/report/reputation/ChannelSirPanel';
import { SentimentPanel } from '@/components/report/reputation/SentimentPanel';
import { ChannelDetailPanel } from '@/components/report/reputation/ChannelDetailPanel';
import { OnlineReputationIcon } from '@/components/icons/OnlineReputationIcon';
import { ReportChannelDrawer } from '@/components/report/highlight/ReportChannelDrawer';
import type { ReportChannel } from '@/components/report/highlight/channelMeta';

interface OnlineReputationProps {
  workspaceId: string;
  reportId: string;
  pdfMode?: boolean;
}

export function OnlineReputation({ workspaceId, reportId, pdfMode = false }: OnlineReputationProps) {
  const [selectedChannel, setSelectedChannel] = useState<ReportChannel | null>(null);
  const { data: report } = useReportInfoSuspense(workspaceId, reportId);
  const { data: channelItems } = useChannelItemsSuspense(workspaceId, reportId);
  const { data: channelStats } = useChannelStatsSuspense(
    workspaceId,
    channelItems,
    reportId,
    report?.period_start,
    report?.period_end,
  );
  const { data: newsClusters } = useNewsClustersSuspense(workspaceId, reportId);
  const { data: prevReport } = usePrevReportSuspense(workspaceId, reportId);

  const isInitial = report?.type === 'initial';
  const isDaily = report?.type === 'daily';
  const prevIsInitial = prevReport?.type === 'initial';

  // daily 는 이전 daily report 가 없어도 daily_snapshots 로 전일 채널별 SIR 비교
  const { data: prevDaily } = usePrevDailySnapshotSuspense(workspaceId, report?.period_end, isDaily);
  const prevChannelSirMap = isDaily
    ? (prevDaily?.channelSirMap ?? {})
    : (prevReport?.channelSirMap ?? {});

  const channelVolumeProps = useMemo(
    () => ({
      channelStats,
      pdfMode,
      onChannelClick: pdfMode ? undefined : setSelectedChannel,
    }),
    [channelStats, pdfMode],
  );

  const sentimentProps = useMemo(
    () => ({ channelStats, pdfMode }),
    [channelStats, pdfMode],
  );

  const channelDetailProps = useMemo(
    () => ({ channelStats, channelItems, newsClusters }),
    [channelStats, channelItems, newsClusters],
  );

  return (
    <div className="print-break">
      <ReportSection id="section-reputation" icon={<OnlineReputationIcon size={36} />} title="기업 평판 분석">
        <div className="print-keep"><ChannelVolumePanel {...channelVolumeProps} /></div>
        <div className="print-keep">
          <ChannelSirPanel channelStats={channelStats} isInitial={isInitial} prevIsInitial={prevIsInitial} isDaily={isDaily} prevChannelSirMap={prevChannelSirMap} />
        </div>
        <div className="print-keep"><SentimentPanel {...sentimentProps} /></div>
        <div className="print-keep"><ChannelDetailPanel {...channelDetailProps} /></div>
        {!pdfMode && (
          <ReportChannelDrawer
            channel={selectedChannel}
            items={channelItems}
            onClose={() => setSelectedChannel(null)}
          />
        )}
      </ReportSection>
    </div>
  );
}
