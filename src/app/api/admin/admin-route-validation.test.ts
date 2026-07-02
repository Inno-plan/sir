import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PASSWORD_POLICY_MESSAGE } from '@/lib/auth/passwordPolicy';
import { POST as clearCriticalPost } from '@/app/api/admin/clear-critical/route';
import { POST as createUserPost } from '@/app/api/admin/create-user/route';
import { POST as publishReportPost } from '@/app/api/admin/publish-report/route';
import { POST as resetPasswordPost } from '@/app/api/admin/reset-password/route';
import { GET as workspaceTokensGet } from '@/app/api/admin/workspace-tokens/route';
import { PATCH as workspaceTokensPatch } from '@/app/api/admin/workspace-tokens/[workspaceId]/route';

const mocks = vi.hoisted(() => {
  const getUser = vi.fn();
  const profileSingle = vi.fn();
  const createServerClient = vi.fn(async () => ({
    auth: {
      getUser,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: profileSingle,
        }),
      }),
    }),
  }));
  const createSupabaseClient = vi.fn(() => {
    throw new Error('service-role client should not be created for invalid bodies');
  });

  return {
    createServerClient,
    createSupabaseClient,
    getUser,
    profileSingle,
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createServerClient,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createSupabaseClient,
}));

type AdminRole = 'admin' | 'super_admin';
type RouteHandler = (request: NextRequest) => Promise<Response>;
type ValidationCase = {
  body: string;
  detail: string;
  name: string;
};
type RouteCase = {
  cases: ValidationCase[];
  name: string;
  post: RouteHandler;
  role: AdminRole;
};
type AuthGateCase = {
  expectedDetail: string;
  expectedStatus: 401 | 403;
  name: string;
  request?: NextRequest;
  role?: AdminRole | 'user';
  run: (request: NextRequest) => Promise<Response>;
};

function rejectUnauthenticated() {
  mocks.getUser.mockResolvedValueOnce({
    data: {
      user: null,
    },
    error: null,
  });
}

function authorizeAs(role: AdminRole) {
  mocks.getUser.mockResolvedValueOnce({
    data: {
      user: {
        id: 'caller-user-id',
      },
    },
    error: null,
  });
  mocks.profileSingle.mockResolvedValueOnce({
    data: {
      role,
    },
    error: null,
  });
}

function authorizeProfileAs(role: AdminRole | 'user') {
  mocks.getUser.mockResolvedValueOnce({
    data: {
      user: {
        id: 'caller-user-id',
      },
    },
    error: null,
  });
  mocks.profileSingle.mockResolvedValueOnce({
    data: {
      role,
    },
    error: null,
  });
}

function requestWithBody(body: string): NextRequest {
  return new Request('http://localhost/api/admin/test', {
    body,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  }) as NextRequest;
}

function emptyJsonRequest(): NextRequest {
  return requestWithBody(JSON.stringify({}));
}

async function expectValidationError(
  route: RouteCase,
  validationCase: ValidationCase,
) {
  authorizeAs(route.role);

  const response = await route.post(requestWithBody(validationCase.body));
  const payload = await response.json();

  expect(response.status).toBe(400);
  expect(payload).toEqual({ detail: validationCase.detail });
  expect(mocks.createSupabaseClient).not.toHaveBeenCalled();
}

async function expectAuthGate(authCase: AuthGateCase) {
  if (authCase.expectedStatus === 401) {
    rejectUnauthenticated();
  } else {
    authorizeProfileAs(authCase.role ?? 'user');
  }

  const response = await authCase.run(authCase.request ?? emptyJsonRequest());
  const payload = await response.json();

  expect(response.status).toBe(authCase.expectedStatus);
  expect(payload).toEqual({ detail: authCase.expectedDetail });
  expect(mocks.createSupabaseClient).not.toHaveBeenCalled();
}

describe('admin route auth gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const authGateCases: AuthGateCase[] = [
    {
      name: 'publish-report rejects unauthenticated callers',
      expectedStatus: 401,
      expectedDetail: '인증 필요',
      run: (request) => publishReportPost(request),
    },
    {
      name: 'publish-report rejects non-admin callers',
      expectedStatus: 403,
      expectedDetail: '관리자 권한 필요',
      role: 'user',
      run: (request) => publishReportPost(request),
    },
    {
      name: 'clear-critical rejects unauthenticated callers',
      expectedStatus: 401,
      expectedDetail: '인증 필요',
      run: (request) => clearCriticalPost(request),
    },
    {
      name: 'clear-critical rejects non-admin callers',
      expectedStatus: 403,
      expectedDetail: '관리자 권한 필요',
      role: 'user',
      run: (request) => clearCriticalPost(request),
    },
    {
      name: 'reset-password rejects unauthenticated callers',
      expectedStatus: 401,
      expectedDetail: '인증 필요',
      run: (request) => resetPasswordPost(request),
    },
    {
      name: 'reset-password rejects admin callers',
      expectedStatus: 403,
      expectedDetail: '최고관리자 권한이 필요합니다',
      role: 'admin',
      run: (request) => resetPasswordPost(request),
    },
    {
      name: 'create-user rejects unauthenticated callers',
      expectedStatus: 401,
      expectedDetail: '인증 필요',
      run: (request) => createUserPost(request),
    },
    {
      name: 'create-user rejects admin callers',
      expectedStatus: 403,
      expectedDetail: '최고 관리자 권한 필요',
      role: 'admin',
      run: (request) => createUserPost(request),
    },
    {
      name: 'workspace-tokens overview rejects unauthenticated callers',
      expectedStatus: 401,
      expectedDetail: '인증 필요',
      run: () => workspaceTokensGet(),
    },
    {
      name: 'workspace-tokens overview rejects non-admin callers',
      expectedStatus: 403,
      expectedDetail: '관리자 권한 필요',
      role: 'user',
      run: () => workspaceTokensGet(),
    },
    {
      name: 'workspace-tokens mutation rejects unauthenticated callers',
      expectedStatus: 401,
      expectedDetail: '인증 필요',
      run: (request) => workspaceTokensPatch(request, {
        params: Promise.resolve({ workspaceId: 'workspace-id' }),
      }),
    },
    {
      name: 'workspace-tokens mutation rejects admin callers',
      expectedStatus: 403,
      expectedDetail: '최고 관리자 권한 필요',
      role: 'admin',
      run: (request) => workspaceTokensPatch(request, {
        params: Promise.resolve({ workspaceId: 'workspace-id' }),
      }),
    },
  ];

  for (const authCase of authGateCases) {
    it(authCase.name, async () => {
      await expectAuthGate(authCase);
    });
  }
});

describe('admin route body validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const routes: RouteCase[] = [
    {
      name: 'publish-report',
      post: publishReportPost,
      role: 'admin',
      cases: [
        {
          name: 'malformed JSON',
          body: '{ broken json',
          detail: '유효한 JSON body 필요',
        },
        {
          name: 'array body',
          body: JSON.stringify([]),
          detail: 'JSON object body 필요',
        },
        {
          name: 'missing report_id',
          body: JSON.stringify({}),
          detail: 'report_id 필수',
        },
        {
          name: 'non-string report_id',
          body: JSON.stringify({ report_id: 123 }),
          detail: 'report_id 필수',
        },
        {
          name: 'blank report_id',
          body: JSON.stringify({ report_id: '   ' }),
          detail: 'report_id 필수',
        },
      ],
    },
    {
      name: 'clear-critical',
      post: clearCriticalPost,
      role: 'admin',
      cases: [
        {
          name: 'malformed JSON',
          body: '{ broken json',
          detail: '유효한 JSON body 필요',
        },
        {
          name: 'array body',
          body: JSON.stringify([]),
          detail: 'JSON object body 필요',
        },
        {
          name: 'missing id',
          body: JSON.stringify({ platform_id: 'naver_news' }),
          detail: 'platform_id, id 필수',
        },
        {
          name: 'non-string id',
          body: JSON.stringify({ platform_id: 'naver_news', id: 123 }),
          detail: 'platform_id, id 필수',
        },
        {
          name: 'unknown platform',
          body: JSON.stringify({ platform_id: 'unknown', id: 'row-id' }),
          detail: '알 수 없는 platform: unknown',
        },
      ],
    },
    {
      name: 'reset-password',
      post: resetPasswordPost,
      role: 'super_admin',
      cases: [
        {
          name: 'malformed JSON',
          body: '{ broken json',
          detail: '유효한 JSON body 필요',
        },
        {
          name: 'array body',
          body: JSON.stringify([]),
          detail: 'JSON object body 필요',
        },
        {
          name: 'missing password',
          body: JSON.stringify({ userId: 'target-user-id' }),
          detail: '대상 유저와 비밀번호는 필수입니다',
        },
        {
          name: 'non-string userId',
          body: JSON.stringify({ userId: 123, password: 'Password1' }),
          detail: '대상 유저와 비밀번호는 필수입니다',
        },
        {
          name: 'non-string password',
          body: JSON.stringify({ userId: 'target-user-id', password: 123 }),
          detail: PASSWORD_POLICY_MESSAGE,
        },
      ],
    },
  ];

  for (const route of routes) {
    describe(route.name, () => {
      for (const validationCase of route.cases) {
        it(`returns 400 for ${validationCase.name}`, async () => {
          await expectValidationError(route, validationCase);
        });
      }
    });
  }
});
