import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH as patchRiskReport } from '@/app/api/risk-report/[id]/route';
import { POST as requestRiskReport } from '@/app/api/risk-report/request/route';

const mocks = vi.hoisted(() => {
  type ProfileRole = 'admin' | 'super_admin' | 'user';
  type RiskReportRow = {
    file_urls: string[];
    id: string;
    workspace_id: string;
  };
  type QueryResponse = {
    data: unknown;
    error: Error | null;
  };

  const state: {
    membership: { id: string } | null;
    membershipError: Error | null;
    profileError: Error | null;
    profileRole: ProfileRole;
    riskReport: RiskReportRow | null;
    riskReportError: Error | null;
  } = {
    membership: { id: 'membership-id' },
    membershipError: null,
    profileError: null,
    profileRole: 'super_admin',
    riskReport: {
      file_urls: [],
      id: 'risk-report-id',
      workspace_id: 'workspace-id',
    },
    riskReportError: null,
  };

  const getUser = vi.fn();
  const updateRiskReport = vi.fn();
  const removeAttachments = vi.fn(async () => ({ error: null }));

  function resetState() {
    state.membership = { id: 'membership-id' };
    state.membershipError = null;
    state.profileError = null;
    state.profileRole = 'super_admin';
    state.riskReport = {
      file_urls: [],
      id: 'risk-report-id',
      workspace_id: 'workspace-id',
    };
    state.riskReportError = null;
  }

  function tableResponse(table: string): QueryResponse {
    if (table === 'user_profiles') {
      return {
        data: { role: state.profileRole },
        error: state.profileError,
      };
    }
    if (table === 'risk_reports') {
      return {
        data: state.riskReport,
        error: state.riskReportError,
      };
    }
    if (table === 'workspace_members') {
      return {
        data: state.membership,
        error: state.membershipError,
      };
    }
    return {
      data: null,
      error: null,
    };
  }

  function createQuery(table: string) {
    const query = {
      eq: vi.fn(() => query),
      gt: vi.fn(() => query),
      insert: vi.fn(() => query),
      limit: vi.fn(() => query),
      lte: vi.fn(() => query),
      maybeSingle: vi.fn(async () => tableResponse(table)),
      select: vi.fn(() => query),
      single: vi.fn(async () => ({ data: { id: 'inserted-risk-report-id' }, error: null })),
      update: vi.fn((payload: Record<string, unknown>) => {
        updateRiskReport(payload);
        return query;
      }),
    };
    return query;
  }

  const createServerClient = vi.fn(async () => ({
    auth: {
      getUser,
    },
  }));
  const createSupabaseClient = vi.fn(() => ({
    from: (table: string) => createQuery(table),
    storage: {
      from: () => ({
        remove: removeAttachments,
      }),
    },
  }));

  return {
    createServerClient,
    createSupabaseClient,
    getUser,
    removeAttachments,
    resetState,
    state,
    updateRiskReport,
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createServerClient,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createSupabaseClient,
}));

type ValidationCase = {
  body: string;
  detail: string;
  name: string;
};

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
  return new Request('http://localhost/api/risk-report/test', {
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

function patchContext(id = 'risk-report-id') {
  return {
    params: Promise.resolve({ id }),
  };
}

describe('risk-report request route validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetState();
  });

  it('rejects unauthenticated callers before service-role client creation', async () => {
    rejectUnauthenticated();

    const response = await requestRiskReport(requestWithBody(JSON.stringify({})));

    await expectJsonResponse(response, 401, { detail: '인증 필요' });
    expect(mocks.createSupabaseClient).not.toHaveBeenCalled();
  });

  const invalidRequestCases: ValidationCase[] = [
    {
      name: 'malformed JSON',
      body: '{ broken json',
      detail: 'JSON body가 필요합니다',
    },
    {
      name: 'array body',
      body: JSON.stringify([]),
      detail: '잘못된 요청 body입니다',
    },
    {
      name: 'missing required fields',
      body: JSON.stringify({
        workspace_id: 'workspace-id',
      }),
      detail: '필수 요청값이 올바르지 않습니다',
    },
    {
      name: 'non-string source id',
      body: JSON.stringify({
        evidence: 'evidence',
        file_urls: [],
        platform_id: 'naver_news',
        reason: 'reason',
        report_id: 'report-id',
        source_id: 123,
        workspace_id: 'workspace-id',
      }),
      detail: '필수 요청값이 올바르지 않습니다',
    },
    {
      name: 'unknown platform',
      body: JSON.stringify({
        evidence: 'evidence',
        file_urls: [],
        platform_id: 'unknown',
        reason: 'reason',
        report_id: 'report-id',
        source_id: 'source-id',
        workspace_id: 'workspace-id',
      }),
      detail: '알 수 없는 platform: unknown',
    },
    {
      name: 'attachment outside workspace prefix',
      body: JSON.stringify({
        evidence: 'evidence',
        file_urls: ['other-workspace/file.png'],
        platform_id: 'naver_news',
        reason: 'reason',
        report_id: 'report-id',
        source_id: 'source-id',
        workspace_id: 'workspace-id',
      }),
      detail: '첨부 파일 경로가 올바르지 않습니다',
    },
  ];

  for (const validationCase of invalidRequestCases) {
    it(`rejects ${validationCase.name} before service-role client creation`, async () => {
      authenticate();

      const response = await requestRiskReport(requestWithBody(validationCase.body));

      await expectJsonResponse(response, 400, { detail: validationCase.detail });
      expect(mocks.createSupabaseClient).not.toHaveBeenCalled();
    });
  }
});

describe('risk-report update route auth and validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetState();
  });

  it('rejects unauthenticated callers before service-role client creation', async () => {
    rejectUnauthenticated();

    const response = await patchRiskReport(
      requestWithBody(JSON.stringify({ status: 'resolved' })),
      patchContext(),
    );

    await expectJsonResponse(response, 401, { detail: '인증 필요' });
    expect(mocks.createSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects missing risk report id before service-role client creation', async () => {
    authenticate();

    const response = await patchRiskReport(
      requestWithBody(JSON.stringify({ status: 'resolved' })),
      patchContext(''),
    );

    await expectJsonResponse(response, 400, { detail: 'risk report id 필수' });
    expect(mocks.createSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects non-admin callers before loading a risk item', async () => {
    authenticate();
    mocks.state.profileRole = 'user';

    const response = await patchRiskReport(
      requestWithBody(JSON.stringify({ status: 'resolved' })),
      patchContext(),
    );

    await expectJsonResponse(response, 403, { detail: '관리자 권한 필요' });
    expect(mocks.updateRiskReport).not.toHaveBeenCalled();
  });

  it('rejects admin callers outside the risk workspace before body processing', async () => {
    authenticate();
    mocks.state.profileRole = 'admin';
    mocks.state.membership = null;

    const response = await patchRiskReport(
      requestWithBody(JSON.stringify({ status: 'resolved' })),
      patchContext(),
    );

    await expectJsonResponse(response, 403, {
      detail: '해당 워크스페이스에 접근 권한이 없습니다',
    });
    expect(mocks.updateRiskReport).not.toHaveBeenCalled();
  });

  const invalidPatchCases: ValidationCase[] = [
    {
      name: 'malformed JSON',
      body: '{ broken json',
      detail: 'JSON body가 필요합니다',
    },
    {
      name: 'array body',
      body: JSON.stringify([]),
      detail: '잘못된 요청 body입니다',
    },
    {
      name: 'non-string status',
      body: JSON.stringify({ status: 123 }),
      detail: 'status는 문자열이어야 합니다',
    },
    {
      name: 'unknown status',
      body: JSON.stringify({ status: 'closed' }),
      detail: '허용되지 않은 status입니다',
    },
    {
      name: 'non-string admin_note',
      body: JSON.stringify({ admin_note: 123 }),
      detail: 'admin_note는 문자열 또는 null이어야 합니다',
    },
    {
      name: 'empty update object',
      body: JSON.stringify({}),
      detail: '업데이트할 필드가 없습니다',
    },
  ];

  for (const validationCase of invalidPatchCases) {
    it(`rejects ${validationCase.name} without updating the risk report`, async () => {
      authenticate();

      const response = await patchRiskReport(
        requestWithBody(validationCase.body),
        patchContext(),
      );

      await expectJsonResponse(response, 400, { detail: validationCase.detail });
      expect(mocks.updateRiskReport).not.toHaveBeenCalled();
      expect(mocks.removeAttachments).not.toHaveBeenCalled();
    });
  }
});
