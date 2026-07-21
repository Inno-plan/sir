import { createClient } from '@/lib/supabase/client';
import type { Tier } from '@/types/subscription';

const supabase = createClient();

export interface Subscription {
  id: string;
  workspace_id: string;
  tier: Tier;
  started_at: string;
  ended_at: string;
  has_daily: boolean;
  has_armor: boolean;
  has_booster: boolean;
  reason: string | null;
  created_at: string;
}

export interface SubscriptionExpiryNoticeDismissal {
  profile_id: string;
  subscription_id: string;
  acknowledged_ended_at: string;
  dismissed_until: string;
  dismissed_at: string;
}

/** 워크스페이스의 현재 활성 구독 조회 — started_at <= NOW < ended_at 인 단일 row */
export async function getActiveSubscription(
  workspaceId: string,
): Promise<Subscription | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .lte('started_at', nowIso)
    .gt('ended_at', nowIso)
    .maybeSingle();

  if (error) throw error;

  return (data as Subscription | null) ?? null;
}

/** 사용자별 계약 만료 안내 숨김 상태 조회 */
export async function getSubscriptionExpiryNoticeDismissal(input: {
  profileId: string;
  subscriptionId: string;
}): Promise<SubscriptionExpiryNoticeDismissal | null> {
  const { data, error } = await supabase
    .from('subscription_expiry_notice_dismissals')
    .select('*')
    .eq('profile_id', input.profileId)
    .eq('subscription_id', input.subscriptionId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** 현재 계약 종료일까지 만료 안내 숨김 */
export async function dismissSubscriptionExpiryNotice(input: {
  profileId: string;
  subscriptionId: string;
  endedAt: string;
}): Promise<SubscriptionExpiryNoticeDismissal> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('subscription_expiry_notice_dismissals')
    .upsert(
      {
        profile_id: input.profileId,
        subscription_id: input.subscriptionId,
        acknowledged_ended_at: input.endedAt,
        dismissed_until: input.endedAt,
        dismissed_at: nowIso,
      },
      { onConflict: 'profile_id,subscription_id' },
    )
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export type SubscriptionStatus = 'active' | 'scheduled';

export interface CurrentOrUpcomingSubscription {
  subscription: Subscription;
  /** active = 지금 진행 중 / scheduled = 미래 시작 예약 */
  status: SubscriptionStatus;
}

/**
 * 현재 또는 다가오는 구독 1건 조회.
 * 아직 안 끝난(ended_at > NOW) segment 중 started_at 이 가장 이른 것을 고른다.
 * - 활성(started_at <= NOW) segment 가 있으면 그게 먼저 잡혀 status='active'
 * - 없고 미래 시작 segment 만 있으면 status='scheduled'
 * 관리자 모달에서 예약 구독도 인식·관리하기 위한 조회.
 */
export async function getCurrentOrUpcomingSubscription(
  workspaceId: string,
): Promise<CurrentOrUpcomingSubscription | null> {
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .gt('ended_at', nowIso)
    .order('started_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const sub = (data as Subscription | null) ?? null;
  if (!sub) return null;
  return {
    subscription: sub,
    status: new Date(sub.started_at).getTime() <= Date.now() ? 'active' : 'scheduled',
  };
}

/** 중간 구독제 변경: 활성 row 자르고 새 tier 로 새 row INSERT (DB transaction). */
export async function changeSubscriptionTier(input: {
  workspaceId: string;
  newTier: Tier;
  effectiveAt?: string; // ISO, default NOW
}): Promise<string> {
  const { data, error } = await supabase.rpc('change_subscription_tier', {
    p_workspace_id: input.workspaceId,
    p_new_tier: input.newTier,
    p_effective_at: input.effectiveAt ?? new Date().toISOString(),
  });
  if (error) throw error;
  return data as string;
}

/** 같은 tier 로 기간 연장 — 활성 row.ended_at UPDATE. */
export async function extendSubscription(input: {
  workspaceId: string;
  newEndedAt: string; // ISO
}): Promise<string> {
  const { data, error } = await supabase.rpc('extend_subscription', {
    p_workspace_id: input.workspaceId,
    p_new_ended_at: input.newEndedAt,
  });
  if (error) throw error;
  return data as string;
}

/** 갱신 — 새 계약 row INSERT. 옛 row 와 시간 겹치면 EXCLUDE 가 거부. */
export async function renewSubscription(input: {
  workspaceId: string;
  newTier: Tier;
  newStartedAt: string;
  newEndedAt: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('renew_subscription', {
    p_workspace_id: input.workspaceId,
    p_new_tier: input.newTier,
    p_new_started_at: input.newStartedAt,
    p_new_ended_at: input.newEndedAt,
  });
  if (error) throw error;
  return data as string;
}

/** 일시 정지 — 활성 row.ended_at = pause_at. */
export async function pauseSubscription(input: {
  workspaceId: string;
  pauseAt?: string; // ISO, default NOW
}): Promise<string> {
  const { data, error } = await supabase.rpc('pause_subscription', {
    p_workspace_id: input.workspaceId,
    p_pause_at: input.pauseAt ?? new Date().toISOString(),
  });
  if (error) throw error;
  return data as string;
}

/** 중간 해지 — 활성 row.ended_at = cancel_at. */
export async function cancelSubscription(input: {
  workspaceId: string;
  cancelAt?: string; // ISO, default NOW
}): Promise<string> {
  const { data, error } = await supabase.rpc('cancel_subscription', {
    p_workspace_id: input.workspaceId,
    p_cancel_at: input.cancelAt ?? new Date().toISOString(),
  });
  if (error) throw error;
  return data as string;
}

/** 예약(미시작) 구독 취소 — started_at > NOW 인 row 만 삭제 (RPC 가드). */
export async function deleteScheduledSubscription(input: {
  subscriptionId: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('delete_scheduled_subscription', {
    p_subscription_id: input.subscriptionId,
  });
  if (error) throw error;
  return data as string;
}

/** 어드민 정정 — 의미상 변경 아닌 오타/날짜 정정. UPDATE in place. */
export async function correctSubscription(input: {
  subscriptionId: string;
  tier?: Tier;
  startedAt?: string;
  endedAt?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('correct_subscription', {
    p_subscription_id: input.subscriptionId,
    ...(input.tier !== undefined && { p_tier: input.tier }),
    ...(input.startedAt !== undefined && { p_started_at: input.startedAt }),
    ...(input.endedAt !== undefined && { p_ended_at: input.endedAt }),
  });
  if (error) throw error;
  return data as string;
}
