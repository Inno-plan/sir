import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  changeSubscriptionTier,
  extendSubscription,
  renewSubscription,
  pauseSubscription,
  cancelSubscription,
  correctSubscription,
  deleteScheduledSubscription,
  dismissSubscriptionExpiryNotice,
} from '@/lib/api/subscriptionApi';
import { subscriptionKeys } from '@/hooks/subscription/useSubscriptionQuery';
import { userKeys } from '@/hooks/user/useUserQuery';

function useInvalidateOnSuccess() {
  const queryClient = useQueryClient();
  return (workspaceId: string) => {
    // workspace prefix → active/current 구독 쿼리 모두 무효화
    queryClient.invalidateQueries({ queryKey: subscriptionKeys.workspace(workspaceId) });
    queryClient.invalidateQueries({ queryKey: userKeys.usersDetailed() });
  };
}

export function useChangeSubscriptionTier() {
  const invalidate = useInvalidateOnSuccess();
  return useMutation({
    mutationFn: changeSubscriptionTier,
    onSuccess: (_, vars) => invalidate(vars.workspaceId),
  });
}

export function useExtendSubscription() {
  const invalidate = useInvalidateOnSuccess();
  return useMutation({
    mutationFn: extendSubscription,
    onSuccess: (_, vars) => invalidate(vars.workspaceId),
  });
}

export function useRenewSubscription() {
  const invalidate = useInvalidateOnSuccess();
  return useMutation({
    mutationFn: renewSubscription,
    onSuccess: (_, vars) => invalidate(vars.workspaceId),
  });
}

export function usePauseSubscription() {
  const invalidate = useInvalidateOnSuccess();
  return useMutation({
    mutationFn: pauseSubscription,
    onSuccess: (_, vars) => invalidate(vars.workspaceId),
  });
}

export function useCancelSubscription() {
  const invalidate = useInvalidateOnSuccess();
  return useMutation({
    mutationFn: cancelSubscription,
    onSuccess: (_, vars) => invalidate(vars.workspaceId),
  });
}

export function useCorrectSubscription(workspaceId: string | undefined) {
  const invalidate = useInvalidateOnSuccess();
  return useMutation({
    mutationFn: correctSubscription,
    onSuccess: () => {
      if (workspaceId) invalidate(workspaceId);
    },
  });
}

export function useDeleteScheduledSubscription(workspaceId: string | undefined) {
  const invalidate = useInvalidateOnSuccess();
  return useMutation({
    mutationFn: deleteScheduledSubscription,
    onSuccess: () => {
      if (workspaceId) invalidate(workspaceId);
    },
  });
}

export function useDismissSubscriptionExpiryNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dismissSubscriptionExpiryNotice,
    onSuccess: (dismissal) => {
      queryClient.setQueryData(
        subscriptionKeys.expiryNoticeDismissal(
          dismissal.profile_id,
          dismissal.subscription_id,
        ),
        dismissal,
      );
    },
  });
}
