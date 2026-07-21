import { useQuery } from '@tanstack/react-query';
import {
  getCurrentOrUpcomingSubscription,
  getSubscriptionExpiryNoticeDismissal,
} from '@/lib/api/subscriptionApi';

export const subscriptionKeys = {
  all: ['subscriptions'] as const,
  /** 워크스페이스 단위 prefix — invalidate 시 하위 구독 쿼리 모두 무효화 */
  workspace: (workspaceId: string) => ['subscriptions', workspaceId] as const,
  current: (workspaceId: string) =>
    ['subscriptions', workspaceId, 'current'] as const,
  expiryNoticeDismissal: (profileId: string, subscriptionId: string) =>
    ['subscriptions', subscriptionId, 'expiry-notice-dismissal', profileId] as const,
};

/** 현재 활성 또는 미래 예약 구독 1건 (관리자 모달용) */
export function useCurrentOrUpcomingSubscription(
  workspaceId: string | undefined,
) {
  return useQuery({
    queryKey: workspaceId
      ? subscriptionKeys.current(workspaceId)
      : ['subscriptions', 'none'],
    queryFn: () =>
      workspaceId ? getCurrentOrUpcomingSubscription(workspaceId) : null,
    enabled: !!workspaceId,
  });
}

/** 사용자별 현재 계약 만료 안내 숨김 상태 */
export function useSubscriptionExpiryNoticeDismissal(
  profileId: string | undefined,
  subscriptionId: string | undefined,
) {
  return useQuery({
    queryKey: profileId && subscriptionId
      ? subscriptionKeys.expiryNoticeDismissal(profileId, subscriptionId)
      : ['subscriptions', 'expiry-notice-dismissal', 'none'],
    queryFn: () => profileId && subscriptionId
      ? getSubscriptionExpiryNoticeDismissal({ profileId, subscriptionId })
      : null,
    enabled: !!profileId && !!subscriptionId,
  });
}
