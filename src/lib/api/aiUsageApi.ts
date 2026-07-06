import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export type AiUsageSource = 'analysis' | 'strategy' | 'insight';

export interface AiUsageRangeParams {
  from?: string | null;
  to?: string | null;
}

export interface AiUsageSourceUsage {
  source: AiUsageSource;
  label: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cost_usd: number;
}

export interface AiUsageTotal {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cost_usd: number;
}

export interface AiUsageWorkspace {
  workspace_id: string;
  workspace_name: string | null;
  by_source: Record<AiUsageSource, AiUsageSourceUsage>;
  total: AiUsageTotal;
}

export interface AiUsageSummary {
  from: string | null;
  to: string | null;
  workspaces: AiUsageWorkspace[];
  totals: AiUsageTotal;
  pricing_note: string;
}

export interface AiUsageRecentRow {
  id: string;
  report_id?: string | null;
  platform_id?: string | null;
  category?: string | null;
  status?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  model?: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cost_usd: number;
  created_at: string;
}

export interface AiUsageWorkspaceDetail {
  from: string | null;
  to: string | null;
  workspace: AiUsageWorkspace;
  totals: AiUsageTotal;
  recent: {
    sessions: AiUsageRecentRow[];
    strategies: AiUsageRecentRow[];
    insights: AiUsageRecentRow[];
  };
  pricing_note: string;
}

export interface AiCreditLedgerEntry {
  id: number;
  amount_usd: number;
  note: string | null;
  created_at: string;
}

export interface AiUsageCredit {
  ledger: AiCreditLedgerEntry[];
  total_credits_usd: number;
  total_usage_cost_usd: number;
  estimated_balance_usd: number;
  pricing_note: string;
}

function apiBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new Error('NEXT_PUBLIC_API_URL is not configured');
  return base.replace(/\/$/, '');
}

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('로그인이 필요합니다.');
  return { Authorization: `Bearer ${session.access_token}` };
}

function withRange(path: string, range?: AiUsageRangeParams): string {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...init.headers,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? 'AI 사용량 API 요청 실패');
  }
  return res.json();
}

export function getAiUsageSummary(range?: AiUsageRangeParams): Promise<AiUsageSummary> {
  return requestJson(withRange('/api/ai-usage/summary', range));
}

export function getAiUsageWorkspaceDetail(
  workspaceId: string,
  range?: AiUsageRangeParams,
): Promise<AiUsageWorkspaceDetail> {
  return requestJson(
    withRange(`/api/ai-usage/workspace/${encodeURIComponent(workspaceId)}`, range),
  );
}

export function getAiUsageCredit(): Promise<AiUsageCredit> {
  return requestJson('/api/ai-usage/credit');
}

export function addAiUsageCredit(params: {
  amount_usd: number;
  note?: string | null;
}): Promise<AiUsageCredit> {
  return requestJson('/api/ai-usage/credit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}
