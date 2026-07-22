'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { X, Plus } from 'lucide-react';
import { AdminButton } from '@/components/ui/AdminButton';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ContractPeriodPicker } from '@/components/ui/ContractPeriodPicker';
import { TierPicker } from '@/components/user/TierPicker';
import { ContractTypePicker } from '@/components/user/ContractTypePicker';
import { PasswordResetSection } from '@/components/user/PasswordResetSection';
import { useUpdateUser, useUpdateWorkspaceTokens } from '@/hooks/user/useUserMutation';
import { useCurrentOrUpcomingSubscription } from '@/hooks/subscription/useSubscriptionQuery';
import {
  useChangeSubscriptionTier,
  useExtendSubscription,
  useRenewSubscription,
  usePauseSubscription,
  useCancelSubscription,
  useCorrectSubscription,
  useDeleteScheduledSubscription,
} from '@/hooks/subscription/useSubscriptionMutation';
import { ROLE_LABEL } from '@/constants/role';
import {
  CONTRACT_TYPE_LABELS,
  TIER_LABELS,
  type ContractType,
  type Tier,
} from '@/types/subscription';
import type { UserProfile, WorkspaceMember, WorkspaceTokens } from '@/lib/api/userApi';
import type { Subscription, SubscriptionStatus } from '@/lib/api/subscriptionApi';
import type { ProfileRole } from '@/types/auth';
import {
  getContractEndDate,
  getContractPresetEndDate,
  getContractStartDate,
  getKstTodayDate,
  getTrialEndDate,
  TRIAL_DURATION_DAYS,
  toContractEndIso,
  toContractStartIso,
} from '@/lib/contractDate';

type SubMode =
  | 'idle'
  | 'change_tier'
  | 'extend'
  | 'pause'
  | 'cancel'
  | 'new'
  | 'correct';

interface UserDetailModalProps {
  user: UserProfile | null;
  myRole: ProfileRole;
  workspaces: { id: string; company_name: string; ticker: string }[];
  members: WorkspaceMember[];
  initialSubscription?: Subscription;
  /** role='user' 인 경우 해당 워크스페이스의 AI 토큰 현황 */
  initialTokens?: WorkspaceTokens;
  open: boolean;
  onClose: () => void;
}

export function UserDetailModal({
  user,
  myRole,
  workspaces,
  members,
  initialSubscription,
  initialTokens,
  open,
  onClose,
}: UserDetailModalProps) {
  const [pendingRole, setPendingRole] = useState<ProfileRole>('user');
  const [pendingWs, setPendingWs] = useState<string[]>([]);

  // 구독 작업 mode + 작업별 입력값
  const [subMode, setSubMode] = useState<SubMode>('idle');
  const [formTier, setFormTier] = useState<Tier | undefined>(undefined);
  const [formContractType, setFormContractType] = useState<ContractType>('paid');
  const [formStart, setFormStart] = useState<Date | undefined>(undefined);
  const [formEnd, setFormEnd] = useState<Date | undefined>(undefined);

  // workspace 검색
  const [wsSearch, setWsSearch] = useState('');

  const updateUser = useUpdateUser();
  const updateTokens = useUpdateWorkspaceTokens();

  // 토큰 폼 — super_admin 전용. monthly_quota 절대값 + add_tokens delta.
  const [tokenQuotaInput, setTokenQuotaInput] = useState<string>('');
  const [tokenAddInput, setTokenAddInput] = useState<string>('');
  const tokensSig = initialTokens
    ? `${initialTokens.id}:${initialTokens.monthly_quota}:${initialTokens.token_balance}`
    : '';
  useEffect(() => {
    setTokenQuotaInput(initialTokens ? String(initialTokens.monthly_quota) : '');
    setTokenAddInput('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokensSig]);
  const changeTier = useChangeSubscriptionTier();
  const extendSub = useExtendSubscription();
  const renewSub = useRenewSubscription();
  const pauseSub = usePauseSubscription();
  const cancelSub = useCancelSubscription();

  const userWorkspaceId =
    user && user.role === 'user'
      ? members.find((m) => m.profile_id === user.id)?.workspace_id
      : undefined;

  const { data: fetchedSub } = useCurrentOrUpcomingSubscription(userWorkspaceId);
  // 현재 또는 예약 구독. 로딩 중엔 부모가 넘긴 활성 구독으로 fallback.
  const sub: Subscription | null =
    fetchedSub !== undefined
      ? (fetchedSub?.subscription ?? null)
      : (initialSubscription ?? null);
  const subStatus: SubscriptionStatus | null =
    fetchedSub !== undefined
      ? (fetchedSub?.status ?? null)
      : (initialSubscription ? 'active' : null);
  // 활성일 때만 활성 전용 액션(연장/정지/해지/티어변경) 노출
  const activeSub: Subscription | null = subStatus === 'active' ? sub : null;

  const correctSub = useCorrectSubscription(userWorkspaceId);
  const deleteScheduled = useDeleteScheduledSubscription(userWorkspaceId);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (user) {
      setPendingRole(user.role);
      setPendingWs(
        members.filter((m) => m.profile_id === user.id).map((m) => m.workspace_id),
      );
      resetSubForm();
      setWsSearch('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const resetSubForm = () => {
    setSubMode('idle');
    setFormTier(undefined);
    setFormContractType('paid');
    setFormStart(undefined);
    setFormEnd(undefined);
  };

  const enterMode = (mode: SubMode) => {
    if (mode === 'change_tier' && sub) {
      setFormTier(sub.tier);
    } else if (mode === 'extend' && sub) {
      setFormEnd(getContractEndDate(sub.ended_at));
    } else if (mode === 'correct' && sub) {
      setFormTier(sub.tier);
      setFormContractType(sub.contract_type);
      setFormStart(
        getContractStartDate(
          sub.contract_type === 'trial' && sub.trial_started_at
            ? sub.trial_started_at
            : sub.started_at,
        ),
      );
      setFormEnd(getContractEndDate(sub.ended_at));
    } else if (mode === 'new') {
      const today = getKstTodayDate();
      setFormTier('black_plus');
      setFormContractType('paid');
      setFormStart(today);
      setFormEnd(getContractPresetEndDate(today, 12));
    }
    setSubMode(mode);
  };

  const handleContractTypeChange = (next: ContractType) => {
    setFormContractType(next);
    if (next !== 'trial') return;

    const persistedTrialStart = sub?.trial_started_at
      ? getContractStartDate(sub.trial_started_at)
      : undefined;
    const trialStart = persistedTrialStart ?? formStart ?? getKstTodayDate();
    setFormStart(trialStart);
    setFormEnd(getTrialEndDate(trialStart));
  };

  const handleSubscriptionPeriodChange = ({
    start,
    end,
  }: {
    start: Date | undefined;
    end: Date | undefined;
  }) => {
    setFormStart(start);
    setFormEnd(formContractType === 'trial' && start ? getTrialEndDate(start) : end);
  };

  const filteredWs = useMemo(() => {
    if (!wsSearch.trim()) return workspaces;
    const q = wsSearch.toLowerCase();
    return workspaces.filter(
      (ws) =>
        ws.company_name.toLowerCase().includes(q) ||
        ws.ticker.toLowerCase().includes(q),
    );
  }, [workspaces, wsSearch]);

  if (!user) return null;

  const isSuperAdmin = myRole === 'super_admin';
  const isUserRole = user.role === 'user';
  const canEditWorkspace = isSuperAdmin;
  const canEditRole = isSuperAdmin;
  const canEditSub = isSuperAdmin;
  const singleSelect = pendingRole === 'user';

  const currentWs = members
    .filter((m) => m.profile_id === user.id)
    .map((m) => m.workspace_id);

  const roleChanged = pendingRole !== user.role;
  const wsChanged =
    JSON.stringify([...pendingWs].sort()) !==
    JSON.stringify([...currentWs].sort());

  const subBusy =
    changeTier.isPending ||
    extendSub.isPending ||
    renewSub.isPending ||
    pauseSub.isPending ||
    cancelSub.isPending ||
    correctSub.isPending ||
    deleteScheduled.isPending;
  const saving = updateUser.isPending || subBusy;

  // 사용자 역할은 sub 작업이 별도 흐름이므로, 메인 저장은 role 변경만 다룸
  const hasMainChanges = isUserRole ? roleChanged : roleChanged || wsChanged;

  const handleRoleChange = (newRole: ProfileRole) => {
    setPendingRole(newRole);
    if (newRole === 'user' && pendingWs.length > 1) {
      setPendingWs([pendingWs[0]]);
    }
  };

  const handleWorkspaceToggle = (wsId: string) => {
    if (singleSelect) {
      setPendingWs((prev) => (prev.includes(wsId) ? [] : [wsId]));
    } else {
      setPendingWs((prev) =>
        prev.includes(wsId) ? prev.filter((id) => id !== wsId) : [...prev, wsId],
      );
    }
  };

  const handleSave = async () => {
    try {
      if (roleChanged && canEditRole) {
        await updateUser.mutateAsync({
          userId: user.id,
          roleChange: pendingRole,
          wsAdd: [],
          wsRemove: [],
        });
      }
      if (!isUserRole && wsChanged && canEditWorkspace) {
        await updateUser.mutateAsync({
          userId: user.id,
          wsAdd: pendingWs.filter((id) => !currentWs.includes(id)),
          wsRemove: currentWs.filter((id) => !pendingWs.includes(id)),
        });
      }
      toast.success('변경사항이 저장되었습니다.');
      onClose();
    } catch {
      toast.error('저장에 실패했습니다.');
    }
  };

  // ── 구독 액션 핸들러 ──

  const formatErr = (e: unknown) =>
    e instanceof Error ? e.message : '실패했습니다.';

  const submitChangeTier = async () => {
    if (!userWorkspaceId || !formTier) return;
    try {
      await changeTier.mutateAsync({
        workspaceId: userWorkspaceId,
        newTier: formTier,
      });
      toast.success('플랜이 변경되었습니다.');
      resetSubForm();
    } catch (e) {
      toast.error(`플랜 변경 실패: ${formatErr(e)}`);
    }
  };

  const submitExtend = async () => {
    if (!userWorkspaceId || !formEnd) return;
    try {
      await extendSub.mutateAsync({
        workspaceId: userWorkspaceId,
        newEndedAt: toContractEndIso(formEnd),
      });
      toast.success('계약 기간이 연장되었습니다.');
      resetSubForm();
    } catch (e) {
      toast.error(`기간 연장 실패: ${formatErr(e)}`);
    }
  };

  const submitNew = async () => {
    if (!userWorkspaceId || !formTier || !formStart || !formEnd) return;
    try {
      await renewSub.mutateAsync({
        workspaceId: userWorkspaceId,
        newTier: formTier,
        newStartedAt: toContractStartIso(formStart),
        newEndedAt: toContractEndIso(formEnd),
        contractType: formContractType,
      });
      toast.success('새 구독이 등록되었습니다.');
      resetSubForm();
    } catch (e) {
      toast.error(`구독 등록 실패: ${formatErr(e)}`);
    }
  };

  const submitPause = async () => {
    if (!userWorkspaceId) return;
    try {
      await pauseSub.mutateAsync({ workspaceId: userWorkspaceId });
      toast.success('구독이 일시 정지되었습니다.');
      resetSubForm();
    } catch (e) {
      toast.error(`정지 실패: ${formatErr(e)}`);
    }
  };

  const submitCancel = async () => {
    if (!userWorkspaceId) return;
    try {
      await cancelSub.mutateAsync({ workspaceId: userWorkspaceId });
      toast.success('구독이 해지되었습니다.');
      resetSubForm();
    } catch (e) {
      toast.error(`해지 실패: ${formatErr(e)}`);
    }
  };

  const submitCorrect = async () => {
    if (!sub || !formTier || !formStart || !formEnd) return;
    try {
      await correctSub.mutateAsync({
        subscriptionId: sub.id,
        tier: formTier,
        startedAt: toContractStartIso(formStart),
        endedAt: toContractEndIso(formEnd),
        contractType: formContractType,
      });
      toast.success('구독 정보가 정정되었습니다.');
      resetSubForm();
    } catch (e) {
      toast.error(`정정 실패: ${formatErr(e)}`);
    }
  };

  const submitDeleteScheduled = async () => {
    if (!sub) return;
    try {
      await deleteScheduled.mutateAsync({ subscriptionId: sub.id });
      toast.success('예약 구독이 취소되었습니다.');
      setConfirmDeleteOpen(false);
      resetSubForm();
    } catch (e) {
      toast.error(`예약 취소 실패: ${formatErr(e)}`);
    }
  };

  const assignedWs = filteredWs.filter((ws) => pendingWs.includes(ws.id));
  const unassignedWs = filteredWs.filter((ws) => !pendingWs.includes(ws.id));

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title="유저 상세"
      size="md"
      footer={
        isSuperAdmin && hasMainChanges ? (
          <Button onClick={handleSave} disabled={saving} fullWidth>
            {saving ? '저장 중...' : '권한·워크스페이스 변경 저장'}
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs text-slate-400">회사명</span>
            <p className="text-sm font-semibold text-slate-700">{user.company_name}</p>
          </div>
          <div>
            <span className="text-xs text-slate-400">이메일</span>
            <p className="text-sm text-slate-700">{user.email}</p>
          </div>
        </div>

        {canEditRole && !isUserRole ? (
          <div>
            <span className="text-xs font-semibold text-slate-600 mb-2 block">권한</span>
            <div className="flex gap-2">
              {(['user', 'admin', 'super_admin'] as ProfileRole[]).map((r) => (
                <AdminButton
                  key={r}
                  variant={pendingRole === r ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => handleRoleChange(r)}
                  disabled={saving || pendingRole === r}
                >
                  {ROLE_LABEL[r]}
                </AdminButton>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <span className="text-xs text-slate-400">권한</span>
            <p className="text-sm font-semibold text-slate-700">{ROLE_LABEL[user.role]}</p>
          </div>
        )}

        {isUserRole ? (
          <div className="flex flex-col gap-3">
            <div>
              <span className="text-xs font-semibold text-slate-600 mb-1 block">
                현재 계약
              </span>
              {sub ? (
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">{TIER_LABELS[sub.tier]}</span>
                  {' · '}
                  <span className="font-semibold">{CONTRACT_TYPE_LABELS[sub.contract_type]}</span>
                  {' · '}
                  {format(getContractStartDate(sub.started_at), 'yyyy-MM-dd')}
                  {' ~ '}
                  {format(getContractEndDate(sub.ended_at), 'yyyy-MM-dd')}
                  {subStatus === 'scheduled' && (
                    <span className="ml-2 inline-block rounded-full bg-amber-100 text-amber-700 text-[11px] px-2 py-0.5 font-medium align-middle">
                      {format(getContractStartDate(sub.started_at), 'M월 d일')} 시작 예정
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-slate-400">구독이 없습니다.</p>
              )}
            </div>

            {canEditSub && subMode === 'idle' && subStatus === 'active' && sub && (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <AdminButton size="sm" variant="primary" onClick={() => enterMode('change_tier')}>
                    플랜 변경
                  </AdminButton>
                  <AdminButton
                    size="sm"
                    variant="primary"
                    onClick={() => enterMode('extend')}
                    disabled={sub.contract_type === 'trial'}
                  >
                    기간 연장
                  </AdminButton>
                  <AdminButton size="sm" variant="secondary" onClick={() => enterMode('pause')}>
                    일시 정지
                  </AdminButton>
                  <AdminButton size="sm" variant="secondary" onClick={() => enterMode('cancel')}>
                    해지
                  </AdminButton>
                </div>
                {sub.contract_type === 'trial' && (
                  <p className="text-xs text-slate-500">
                    무료 체험은 최초 시작일부터 10일로 고정됩니다. 정식 전환은 정보 정정에서 변경할 수 있습니다.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => enterMode('correct')}
                  className="text-xs text-slate-500 hover:text-slate-700 self-start cursor-pointer"
                >
                  ✏ 정보 정정 (오타 수정)
                </button>
              </div>
            )}

            {canEditSub && subMode === 'idle' && subStatus === 'scheduled' && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-slate-500">
                  아직 시작 전인 예약 구독입니다. 시작일·티어를 정정하거나 예약을 취소할 수 있습니다.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <AdminButton size="sm" variant="primary" onClick={() => enterMode('correct')}>
                    정보 정정
                  </AdminButton>
                  <AdminButton
                    size="sm"
                    variant="secondary"
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    예약 취소
                  </AdminButton>
                </div>
              </div>
            )}

            {canEditSub && subMode === 'idle' && !sub && (
              <AdminButton size="sm" variant="primary" onClick={() => enterMode('new')}>
                새 구독 시작
              </AdminButton>
            )}

            {subMode !== 'idle' && (
              <div className="p-4 bg-slate-50 rounded-lg flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">
                    {subMode === 'change_tier' && '플랜 변경'}
                    {subMode === 'extend' && '기간 연장'}
                    {subMode === 'pause' && '일시 정지 확인'}
                    {subMode === 'cancel' && '해지 확인'}
                    {subMode === 'new' && '새 구독'}
                    {subMode === 'correct' && '정보 정정'}
                  </span>
                  <button
                    type="button"
                    onClick={resetSubForm}
                    className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    취소
                  </button>
                </div>

                {subMode === 'change_tier' && (
                  <>
                    <p className="text-xs text-slate-500">
                      현재 시점부터 새 플랜으로 변경됩니다. 변경 시점 기준으로 현 계약은
                      종료되고 새 row 가 생성됩니다.
                    </p>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">티어</label>
                      <TierPicker value={formTier} onChange={setFormTier} disabled={subBusy} />
                    </div>
                    <Button onClick={submitChangeTier} disabled={subBusy || !formTier} fullWidth>
                      {subBusy ? '변경 중...' : '플랜 변경 적용'}
                    </Button>
                  </>
                )}

                {subMode === 'extend' && activeSub && (
                  <>
                    <p className="text-xs text-slate-500">
                      현재 종료일{' '}
                      <span className="font-semibold">
                        {format(getContractEndDate(activeSub.ended_at), 'yyyy-MM-dd')}
                      </span>
                      {' '}이후로만 연장 가능합니다.
                    </p>
                    <DateInput value={formEnd} onChange={setFormEnd} disabled={subBusy} label="새 종료일" />
                    <Button onClick={submitExtend} disabled={subBusy || !formEnd} fullWidth>
                      {subBusy ? '연장 중...' : '기간 연장'}
                    </Button>
                  </>
                )}

                {subMode === 'pause' && (
                  <>
                    <p className="text-xs text-slate-700">
                      활성 구독을 즉시 정지합니다. 이후 보고서가 생성되지 않으며,
                      재개하려면 새 구독을 시작해야 합니다.
                    </p>
                    <Button onClick={submitPause} disabled={subBusy} fullWidth>
                      {subBusy ? '정지 중...' : '일시 정지 확인'}
                    </Button>
                  </>
                )}

                {subMode === 'cancel' && (
                  <>
                    <p className="text-xs text-red-700">
                      구독을 즉시 해지합니다. 이후 보고서가 생성되지 않습니다.
                    </p>
                    <Button onClick={submitCancel} disabled={subBusy} fullWidth>
                      {subBusy ? '해지 중...' : '해지 확인'}
                    </Button>
                  </>
                )}

                {subMode === 'new' && (
                  <>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">계약 유형</label>
                      <ContractTypePicker
                        value={formContractType}
                        onChange={handleContractTypeChange}
                        disabled={subBusy}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">티어</label>
                      <TierPicker value={formTier} onChange={setFormTier} disabled={subBusy} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">계약 기간</label>
                      <ContractPeriodPicker
                        startDate={formStart}
                        endDate={formEnd}
                        onChange={handleSubscriptionPeriodChange}
                        placeholder="시작일 ~ 종료일"
                        fixedDurationDays={
                          formContractType === 'trial' ? TRIAL_DURATION_DAYS : undefined
                        }
                      />
                    </div>
                    <Button
                      onClick={submitNew}
                      disabled={subBusy || !formTier || !formStart || !formEnd}
                      fullWidth
                    >
                      {subBusy ? '등록 중...' : '구독 등록'}
                    </Button>
                  </>
                )}

                {subMode === 'correct' && sub && (
                  <>
                    <p className="text-xs text-slate-500">
                      활성 구독의 잘못된 정보를 그대로 수정합니다 (history 안 남음).
                    </p>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">계약 유형</label>
                      <ContractTypePicker
                        value={formContractType}
                        onChange={handleContractTypeChange}
                        disabled={subBusy}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">티어</label>
                      <TierPicker value={formTier} onChange={setFormTier} disabled={subBusy} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">계약 기간</label>
                      <ContractPeriodPicker
                        startDate={formStart}
                        endDate={formEnd}
                        onChange={handleSubscriptionPeriodChange}
                        placeholder="시작일 ~ 종료일"
                        disabled={
                          sub.contract_type === 'trial'
                          && formContractType === 'trial'
                          && sub.trial_started_at !== null
                        }
                        fixedDurationDays={
                          formContractType === 'trial' ? TRIAL_DURATION_DAYS : undefined
                        }
                      />
                      {sub.contract_type === 'trial'
                        && formContractType === 'trial'
                        && sub.trial_started_at && (
                          <p className="mt-1.5 text-[11px] text-slate-500">
                            최초 무료 체험 시작일은 변경할 수 없습니다.
                          </p>
                        )}
                    </div>
                    <Button
                      onClick={submitCorrect}
                      disabled={subBusy || !formTier || !formStart || !formEnd}
                      fullWidth
                    >
                      {subBusy ? '저장 중...' : '정정 저장'}
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* ── AI 분석 토큰 ─────────────────────────── */}
            <div className="pt-3 mt-1 border-t border-slate-100 flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-600">
                AI 분석 토큰
              </span>
              {initialTokens ? (
                <div className="text-sm text-slate-700 flex items-center gap-4">
                  <div>
                    <span className="text-[11px] text-slate-400 mr-1.5">잔여</span>
                    <span className={`font-semibold tabular-nums ${initialTokens.token_balance <= 0 ? 'text-red-500' : 'text-slate-800'}`}>
                      {initialTokens.token_balance.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 mr-1.5">월 충전</span>
                    <span className="font-semibold tabular-nums text-slate-700">
                      {initialTokens.monthly_quota.toLocaleString()}
                    </span>
                  </div>
                  {initialTokens.last_charged_at && (
                    <div className="text-[11px] text-slate-400">
                      최근 충전 {format(parseISO(initialTokens.last_charged_at), 'yyyy-MM-dd')}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">워크스페이스 정보가 없습니다.</p>
              )}

              {isSuperAdmin && initialTokens && (
                <div className="mt-2 p-3 bg-slate-50 rounded-lg flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">월 충전량 (절대값)</label>
                      <input
                        type="number"
                        min={0}
                        value={tokenQuotaInput}
                        onChange={(e) => setTokenQuotaInput(e.target.value)}
                        disabled={updateTokens.isPending}
                        className="w-full text-sm border border-slate-200 rounded-md px-2.5 py-1.5 outline-none focus:border-slate-400 tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">잔여 추가 (delta)</label>
                      <input
                        type="number"
                        value={tokenAddInput}
                        onChange={(e) => setTokenAddInput(e.target.value)}
                        disabled={updateTokens.isPending}
                        placeholder="음수 = 차감"
                        className="w-full text-sm border border-slate-200 rounded-md px-2.5 py-1.5 outline-none focus:border-slate-400 tabular-nums"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={async () => {
                      const quotaNum = tokenQuotaInput === '' ? undefined : Number(tokenQuotaInput);
                      const addNum = tokenAddInput === '' ? undefined : Number(tokenAddInput);
                      const quotaChanged = quotaNum !== undefined && quotaNum !== initialTokens.monthly_quota;
                      const addProvided = addNum !== undefined && addNum !== 0;
                      if (!quotaChanged && !addProvided) {
                        toast.info('변경 사항이 없습니다.');
                        return;
                      }
                      try {
                        await updateTokens.mutateAsync({
                          workspaceId: initialTokens.id,
                          monthly_quota: quotaChanged ? quotaNum : undefined,
                          add_tokens: addProvided ? addNum : undefined,
                        });
                        toast.success('토큰 정보가 업데이트되었습니다.');
                      } catch (e) {
                        toast.error(`토큰 수정 실패: ${formatErr(e)}`);
                      }
                    }}
                    disabled={updateTokens.isPending}
                    fullWidth
                  >
                    {updateTokens.isPending ? '저장 중...' : '토큰 저장'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-slate-600">
              워크스페이스 배정
            </span>

            <input
              value={wsSearch}
              onChange={(e) => setWsSearch(e.target.value)}
              placeholder="회사명 또는 종목코드로 검색"
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400"
            />

            <div>
              <span className="text-[11px] font-semibold text-slate-500 mb-1.5 block">
                담당 중 ({pendingWs.length}개)
              </span>
              {assignedWs.length > 0 ? (
                <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto">
                  {assignedWs.map((ws) => (
                    <div
                      key={ws.id}
                      className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-slate-700 truncate">{ws.company_name}</span>
                        <span className="text-xs text-slate-400 shrink-0">{ws.ticker}</span>
                      </div>
                      {canEditWorkspace && (
                        <button
                          type="button"
                          onClick={() => handleWorkspaceToggle(ws.id)}
                          disabled={saving}
                          className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer shrink-0 ml-2"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-2">
                  {wsSearch.trim() ? '검색 결과에 담당 워크스페이스가 없습니다.' : '배정된 워크스페이스가 없습니다.'}
                </p>
              )}
            </div>

            {canEditWorkspace && (
              <div>
                <span className="text-[11px] font-semibold text-slate-500 mb-1.5 block">
                  미배정
                </span>
                {unassignedWs.length > 0 ? (
                  <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto">
                    {unassignedWs.map((ws) => (
                      <div
                        key={ws.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm text-slate-700 truncate">{ws.company_name}</span>
                          <span className="text-xs text-slate-400 shrink-0">{ws.ticker}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleWorkspaceToggle(ws.id)}
                          disabled={saving}
                          className="text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer shrink-0 ml-2"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-2">
                    {wsSearch.trim() ? '검색 결과가 없습니다.' : '모든 워크스페이스가 배정되었습니다.'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {isSuperAdmin && (
          <PasswordResetSection userId={user.id} userEmail={user.email} />
        )}
      </div>
    </Modal>
    <ConfirmModal
      open={confirmDeleteOpen}
      onClose={() => setConfirmDeleteOpen(false)}
      onConfirm={submitDeleteScheduled}
      title="예약 구독 취소"
      message={
        sub
          ? `${TIER_LABELS[sub.tier]} · ${format(getContractStartDate(sub.started_at), 'yyyy-MM-dd')} 시작 예약을 취소(삭제)합니다. 되돌릴 수 없습니다.`
          : ''
      }
      confirmLabel="예약 취소"
      confirmVariant="danger"
      loading={deleteScheduled.isPending}
    />
    </>
  );
}

function DateInput({
  value,
  onChange,
  disabled,
  label,
}: {
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  disabled?: boolean;
  label: string;
}) {
  const isoDate = value ? format(value, 'yyyy-MM-dd') : '';
  return (
    <div>
      <label className="text-xs text-slate-500 mb-1 block">{label}</label>
      <input
        type="date"
        value={isoDate}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            onChange(undefined);
            return;
          }
          const [year, month, day] = v.split('-').map(Number);
          onChange(new Date(year, month - 1, day));
        }}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400"
      />
    </div>
  );
}
