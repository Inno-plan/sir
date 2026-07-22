import { createClient } from '@/lib/supabase/client';
import type { ProfileRole } from '@/types/auth';
import type { ContractType, Tier } from '@/types/subscription';
import type { Subscription } from '@/lib/api/subscriptionApi';

const supabase = createClient();

// ── 유저 목록 ──

export interface UserProfile {
  id: string;
  email: string;
  company_name: string;
  role: ProfileRole;
  created_at: string;
}

export async function getUsers(): Promise<UserProfile[]> {
  const { data } = await supabase
    .from('user_profiles')
    .select('id, email, company_name, role, created_at')
    .order('created_at', { ascending: false });
  return (data ?? []) as UserProfile[];
}

// ── 유저 목록 + 워크스페이스/구독 상세 ──

export interface UserWorkspace {
  id: string;
  company_name: string;
  ticker: string;
}

export interface UserWithDetails extends UserProfile {
  /** role='user' 인 경우 배정된 단일 워크스페이스 */
  workspace?: UserWorkspace;
  /** role='user' 인 경우 해당 워크스페이스의 활성 또는 예약(미래 시작) 구독 */
  subscription?: Subscription;
  /** 배정된 워크스페이스 id 목록 (admin/super_admin 은 복수 가능) */
  workspaceIds: string[];
  /** 배정된 워크스페이스 수 */
  workspaceCount: number;
}

/**
 * 유저 목록을 가져오면서 각 유저의 배정 워크스페이스 + 활성 구독까지 함께 반환.
 * 리스트 렌더 시 계약 기간/상태를 표시하기 위해 사용.
 */
export async function getUsersWithDetails(): Promise<UserWithDetails[]> {
  const nowIso = new Date().toISOString();

  const [usersR, membersR, workspacesR, subsR] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id, email, company_name, role, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('workspace_members').select('workspace_id, profile_id'),
    supabase.from('workspaces').select('id, company_name, ticker'),
    // 활성(started<=now<ended) + 예약(started>now) 모두. ended<=now(만료)만 제외.
    // started_at 오름차순 → 워크스페이스별 첫 row = 활성(있으면) 또는 가장 이른 예약.
    supabase
      .from('subscriptions')
      .select('*')
      .gt('ended_at', nowIso)
      .order('started_at', { ascending: true }),
  ]);

  const users = (usersR.data ?? []) as UserProfile[];
  const members = (membersR.data ?? []) as { workspace_id: string; profile_id: string }[];
  const workspaces = (workspacesR.data ?? []) as UserWorkspace[];
  const subs = (subsR.data ?? []) as Subscription[];

  const wsById = new Map(workspaces.map((w) => [w.id, w]));
  const subByWorkspace = new Map<string, Subscription>();
  for (const s of subs) {
    if (!subByWorkspace.has(s.workspace_id)) {
      subByWorkspace.set(s.workspace_id, s);
    }
  }

  return users.map<UserWithDetails>((u) => {
    const wsIds = members
      .filter((m) => m.profile_id === u.id)
      .map((m) => m.workspace_id);

    const isUser = u.role === 'user';
    const firstWsId = isUser ? wsIds[0] : undefined;

    return {
      ...u,
      workspace: firstWsId ? wsById.get(firstWsId) : undefined,
      subscription: firstWsId ? subByWorkspace.get(firstWsId) : undefined,
      workspaceIds: wsIds,
      workspaceCount: wsIds.length,
    };
  });
}

// ── 워크스페이스 AI 토큰 (Next route handler 경유) ──
// /api/admin/create-user 와 동일 패턴 — Next 서버가 service_role 키로 supabase 직접 조작.
// 062 마이그로 workspaces 에 추가된 token_balance/monthly_quota.

export interface WorkspaceTokens {
  id: string;
  company_name: string;
  token_balance: number;
  monthly_quota: number;
  last_charged_at: string | null;
}

export async function getWorkspaceTokens(): Promise<WorkspaceTokens[]> {
  const res = await fetch('/api/admin/workspace-tokens', { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? '토큰 조회 실패');
  }
  return res.json();
}

export async function updateWorkspaceTokens(
  workspaceId: string,
  patch: { monthly_quota?: number; add_tokens?: number },
): Promise<WorkspaceTokens> {
  const res = await fetch(`/api/admin/workspace-tokens/${workspaceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? '토큰 수정 실패');
  }
  return res.json();
}


// ── 유저 생성 (Route Handler 경유) ──

export async function createUser(params: {
  email: string;
  password: string;
  role: ProfileRole;
  company_name: string;
  ticker?: string;
  industry?: string;
  business_summary?: string;
  tier?: Tier;
  contract_type?: ContractType;
  subscription_start?: string;
  subscription_end?: string;
}): Promise<{ id: string; email: string }> {
  const res = await fetch('/api/admin/create-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail ?? '계정 생성 실패');
  }
  return res.json();
}

// ── 비밀번호 재설정 (Route Handler 경유, super_admin 전용) ──
// 원래 비밀번호 없이 service_role 키로 강제 변경. 서버 route 가 super_admin 가드.

export async function resetUserPassword(
  userId: string,
  password: string,
): Promise<void> {
  const res = await fetch('/api/admin/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? '비밀번호 재설정 실패');
  }
}

// ── 현재 유저 역할 ──

export async function getCurrentRole(): Promise<ProfileRole> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'user';
  const { data } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
  return (data?.role ?? 'user') as ProfileRole;
}

// ── 역할 변경 ──

export async function updateUserRole(userId: string, role: ProfileRole): Promise<void> {
  const { error } = await supabase.from('user_profiles').update({ role }).eq('id', userId);
  if (error) throw error;
}

// ── 워크스페이스 멤버 ──

export interface WorkspaceMember {
  workspace_id: string;
  profile_id: string;
  role: string;
}

export async function getWorkspaceMembers(): Promise<WorkspaceMember[]> {
  const { data } = await supabase.from('workspace_members').select('workspace_id, profile_id, role');
  return (data ?? []) as WorkspaceMember[];
}

export async function assignWorkspace(workspaceId: string, profileId: string): Promise<void> {
  // 대상 유저의 user_profiles.role 을 조회해 workspace_members.role 에 동일하게 반영
  const { data: profile, error: pErr } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', profileId)
    .single();
  if (pErr) throw pErr;

  const { error } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: workspaceId, profile_id: profileId, role: profile.role });
  if (error) throw error;
}

export async function removeWorkspace(workspaceId: string, profileId: string): Promise<void> {
  const { error } = await supabase.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('profile_id', profileId);
  if (error) throw error;
}
