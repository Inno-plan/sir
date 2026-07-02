import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getRiskNoticeRead,
  markRiskNoticeRead,
} from '@/lib/api/reportApi';

const mocks = vi.hoisted(() => {
  const getSession = vi.fn();
  const getUser = vi.fn();
  const from = vi.fn();
  const riskNoticeEq = vi.fn();
  const riskNoticeMaybeSingle = vi.fn();
  const riskNoticeUpsert = vi.fn();
  const profileEq = vi.fn();
  const profileSingle = vi.fn();

  function createRiskNoticeQuery() {
    const query = {
      eq: vi.fn((...args: unknown[]) => {
        riskNoticeEq(...args);
        return query;
      }),
      maybeSingle: riskNoticeMaybeSingle,
      select: vi.fn(() => query),
      upsert: riskNoticeUpsert,
    };
    return query;
  }

  function createProfileQuery() {
    const query = {
      eq: vi.fn((...args: unknown[]) => {
        profileEq(...args);
        return query;
      }),
      select: vi.fn(() => query),
      single: profileSingle,
    };
    return query;
  }

  const createClient = vi.fn(() => ({
    auth: {
      getSession,
      getUser,
    },
    from: (table: string) => {
      from(table);
      if (table === 'risk_notice_reads') return createRiskNoticeQuery();
      if (table === 'user_profiles') return createProfileQuery();
      throw new Error(`unexpected table: ${table}`);
    },
  }));

  return {
    createClient,
    from,
    getSession,
    getUser,
    profileEq,
    profileSingle,
    riskNoticeEq,
    riskNoticeMaybeSingle,
    riskNoticeUpsert,
  };
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: mocks.createClient,
}));

function authenticate() {
  mocks.getSession.mockResolvedValue({
    data: {
      session: {
        access_token: 'access-token',
      },
    },
  });
  mocks.getUser.mockResolvedValue({
    data: {
      user: {
        id: 'profile-id',
      },
    },
  });
}

describe('risk_notice_reads API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    authenticate();
    mocks.riskNoticeMaybeSingle.mockResolvedValue({
      data: {
        latest_seen_risk_at: '2026-07-01T00:00:00.000Z',
      },
      error: null,
    });
    mocks.profileSingle.mockResolvedValue({
      data: {
        role: 'user',
      },
      error: null,
    });
    mocks.riskNoticeUpsert.mockResolvedValue({ error: null });
  });

  it('returns unread state without querying risk_notice_reads when there is no session', async () => {
    mocks.getSession.mockResolvedValueOnce({
      data: {
        session: null,
      },
    });

    await expect(getRiskNoticeRead('workspace-id')).resolves.toEqual({
      latestSeenRiskAt: null,
    });

    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('reads latest_seen_risk_at for the authenticated profile and workspace', async () => {
    await expect(getRiskNoticeRead('workspace-id')).resolves.toEqual({
      latestSeenRiskAt: '2026-07-01T00:00:00.000Z',
    });

    expect(mocks.from).toHaveBeenCalledWith('risk_notice_reads');
    expect(mocks.riskNoticeEq).toHaveBeenCalledWith('profile_id', 'profile-id');
    expect(mocks.riskNoticeEq).toHaveBeenCalledWith('workspace_id', 'workspace-id');
  });

  it('normalizes missing read rows to an unread state', async () => {
    mocks.riskNoticeMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(getRiskNoticeRead('workspace-id')).resolves.toEqual({
      latestSeenRiskAt: null,
    });
  });

  it('throws a domain error when read-state lookup fails', async () => {
    mocks.riskNoticeMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: new Error('select failed'),
    });

    await expect(getRiskNoticeRead('workspace-id')).rejects.toThrow(
      '리스크 알림 확인 상태 조회 실패: select failed',
    );
  });

  it('does not write read-state when there is no session', async () => {
    mocks.getSession.mockResolvedValueOnce({
      data: {
        session: null,
      },
    });

    await markRiskNoticeRead('workspace-id', '2026-07-02T00:00:00.000Z');

    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.riskNoticeUpsert).not.toHaveBeenCalled();
  });

  it('does not write read-state for admin preview users', async () => {
    mocks.profileSingle.mockResolvedValueOnce({
      data: {
        role: 'admin',
      },
      error: null,
    });

    await markRiskNoticeRead('workspace-id', '2026-07-02T00:00:00.000Z');

    expect(mocks.from).toHaveBeenCalledWith('user_profiles');
    expect(mocks.profileEq).toHaveBeenCalledWith('id', 'profile-id');
    expect(mocks.riskNoticeUpsert).not.toHaveBeenCalled();
  });

  it('upserts latest risk read-state for client users', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-02T03:04:05.000Z'));

    await markRiskNoticeRead('workspace-id', '2026-07-02T00:00:00.000Z');

    expect(mocks.riskNoticeUpsert).toHaveBeenCalledWith(
      {
        profile_id: 'profile-id',
        workspace_id: 'workspace-id',
        latest_seen_risk_at: '2026-07-02T00:00:00.000Z',
        seen_at: '2026-07-02T03:04:05.000Z',
      },
      { onConflict: 'profile_id,workspace_id' },
    );
  });

  it('throws a domain error when read-state upsert fails', async () => {
    mocks.riskNoticeUpsert.mockResolvedValueOnce({
      error: new Error('upsert failed'),
    });

    await expect(
      markRiskNoticeRead('workspace-id', '2026-07-02T00:00:00.000Z'),
    ).rejects.toThrow('리스크 알림 확인 상태 저장 실패: upsert failed');
  });
});
