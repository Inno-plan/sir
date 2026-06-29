'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useWorkspaceSuspense } from '@/hooks/workspace/useWorkspaceQuery';
import { useReportInfoSuspense } from '@/hooks/report/useReportQuery';

interface ReportHeaderProps {
  workspaceId: string;
  reportId: string;
  showPdfButton?: boolean;
  fullWidth?: boolean;
}

export function ReportHeader({
  workspaceId,
  reportId,
  showPdfButton = true,
  fullWidth = false,
}: ReportHeaderProps) {
  const { data: workspace } = useWorkspaceSuspense(workspaceId);
  const { data: report } = useReportInfoSuspense(workspaceId, reportId);

  const periodStart = report?.period_start?.replace(/-/g, '.') ?? '';
  const periodEnd = report?.period_end?.replace(/-/g, '.') ?? '';
  const isDaily = report?.type === 'daily';
  const isInitial = report?.type === 'initial';
  const headerLabel = isDaily
    ? 'SIR Daily Report'
    : isInitial
      ? 'SIR Monthly Report'
      : 'SIR Weekly Report';
  const periodTitle = isDaily ? '분석 일자' : '분석 기간';
  const periodValue = isDaily ? periodStart : `${periodStart} ~ ${periodEnd}`;

  if (fullWidth) {
    return (
      <div className="w-full bg-bg-accent">
        <div className="mx-auto w-full lg:w-[1200px] px-4 lg:px-10 py-6 lg:py-10 flex flex-col gap-4 lg:gap-5">
          <div className="w-full flex justify-between items-center">
            <p className="text-sm lg:text-base text-white/80 font-semibold">{headerLabel}</p>
            {showPdfButton && (
              <Link
                href={`/report/${workspaceId}/${reportId}`}
                target="_blank"
                className="group flex items-center gap-2 text-xs lg:text-sm font-semibold text-white border border-white/30 hover:border-white hover:bg-white/10 px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg transition-all"
              >
                보고서 보기
                <ExternalLink
                  size={13}
                  className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                />
              </Link>
            )}
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
            <h1 className="flex lg:flex-row items-baseline gap-2 font-bold">
              <span className="text-white text-xl lg:text-[36px]">
                {workspace?.company_name ?? ''}
              </span>
              <span className="text-white/60 text-sm lg:text-[22px]">
                {workspace?.ticker ?? ''}
              </span>
            </h1>
            <p className="flex flex-col lg:flex-row text-[10px] lg:text-sm">
              <span className="w-12 lg:w-20 text-white font-bold">{periodTitle}</span>
              <span className="text-white/80">{periodValue}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="w-full flex justify-between items-center">
        <p className="text-sm lg:text-base text-text-muted font-semibold">{headerLabel}</p>
        {showPdfButton && (
          <Link
            href={`/report/${workspaceId}/${reportId}`}
            target="_blank"
            className="group flex items-center gap-2 text-xs lg:text-sm font-semibold text-text-accent border border-text-accent/20 hover:border-text-accent hover:bg-bg-blue px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg transition-all"
          >
            보고서 보기
            <ExternalLink size={13} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        )}
      </div>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between bg-bg-dark px-5 py-5 lg:px-10 lg:py-8 rounded-xl gap-3">
        <h1 className="flex lg:flex-row items-baseline gap-2 font-bold">
          <span className="text-white text-xl lg:text-[36px]">{workspace?.company_name ?? ''}</span>
          <span className="text-text-muted text-sm lg:text-[22px]">{workspace?.ticker ?? ''}</span>
        </h1>
        <p className="flex flex-col lg:flex-row text-[10px] lg:text-sm">
          <span className="w-12 lg:w-20 text-white font-bold">{periodTitle}</span>
          <span className="text-text-muted">{periodValue}</span>
        </p>
      </div>
    </div>
  );
}
