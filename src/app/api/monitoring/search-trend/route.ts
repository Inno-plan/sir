import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const DATALAB_URL = 'https://openapi.naver.com/v1/datalab/search';
const DATALAB_TIMEOUT_MS = 15_000;

interface Body {
  workspace_id: string;
}

interface DatalabPoint {
  period: string;
  ratio: number;
}

interface DatalabResponse {
  results?: { data?: DatalabPoint[] }[];
}

interface SearchPoint {
  date: string;
  ratio: number;
}

/** YYYY-MM-DD (KST). */
function kstTodayStr(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** YYYY-MM-DD (KST 어제). */
function kstYesterdayStr(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError';
}

/** 모니터링 검색 트렌드 — 네이버 데이터랩 일배치 캐시 + route handler.
 *
 * 1) Supabase RLS 로 워크스페이스 접근 권한 확인 + company_name 조회
 * 2) `monitoring_search_trends_cache` 에 today_kst row 있으면 cache hit → 반환
 * 3) miss 면 네이버 데이터랩 365일치 호출 → UPSERT → 반환
 *
 * 단일 ws 안에서 사용자 N명이 같은 날 호출해도 네이버 API 는 1회만 발생.
 * 동시 호출 race 시 두 번 호출될 수 있으나 UPSERT 가 last-write-wins 로 안정 (응답 동일).
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정' },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    const parsed = await req.json();
    if (!isRecord(parsed) || typeof parsed.workspace_id !== 'string') {
      return NextResponse.json({ error: 'workspace_id 누락' }, { status: 400 });
    }
    body = { workspace_id: parsed.workspace_id.trim() };
  } catch {
    return NextResponse.json({ error: '유효한 JSON body 필요' }, { status: 400 });
  }

  const { workspace_id } = body;
  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id 누락' }, { status: 400 });
  }

  // RLS 로 멤버십 검증 + company_name 조회 (멤버 아니면 0건).
  const { data: ws, error: wsErr } = await supabase
    .from('workspaces')
    .select('company_name')
    .eq('id', workspace_id)
    .maybeSingle();
  if (wsErr) {
    return NextResponse.json({ error: wsErr.message }, { status: 500 });
  }
  if (!ws) {
    return NextResponse.json({ error: '워크스페이스 접근 권한 없음' }, { status: 404 });
  }
  const keyword = ws.company_name;
  if (!keyword) {
    return NextResponse.json({ error: 'company_name 미설정' }, { status: 400 });
  }

  const today = kstTodayStr();

  // service_role 클라이언트 — 캐시 SELECT/UPSERT 용 (RLS 우회 + 타입 미생성 테이블 접근)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 1) cache hit 확인
  const { data: cached } = await admin
    .from('monitoring_search_trends_cache')
    .select('generated_kst_date, start_date, end_date, keyword, points')
    .eq('workspace_id', workspace_id)
    .maybeSingle();

  if (cached && cached.generated_kst_date === today && cached.keyword === keyword) {
    // 신선도 체크 — points 의 마지막 날짜가 어제 KST 이상이어야 hit.
    // 네이버 데이터랩은 D-1 까지만 주고, 그 데이터를 KST 09시 부근에 publish 한다.
    // 새벽에 처음 페이지 연 ws 는 그 시점 응답이 D-2 까지뿐이라 캐시에 D-2 가 박히는데,
    // generated_kst_date 만 today 로 매칭되면 그날 종일 D-2 끊김 그래프가 노출됨.
    // points 마지막이 어제 미만이면 stale 로 처리해 아래 fetch 흐름으로 자연스럽게 폴.
    const yesterday = kstYesterdayStr();
    const points = cached.points as SearchPoint[];
    const lastDate = points.at(-1)?.date ?? '';
    if (lastDate >= yesterday) {
      return NextResponse.json({
        keyword: cached.keyword,
        start: cached.start_date,
        end: cached.end_date,
        points,
        cached: true,
      });
    }
    // 아래로 fall-through → 데이터랩 재호출 + UPSERT
  }

  // 2) 캐시 miss → 네이버 데이터랩 365일 호출
  // ⚠️ endDate 를 오늘(KST)로 보내면 데이터랩이 365일치 요청에서 마지막 2일을 잘라
  // D-2 까지만 응답함 (짧은 기간 요청에선 D-1 까지 정상). 이유는 비공개 정책.
  // → endDate=어제(KST D-1) 로 한 칸 당겨서 365일치 요청하면 어제까지 모두 받음.
  const yesterdayMs = Date.now() + 9 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000;
  const endDate = new Date(yesterdayMs).toISOString().slice(0, 10);
  const startMs = yesterdayMs - 364 * 24 * 60 * 60 * 1000;
  const startDate = new Date(startMs).toISOString().slice(0, 10);

  let datalab: DatalabResponse;
  try {
    const res = await fetch(DATALAB_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      body: JSON.stringify({
        startDate,
        endDate,
        timeUnit: 'date',
        keywordGroups: [{ groupName: keyword, keywords: [keyword] }],
      }),
      signal: AbortSignal.timeout(DATALAB_TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[search-trend] datalab', res.status, text.slice(0, 300));
      // 네이버 실패 시 stale 캐시라도 있으면 반환 (degraded mode)
      if (cached) {
        return NextResponse.json({
          keyword: cached.keyword,
          start: cached.start_date,
          end: cached.end_date,
          points: cached.points as SearchPoint[],
          cached: true,
          stale: true,
        });
      }
      return NextResponse.json(
        { error: `네이버 데이터랩 응답 ${res.status}` },
        { status: 502 },
      );
    }
    datalab = (await res.json()) as DatalabResponse;
  } catch (e) {
    const timeout = isTimeoutError(e);
    const message = e instanceof Error ? e.message : String(e);
    console.error('[search-trend] fetch 실패:', message.slice(0, 300));
    if (cached) {
      return NextResponse.json({
        keyword: cached.keyword,
        start: cached.start_date,
        end: cached.end_date,
        points: cached.points as SearchPoint[],
        cached: true,
        stale: true,
      });
    }
    return NextResponse.json(
      { error: timeout ? '네이버 데이터랩 호출 시간 초과' : '네이버 데이터랩 호출 실패' },
      { status: timeout ? 504 : 502 },
    );
  }

  const raw = datalab.results?.[0]?.data ?? [];
  const points: SearchPoint[] = raw.map((p) => ({ date: p.period, ratio: p.ratio }));

  // 3) UPSERT — race 시 last-write-wins (같은 ws 면 응답 동일하므로 안전)
  const { error: upsertErr } = await admin
    .from('monitoring_search_trends_cache')
    .upsert(
      {
        workspace_id,
        generated_kst_date: today,
        start_date: startDate,
        end_date: endDate,
        keyword,
        points,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id' },
    );
  if (upsertErr) {
    console.error('[search-trend] cache UPSERT 실패:', upsertErr.message);
    // UPSERT 실패해도 호출자에게는 정상 데이터 반환 (다음 호출 때 다시 시도)
  }

  return NextResponse.json({
    keyword,
    start: startDate,
    end: endDate,
    points,
    cached: false,
  });
}
