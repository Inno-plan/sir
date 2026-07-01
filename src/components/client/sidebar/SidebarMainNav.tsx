'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  FileText,
  ShieldAlert,
  LineChart,
  MessageCircle,
  // History,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useRiskItemSummary, useRiskNoticeRead } from '@/hooks/report/useReportQuery';

interface SidebarMainNavProps {
  isOpen: boolean;
  workspaceId: string;
  reportHref: string;
  isClientUser: boolean;
}

type NavItem = {
  label: string;
  Icon: LucideIcon;
  href: string;
  active: boolean;
  showNew?: boolean;
};

function isRiskNewerThanSeen(latestRiskAt?: string | null, latestSeenRiskAt?: string | null) {
  if (!latestRiskAt) return false;
  if (!latestSeenRiskAt) return true;

  const latestRiskTime = Date.parse(latestRiskAt);
  const latestSeenTime = Date.parse(latestSeenRiskAt);

  if (Number.isNaN(latestRiskTime)) return false;
  if (Number.isNaN(latestSeenTime)) return true;

  return latestRiskTime > latestSeenTime;
}

/** client 사이드바 상위 2 메뉴 — 보고서 / 위기 대응 센터 */
export function SidebarMainNav({
  isOpen,
  workspaceId,
  reportHref,
  isClientUser,
}: SidebarMainNavProps) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { data: riskItemSummary } = useRiskItemSummary(workspaceId, isClientUser);
  const { data: riskNoticeRead, isFetched: riskNoticeReadFetched } = useRiskNoticeRead(
    workspaceId,
    isClientUser
  );

  const crisisHref = workspaceId ? `/crisis/${workspaceId}` : '';
  const monitoringHref = workspaceId ? `/monitoring/${workspaceId}` : '';
  const supportHref = workspaceId ? `/support/${workspaceId}` : '';
  // const historyHref = workspaceId ? `/insights-history/${workspaceId}` : '';

  const isReport = pathname.startsWith('/report/');
  const isCrisis = pathname.startsWith('/crisis/');
  const isMonitoring = pathname.startsWith('/monitoring/');
  const isSupport = pathname.startsWith('/support/');
  // const isHistory = pathname.startsWith('/insights-history/');
  const hasUnseenRisk =
    isClientUser &&
    riskNoticeReadFetched &&
    !!riskItemSummary?.latestRiskAt &&
    riskItemSummary.count > 0 &&
    isRiskNewerThanSeen(riskItemSummary.latestRiskAt, riskNoticeRead?.latestSeenRiskAt);
  const showCrisisNew = !isCrisis && hasUnseenRisk;

  const items: NavItem[] = [
    { label: '보고서', Icon: FileText, href: reportHref, active: isReport },
    { label: '인사이트', Icon: LineChart, href: monitoringHref, active: isMonitoring },
    // { label: '분석 히스토리', Icon: History, href: historyHref, active: isHistory },
    {
      label: '위기 대응 센터',
      Icon: ShieldAlert,
      href: crisisHref,
      active: isCrisis,
      showNew: showCrisisNew,
    },
    { label: '고객 지원', Icon: MessageCircle, href: supportHref, active: isSupport },
  ];

  const handleClick = (href: string) => {
    if (!href) return;
    router.push(href);
  };

  return (
    <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
      {items.map(({ label, Icon, href, active, showNew }) => (
        <button
          key={label}
          onClick={() => handleClick(href)}
          disabled={!href}
          className={`flex items-center gap-2.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            isOpen ? 'px-9 py-4' : 'py-2.5 justify-center'
          } ${active ? 'bg-bg-accent' : isOpen ? 'bg-bg-light' : ''}`}
        >
          <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
            <Icon size={20} color={active ? 'white' : '#828EA6'} strokeWidth={1.5} />
            {!isOpen && showNew && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                N
              </span>
            )}
          </div>
          {isOpen && (
            <>
              <span
                className={`text-sm font-medium whitespace-nowrap ${active ? 'text-white' : 'text-text-muted'}`}
              >
                {label}
              </span>
              {showNew && (
                <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                  NEW
                </span>
              )}
            </>
          )}
        </button>
      ))}
    </nav>
  );
}
