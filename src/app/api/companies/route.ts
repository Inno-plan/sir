import { NextRequest, NextResponse } from 'next/server';

const KRX_EXTERNAL_URL =
  'https://apis.data.go.kr/1160100/service/GetKrxListedInfoService/getItemInfo';

const KRX_NUMBER_OF_ROWS = '20';
const KRX_TIMEOUT_MS = 15_000;
const KRX_SEARCH_TYPES = new Set(['name', 'code']);

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError';
}

export async function GET(request: NextRequest) {
  const serviceKey = process.env.KRX_API_SERVICE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: 'KRX_API_SERVICE_KEY is not configured' }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const query = searchParams.get('query')?.trim();
  const type = searchParams.get('type') ?? 'name';

  if (!query) {
    return NextResponse.json({ items: [] });
  }
  if (!KRX_SEARCH_TYPES.has(type)) {
    return NextResponse.json({ error: 'type must be name or code' }, { status: 400 });
  }

  const queryParams = new URLSearchParams();
  queryParams.append('serviceKey', serviceKey);
  queryParams.append('numOfRows', KRX_NUMBER_OF_ROWS);
  queryParams.append('resultType', 'json');

  if (type === 'code') {
    queryParams.append('likeIsinCd', query);
  } else {
    queryParams.append('likeItmsNm', query);
  }

  const endpoint = `${KRX_EXTERNAL_URL}?${queryParams.toString()}`;

  let data: unknown;
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(KRX_TIMEOUT_MS) });
    if (!res.ok) {
      console.error('[companies] KRX API', res.status);
      return NextResponse.json({ error: 'KRX API request failed' }, { status: 502 });
    }
    data = await res.json();
  } catch (error) {
    const timeout = isTimeoutError(error);
    const message = error instanceof Error ? error.message : String(error);
    console.error('[companies] KRX API fetch failed:', message.slice(0, 300));
    return NextResponse.json(
      { error: timeout ? 'KRX API request timed out' : 'KRX API request failed' },
      { status: timeout ? 504 : 502 },
    );
  }
  const krxData = data as {
    response?: { body?: { items?: { item?: unknown } } };
  };
  const rawItems = krxData.response?.body?.items?.item;

  if (!rawItems) {
    return NextResponse.json({ items: [] });
  }

  const seen = new Set<string>();
  const items = (Array.isArray(rawItems) ? rawItems : [rawItems]).reduce<
    { name: string; ticker: string; isinCd: string; market: string }[]
  >((acc, item: Record<string, string>) => {
    if (!seen.has(item.isinCd)) {
      seen.add(item.isinCd);
      acc.push({
        name: item.itmsNm,
        ticker: (item.srtnCd ?? '').replace(/^[A-Za-z]/, ''),
        isinCd: item.isinCd,
        market: item.mrktCtg,
      });
    }
    return acc;
  }, []);

  return NextResponse.json({ items });
}
