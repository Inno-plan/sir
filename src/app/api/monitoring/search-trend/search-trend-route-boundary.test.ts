import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/monitoring/search-trend/route';

const mocks = vi.hoisted(() => {
  type WorkspaceResponse = {
    data: { company_name: string | null } | null;
    error: Error | null;
  };

  const getUser = vi.fn();
  const fetch = vi.fn();
  const workspaceResponse: WorkspaceResponse = {
    data: { company_name: '테스트회사' },
    error: null,
  };

  const workspaceMaybeSingle = vi.fn(async () => workspaceResponse);

  function createWorkspaceQuery() {
    const query = {
      eq: vi.fn(() => query),
      maybeSingle: workspaceMaybeSingle,
      select: vi.fn(() => query),
    };
    return query;
  }

  const serverFrom = vi.fn((table: string) => {
    if (table !== 'workspaces') {
      throw new Error(`unexpected server table: ${table}`);
    }
    return createWorkspaceQuery();
  });

  const createServerClient = vi.fn(async () => ({
    auth: {
      getUser,
    },
    from: serverFrom,
  }));

  const createSupabaseClient = vi.fn(() => {
    throw new Error('service-role client should not be created before RLS access check passes');
  });

  function resetState() {
    workspaceResponse.data = { company_name: '테스트회사' };
    workspaceResponse.error = null;
  }

  return {
    createServerClient,
    createSupabaseClient,
    fetch,
    getUser,
    resetState,
    serverFrom,
    workspaceMaybeSingle,
    workspaceResponse,
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createServerClient,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createSupabaseClient,
}));

function authenticate() {
  mocks.getUser.mockResolvedValueOnce({
    data: {
      user: {
        id: 'caller-user-id',
      },
    },
    error: null,
  });
}

function rejectUnauthenticated() {
  mocks.getUser.mockResolvedValueOnce({
    data: {
      user: null,
    },
    error: null,
  });
}

function requestWithBody(body: string): NextRequest {
  return new Request('http://localhost/api/monitoring/search-trend', {
    body,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  }) as NextRequest;
}

async function expectJsonResponse(
  response: Response,
  status: number,
  payload: Record<string, unknown>,
) {
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toEqual(payload);
}

function expectNoServiceRoleBoundaryCrossing() {
  expect(mocks.createSupabaseClient).not.toHaveBeenCalled();
  expect(mocks.fetch).not.toHaveBeenCalled();
}

describe('search-trend RLS-before-service-role boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetState();
    delete process.env.NAVER_CLIENT_ID;
    delete process.env.NAVER_CLIENT_SECRET;
    process.env.NAVER_API_HUB_CLIENT_ID = 'naver-api-hub-client-id';
    process.env.NAVER_API_HUB_CLIENT_SECRET = 'naver-api-hub-client-secret';
    vi.stubGlobal('fetch', mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects unauthenticated callers before body/RLS/service-role work', async () => {
    rejectUnauthenticated();

    const response = await POST(requestWithBody(JSON.stringify({
      workspace_id: 'workspace-id',
    })));

    await expectJsonResponse(response, 401, { error: '로그인이 필요합니다' });
    expect(mocks.serverFrom).not.toHaveBeenCalled();
    expectNoServiceRoleBoundaryCrossing();
  });

  it('rejects malformed JSON before RLS/service-role work', async () => {
    authenticate();

    const response = await POST(requestWithBody('{ broken json'));

    await expectJsonResponse(response, 400, { error: '유효한 JSON body 필요' });
    expect(mocks.serverFrom).not.toHaveBeenCalled();
    expectNoServiceRoleBoundaryCrossing();
  });

  it('rejects missing workspace_id before RLS/service-role work', async () => {
    authenticate();

    const response = await POST(requestWithBody(JSON.stringify({})));

    await expectJsonResponse(response, 400, { error: 'workspace_id 누락' });
    expect(mocks.serverFrom).not.toHaveBeenCalled();
    expectNoServiceRoleBoundaryCrossing();
  });

  it('rejects blank workspace_id before RLS/service-role work', async () => {
    authenticate();

    const response = await POST(requestWithBody(JSON.stringify({
      workspace_id: '   ',
    })));

    await expectJsonResponse(response, 400, { error: 'workspace_id 누락' });
    expect(mocks.serverFrom).not.toHaveBeenCalled();
    expectNoServiceRoleBoundaryCrossing();
  });

  it('rejects RLS-invisible workspaces before service-role cache access', async () => {
    authenticate();
    mocks.workspaceResponse.data = null;

    const response = await POST(requestWithBody(JSON.stringify({
      workspace_id: 'workspace-id',
    })));

    await expectJsonResponse(response, 404, { error: '워크스페이스 접근 권한 없음' });
    expect(mocks.workspaceMaybeSingle).toHaveBeenCalledOnce();
    expectNoServiceRoleBoundaryCrossing();
  });

  it('returns workspace lookup errors before service-role cache access', async () => {
    authenticate();
    mocks.workspaceResponse.error = new Error('workspace query failed');

    const response = await POST(requestWithBody(JSON.stringify({
      workspace_id: 'workspace-id',
    })));

    await expectJsonResponse(response, 500, { error: 'workspace query failed' });
    expect(mocks.workspaceMaybeSingle).toHaveBeenCalledOnce();
    expectNoServiceRoleBoundaryCrossing();
  });

  it('rejects accessible workspaces without company_name before service-role cache access', async () => {
    authenticate();
    mocks.workspaceResponse.data = { company_name: null };

    const response = await POST(requestWithBody(JSON.stringify({
      workspace_id: 'workspace-id',
    })));

    await expectJsonResponse(response, 400, { error: 'company_name 미설정' });
    expect(mocks.workspaceMaybeSingle).toHaveBeenCalledOnce();
    expectNoServiceRoleBoundaryCrossing();
  });
});
