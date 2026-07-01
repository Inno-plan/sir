'use client';

import { useMemo } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { FileText, ShieldAlert, LineChart, MessageCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useReports } from '@/hooks/workspace/useWorkspaceQuery';
import { useLastReportStore } from '@/store/lastReport';

/** 모바일 하단 고정 탭 바 — 보고서 / 모니터링 / 위기 대응 센터 */
export function MobileTabBar() {
  const params = useParams();
  const pathname = usePathname() ?? '';
  const router = useRouter();

  const workspaceId = (params?.workspaceId as string | undefined) ?? '';
  const { data: reports } = useReports(workspaceId);
  const lastReportId = useLastReportStore((s) => s.lastReportByWorkspace[workspaceId]);

  // 우선순위: 현재 URL reportId → 마지막으로 본 보고서(존재 검증) → 최신 보고서
  const reportHref = useMemo(() => {
    if (!workspaceId) return '';
    const currentReportId = params?.reportId as string | undefined;
    const savedId =
      lastReportId && reports?.some((r) => r.id === lastReportId) ? lastReportId : undefined;
    const targetId = currentReportId ?? savedId ?? reports?.[0]?.id;
    return targetId ? `/report/${workspaceId}/${targetId}` : '';
  }, [workspaceId, params?.reportId, reports, lastReportId]);

  const monitoringHref = workspaceId ? `/monitoring/${workspaceId}` : '';
  // const historyHref = workspaceId ? `/insights-history/${workspaceId}` : '';
  const crisisHref = workspaceId ? `/crisis/${workspaceId}` : '';
  const supportHref = workspaceId ? `/support/${workspaceId}` : '';

  const items: { label: string; Icon: LucideIcon; href: string; active: boolean }[] = [
    { label: '보고서', Icon: FileText, href: reportHref, active: pathname.startsWith('/report/') },
    {
      label: '인사이트',
      Icon: LineChart,
      href: monitoringHref,
      active: pathname.startsWith('/monitoring/'),
    },
    // {
    //   label: '히스토리',
    //   Icon: History,
    //   href: historyHref,
    //   active: pathname.startsWith('/insights-history/'),
    // },
    {
      label: '위기 대응',
      Icon: ShieldAlert,
      href: crisisHref,
      active: pathname.startsWith('/crisis/'),
    },
    {
      label: '지원',
      Icon: MessageCircle,
      href: supportHref,
      active: pathname.startsWith('/support/'),
    },
  ];

  const handleClick = (href: string) => {
    if (!href) return;
    router.push(href);
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch bg-white border-t border-slate-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map(({ label, Icon, href, active }) => (
        <button
          key={label}
          onClick={() => handleClick(href)}
          disabled={!href}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Icon size={20} color={active ? '#362CFF' : '#828EA6'} strokeWidth={1.75} />
          <span
            className={`text-[11px] font-medium ${active ? 'text-text-accent' : 'text-text-muted'}`}
          >
            {label}
          </span>
        </button>
      ))}
    </nav>
  );
}
