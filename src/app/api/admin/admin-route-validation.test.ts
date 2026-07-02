import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PASSWORD_POLICY_MESSAGE } from '@/lib/auth/passwordPolicy';
import { POST as clearCriticalPost } from '@/app/api/admin/clear-critical/route';
import { POST as publishReportPost } from '@/app/api/admin/publish-report/route';
import { POST as resetPasswordPost } from '@/app/api/admin/reset-password/route';

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

function requestWithBody(body: string): NextRequest {
  return new Request('http://localhost/api/admin/test', {
    body,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  }) as NextRequest;
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
