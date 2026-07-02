import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getReportInfo,
  getStrategies,
  getWeeklySummary,
} from '@/lib/api/reportApi';

const supabaseMocks = vi.hoisted(() => {
  type QueryCall = {
    method: string;
    args: unknown[];
  };
  type QueryResponse = {
    data: unknown;
    error?: Error | null;
  };
  type QueryRecord = {
    table: string;
    calls: QueryCall[];
  };

  const queries: QueryRecord[] = [];
  const responses = new Map<string, QueryResponse>();

  function getResponse(table: string) {
    return responses.get(table) ?? { data: [] };
  }

  function createQuery(table: string) {
    const record: QueryRecord = { table, calls: [] };
    queries.push(record);

    const query = {
      select: vi.fn((...args: unknown[]) => {
        record.calls.push({ method: 'select', args });
        return query;
      }),
      eq: vi.fn((...args: unknown[]) => {
        record.calls.push({ method: 'eq', args });
        return query;
      }),
      in: vi.fn((...args: unknown[]) => {
        record.calls.push({ method: 'in', args });
        return query;
      }),
      order: vi.fn((...args: unknown[]) => {
        record.calls.push({ method: 'order', args });
        return query;
      }),
      limit: vi.fn((...args: unknown[]) => {
        record.calls.push({ method: 'limit', args });
        return query;
      }),
      maybeSingle: vi.fn(() => Promise.resolve(getResponse(table))),
      then: <TResult1 = QueryResponse, TResult2 = never>(
        onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) => Promise.resolve(getResponse(table)).then(onfulfilled, onrejected),
    };

    return query;
  }

  return {
    from: vi.fn((table: string) => createQuery(table)),
    queries,
    responses,
  };
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: supabaseMocks.from,
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
    },
    storage: {
      from: vi.fn(),
    },
  }),
}));

function callsFor(table: string) {
  const record = supabaseMocks.queries.find((query) => query.table === table);
  return record?.calls ?? [];
}

function expectCall(table: string, method: string, args: unknown[]) {
  expect(callsFor(table)).toContainEqual({ method, args });
}

const summarySection = {
  summary: '평판 요약',
  subsections: [
    {
      title: '긍정 요인',
      points: ['검색량 증가'],
    },
  ],
};

const validStrategy = {
  background: {
    summary: '부정 이슈가 늘었습니다.',
    points: ['커뮤니티 언급 증가'],
  },
  proposal: {
    summary: '공식 해명 콘텐츠를 우선 배포합니다.',
    actions: [
      {
        platform: 'news',
        topic: '팩트 정리',
        contents: ['FAQ 발행'],
      },
    ],
  },
};

describe('reportApi report data boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.queries.length = 0;
    supabaseMocks.responses.clear();
  });

  it('filters report info by both report id and workspace id', async () => {
    const row = {
      id: 'report-id',
      workspace_id: 'workspace-id',
      type: 'weekly',
      period_start: '2026-06-22',
      period_end: '2026-06-28',
      created_at: '2026-06-29T00:00:00.000Z',
      sir_score: 72,
      status: 'published',
    };
    supabaseMocks.responses.set('reports', { data: row });

    await expect(getReportInfo('workspace-id', 'report-id')).resolves.toEqual(row);

    expect(supabaseMocks.from).toHaveBeenCalledWith('reports');
    expectCall('reports', 'select', [
      'id, workspace_id, type, period_start, period_end, created_at, sir_score, status',
    ]);
    expectCall('reports', 'eq', ['id', 'report-id']);
    expectCall('reports', 'eq', ['workspace_id', 'workspace-id']);
  });

  it('returns null report info for workspace/report mismatches', async () => {
    supabaseMocks.responses.set('reports', { data: null });

    await expect(getReportInfo('workspace-id', 'other-report-id')).resolves.toBeNull();
  });

  it('loads weekly summary for the exact workspace/report and parses the summary schema', async () => {
    supabaseMocks.responses.set('session_strategies', {
      data: [{ all_strategy: [summarySection] }],
    });

    await expect(getWeeklySummary('workspace-id', 'report-id')).resolves.toEqual([summarySection]);

    expectCall('session_strategies', 'select', ['all_strategy']);
    expectCall('session_strategies', 'eq', ['workspace_id', 'workspace-id']);
    expectCall('session_strategies', 'eq', ['category', 'summary']);
    expectCall('session_strategies', 'eq', ['report_id', 'report-id']);
    expectCall('session_strategies', 'order', ['created_at', { ascending: false }]);
    expectCall('session_strategies', 'limit', [1]);
  });

  it('keeps legacy latest-summary fallback when report id is not supplied', async () => {
    supabaseMocks.responses.set('session_strategies', {
      data: [{ all_strategy: null }],
    });

    await expect(getWeeklySummary('workspace-id')).resolves.toEqual([]);

    expect(callsFor('session_strategies')).not.toContainEqual({
      method: 'eq',
      args: ['report_id', expect.anything()],
    });
  });

  it('sorts strategy categories and falls back to an empty strategy for malformed rows', async () => {
    supabaseMocks.responses.set('session_strategies', {
      data: [
        { category: 'community', strategy: validStrategy },
        { category: 'sns', strategy: { malformed: true } },
        { category: 'news', strategy: validStrategy },
      ],
    });

    const result = await getStrategies('workspace-id', 'report-id');

    expectCall('session_strategies', 'select', ['category, strategy']);
    expectCall('session_strategies', 'eq', ['workspace_id', 'workspace-id']);
    expectCall('session_strategies', 'in', ['category', ['news', 'sns', 'community']]);
    expectCall('session_strategies', 'eq', ['report_id', 'report-id']);
    expect(result.map((item) => item.category)).toEqual(['news', 'sns', 'community']);
    expect(result.map((item) => item.label)).toEqual([
      '뉴스 채널 대응 전략',
      'SNS 채널 대응 전략',
      '커뮤니티 채널 대응 전략',
    ]);
    expect(result[1].strategy).toEqual({
      background: { summary: '', points: [] },
      proposal: { summary: '', actions: [] },
    });
  });
});
