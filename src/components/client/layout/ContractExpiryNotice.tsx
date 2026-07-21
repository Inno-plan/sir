'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { useParams, useRouter } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import { useDismissSubscriptionExpiryNotice } from '@/hooks/subscription/useSubscriptionMutation';
import { useSubscriptionExpiryNoticeDismissal } from '@/hooks/subscription/useSubscriptionQuery';
import { useWorkspaceSubscription } from '@/hooks/workspace/useWorkspaceQuery';
import { getContractSummary, isContractExpiryNoticeDismissed } from '@/lib/subscription';
import { getContractEndDate } from '@/lib/contractDate';
import { getErrorMessage } from '@/lib/utils';
import type { AuthUser } from '@/types/auth';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface ContractExpiryNoticeProps {
  user: AuthUser | null;
}

export function ContractExpiryNotice({ user }: ContractExpiryNoticeProps) {
  const params = useParams();
  const router = useRouter();
  const workspaceId = typeof params?.workspaceId === 'string' ? params.workspaceId : '';
  const [closedNoticeKey, setClosedNoticeKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hideUntilExpiry, setHideUntilExpiry] = useState(false);

  const subscriptionQuery = useWorkspaceSubscription(user?.role === 'user' ? workspaceId : '');
  const subscription = subscriptionQuery.data;
  const summary = getContractSummary(subscription);
  const isExpiring = summary.status === 'expiring';

  const dismissalQuery = useSubscriptionExpiryNoticeDismissal(
    isExpiring ? user?.id : undefined,
    isExpiring ? subscription?.id : undefined
  );
  const dismissMutation = useDismissSubscriptionExpiryNotice();

  if (!user || user.role !== 'user' || !subscription || !isExpiring) return null;
  if (dismissalQuery.isPending) return null;

  const noticeKey = `${subscription.id}:${subscription.ended_at}`;
  const isDismissed = isContractExpiryNoticeDismissed(subscription, dismissalQuery.data);
  const open = !isDismissed && closedNoticeKey !== noticeKey;
  const days = summary.daysUntilExpiry ?? 0;
  const remainingText =
    days === 0
      ? '계약이 오늘 종료됩니다.'
      : days === 1
        ? '계약 종료까지 하루 남았습니다.'
        : `계약 종료까지 ${days}일 남았습니다.`;

  const closeForVisit = () => {
    setSaveError(null);
    setClosedNoticeKey(noticeKey);
  };

  const dismissUntilExpiry = async () => {
    setSaveError(null);
    try {
      await dismissMutation.mutateAsync({
        profileId: user.id,
        subscriptionId: subscription.id,
        endedAt: subscription.ended_at,
      });
      setClosedNoticeKey(noticeKey);
    } catch (error) {
      setSaveError(getErrorMessage(error, '알림 설정을 저장하지 못했습니다.'));
    }
  };

  const confirmNotice = async () => {
    if (hideUntilExpiry) {
      await dismissUntilExpiry();
      return;
    }
    closeForVisit();
  };

  const contactAboutContract = () => {
    if (hideUntilExpiry) {
      void dismissUntilExpiry();
    } else {
      closeForVisit();
    }
    router.push(`/support/${encodeURIComponent(workspaceId)}?type=contract_extension`);
  };

  return (
    <Modal
      open={open}
      onClose={closeForVisit}
      title="계약 만료 안내"
      size="sm"
      footer={
        <div className="flex w-full flex-col gap-3">
          <div className="flex w-full gap-2">
            <Button
              onClick={contactAboutContract}
              disabled={dismissMutation.isPending}
              className="min-w-0 basis-0 flex-1"
            >
              계약 문의
            </Button>
            <Button
              variant="outline"
              onClick={confirmNotice}
              disabled={dismissMutation.isPending}
              className="min-w-0 basis-0 flex-1 bg-white text-black"
            >
              {dismissMutation.isPending ? '저장 중...' : '확인'}
            </Button>
          </div>
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={hideUntilExpiry}
              onChange={(event) => setHideUntilExpiry(event.target.checked)}
              disabled={dismissMutation.isPending}
              className="size-4 accent-bg-accent"
            />
            계약 종료일까지 보지 않기
          </label>
        </div>
      }
    >
      <div className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-4">
        <CalendarClock className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-text-dark">{remainingText}</p>
          <div>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              종료일은 {format(getContractEndDate(subscription.ended_at), 'yyyy년 M월 d일')}입니다.
            </p>
            <p className="text-xs leading-relaxed text-text-muted">
              계속 이용하려면 담당자에게 문의해 주세요.
            </p>
          </div>
        </div>
      </div>
      {saveError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {saveError}
        </p>
      )}
    </Modal>
  );
}
