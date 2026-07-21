import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Subscription } from '@/lib/api/subscriptionApi';
import { getContractEndDate, getContractStartDate, getKstTodayDate } from '@/lib/contractDate';

export type ContractStatus =
  | 'scheduled'
  | 'active'
  | 'expiring'
  | 'expired'
  | 'none';

export interface ContractSummary {
  status: ContractStatus;
  /** 오늘 기준 종료일까지 남은 일수. 무기한이거나 구독 없으면 null */
  daysUntilExpiry: number | null;
  /** scheduled 일 때 시작까지 남은 일수. 그 외 null */
  daysUntilStart: number | null;
}

export interface ContractExpiryNoticeDismissal {
  acknowledged_ended_at: string;
  dismissed_until: string;
}

/** 구독 하나(활성 또는 예약)를 받아 계약 상태와 남은 일수를 판정 */
export function getContractSummary(
  sub: Subscription | null | undefined,
  now = new Date(),
): ContractSummary {
  if (!sub) return { status: 'none', daysUntilExpiry: null, daysUntilStart: null };

  const today = getKstTodayDate(now);
  const daysToStart = differenceInCalendarDays(getContractStartDate(sub.started_at), today);
  const days = differenceInCalendarDays(getContractEndDate(sub.ended_at), today);

  // 아직 시작 전 = 예약
  if (daysToStart > 0) {
    return { status: 'scheduled', daysUntilExpiry: days, daysUntilStart: daysToStart };
  }
  if (days < 0) return { status: 'expired', daysUntilExpiry: days, daysUntilStart: null };
  if (days <= 7) return { status: 'expiring', daysUntilExpiry: days, daysUntilStart: null };
  return { status: 'active', daysUntilExpiry: days, daysUntilStart: null };
}

/** 현재 계약 종료일에 대해 아직 유효한 숨김 기록인지 판정 */
export function isContractExpiryNoticeDismissed(
  sub: Subscription,
  dismissal: ContractExpiryNoticeDismissal | null | undefined,
  now = new Date(),
): boolean {
  if (!dismissal) return false;
  return (
    dismissal.acknowledged_ended_at === sub.ended_at
    && parseISO(dismissal.dismissed_until).getTime() > now.getTime()
  );
}

export const CONTRACT_STATUS_STYLE: Record<ContractStatus, { label: string; className: string }> = {
  scheduled: { label: '시작 예정', className: 'bg-amber-50 text-amber-700' },
  active: { label: '활성', className: 'bg-emerald-50 text-emerald-700' },
  expiring: { label: '만료 임박', className: 'bg-red-50 text-red-700' },
  expired: { label: '만료', className: 'bg-slate-100 text-slate-400' },
  none: { label: '구독 없음', className: 'bg-slate-100 text-slate-400' },
};
