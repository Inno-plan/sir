'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Coins,
  Loader2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import {
  useAddAiUsageCredit,
  useAiUsageCredit,
  useAiUsageSummary,
  useAiUsageWorkspaceDetail,
} from '@/hooks/ai-usage/useAiUsageQuery';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type {
  AiUsageRangeParams,
  AiUsageRecentRow,
  AiUsageSource,
  AiUsageWorkspace,
} from '@/lib/api/aiUsageApi';

type RangePreset = 'this_month' | 'last_month' | 'all' | 'custom';
type SortKey = 'cost' | 'tokens' | 'name';

const SOURCE_ORDER: AiUsageSource[] = ['analysis', 'strategy'];
const SOURCE_FALLBACK_LABEL: Record<AiUsageSource, string> = {
  analysis: '분석',
  strategy: '전략',
  insight: '인사이트',
};
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstParts(date = new Date()) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth(),
    day: kst.getUTCDate(),
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function kstDateInput(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function kstStartIso(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day, -9, 0, 0, 0)).toISOString();
}

function dateInputToKstStartIso(value: string, addDays = 0): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return kstStartIso(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + addDays);
}

function defaultCustomDates() {
  const now = kstParts();
  return {
    start: kstDateInput(now.year, now.month, 1),
    end: kstDateInput(now.year, now.month, now.day),
  };
}

function buildRange(
  preset: RangePreset,
  customStart: string,
  customEnd: string,
): AiUsageRangeParams {
  const now = kstParts();
  if (preset === 'all') return {};
  if (preset === 'this_month') {
    return {
      from: kstStartIso(now.year, now.month, 1),
      to: new Date().toISOString(),
    };
  }
  if (preset === 'last_month') {
    const lastMonth = now.month === 0 ? 11 : now.month - 1;
    const year = now.month === 0 ? now.year - 1 : now.year;
    return {
      from: kstStartIso(year, lastMonth, 1),
      to: kstStartIso(now.year, now.month, 1),
    };
  }

  const from = dateInputToKstStartIso(customStart);
  const to = dateInputToKstStartIso(customEnd, 1);
  if (!from || !to || from >= to) return {};
  return { from, to };
}

function formatTokens(value: number): string {
  const full = Math.round(value).toLocaleString();
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${full} (${(value / 1_000_000).toFixed(1)}M)`;
  if (abs >= 1_000) return `${full} (${(value / 1_000).toFixed(1)}K)`;
  return full;
}

function formatCost(value: number): string {
  return `$${value.toFixed(3)}`;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(new Date(iso));
}

function totalTokens(workspace: AiUsageWorkspace): number {
  return workspace.total.input_tokens + workspace.total.output_tokens;
}

function sourceLabel(workspace: AiUsageWorkspace, source: AiUsageSource): string {
  return workspace.by_source[source]?.label ?? SOURCE_FALLBACK_LABEL[source];
}

function SourceTokenCell({ workspace, source }: { workspace: AiUsageWorkspace; source: AiUsageSource }) {
  const item = workspace.by_source[source];
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-slate-500">{sourceLabel(workspace, source)}</span>
      <span className="text-xs text-slate-700 tabular-nums">
        입력 {formatTokens(item?.input_tokens ?? 0)}
      </span>
      <span className="text-xs text-slate-500 tabular-nums">
        출력 {formatTokens(item?.output_tokens ?? 0)}
      </span>
      {!!item?.cache_read_tokens && (
        <span className="text-[11px] text-sky-600 tabular-nums">
          Cache {formatTokens(item.cache_read_tokens)}
        </span>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  tone = 'slate',
}: {
  title: string;
  value: string;
  description: string;
  tone?: 'slate' | 'blue' | 'red' | 'amber';
}) {
  const toneClass = {
    slate: 'border-slate-100 bg-white text-slate-800',
    blue: 'border-blue-100 bg-blue-50 text-blue-900',
    red: 'border-red-100 bg-red-50 text-red-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold opacity-70">{title}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs opacity-70">{description}</p>
    </div>
  );
}

function PresetButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
        active
          ? 'bg-slate-800 text-white'
          : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

function SortButton({
  label,
  sortKey,
  current,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: { key: SortKey; dir: 'asc' | 'desc' };
  onSort: (key: SortKey) => void;
}) {
  const active = current.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        active ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      {label}
      {active && <span>{current.dir === 'desc' ? '↓' : '↑'}</span>}
    </button>
  );
}

function RecentTable({ title, rows }: { title: string; rows: AiUsageRecentRow[] }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-700">{title}</h4>
        <span className="text-[11px] text-slate-400">{rows.length}건</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-xs text-slate-400">해당 기간 기록이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="text-slate-400">
              <tr className="border-b border-slate-100">
                <th className="px-3 py-2 text-left font-semibold">구분</th>
                <th className="px-3 py-2 text-right font-semibold">입력</th>
                <th className="px-3 py-2 text-right font-semibold">출력</th>
                <th className="px-3 py-2 text-right font-semibold">비용</th>
                <th className="px-3 py-2 text-right font-semibold">생성</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const label =
                  row.platform_id ??
                  row.category ??
                  (row.period_start && row.period_end
                    ? `${row.period_start}~${row.period_end}`
                    : row.model ?? row.id.slice(0, 8));
                return (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{label}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {formatTokens(row.input_tokens)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {formatTokens(row.output_tokens)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-700">
                      {formatCost(row.cost_usd)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400 whitespace-nowrap">
                      {formatDateTime(row.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AiUsageClient() {
  const defaults = useMemo(() => defaultCustomDates(), []);
  const [preset, setPreset] = useState<RangePreset>('this_month');
  const [customStart, setCustomStart] = useState(defaults.start);
  const [customEnd, setCustomEnd] = useState(defaults.end);
  const [expandedWorkspaceId, setExpandedWorkspaceId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'cost',
    dir: 'desc',
  });
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [noteInput, setNoteInput] = useState('');

  const range = useMemo(
    () => buildRange(preset, customStart, customEnd),
    [preset, customStart, customEnd],
  );
  const summary = useAiUsageSummary(range);
  const credit = useAiUsageCredit();
  const detail = useAiUsageWorkspaceDetail(expandedWorkspaceId, range);
  const addCredit = useAddAiUsageCredit();

  const sortedWorkspaces = useMemo(() => {
    const rows = [...(summary.data?.workspaces ?? [])];
    rows.sort((a, b) => {
      const factor = sort.dir === 'desc' ? -1 : 1;
      if (sort.key === 'name') {
        return factor * (a.workspace_name ?? '').localeCompare(b.workspace_name ?? '');
      }
      if (sort.key === 'tokens') return factor * (totalTokens(a) - totalTokens(b));
      return factor * (a.total.cost_usd - b.total.cost_usd);
    });
    return rows;
  }, [summary.data?.workspaces, sort]);

  const balance = credit.data?.estimated_balance_usd ?? 0;
  const totalCredits = credit.data?.total_credits_usd ?? 0;
  const balanceTone =
    balance < 0 ? 'red' : totalCredits > 0 && balance / totalCredits < 0.1 ? 'amber' : 'blue';

  const setSortKey = (key: SortKey) => {
    setSort((prev) => (
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' }
    ));
  };

  const submitCredit = async () => {
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount === 0) {
      toast.error('0이 아닌 금액을 입력하세요.');
      return;
    }
    try {
      await addCredit.mutateAsync({
        amount_usd: amount,
        note: noteInput.trim() || null,
      });
      toast.success('크레딧 기록을 추가했습니다.');
      setAmountInput('');
      setNoteInput('');
      setCreditModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '크레딧 기록 추가 실패');
    }
  };

  return (
    <div className="min-h-full bg-slate-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              <Bot size={14} />
              AI Usage Admin
            </div>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">AI 토큰 사용량</h1>
            <p className="mt-1 text-sm text-slate-500">
              워크스페이스별 Claude API 토큰과 현재 단가 기준 예상 비용을 집계합니다.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <PresetButton active={preset === 'this_month'} onClick={() => setPreset('this_month')}>
                이번 달
              </PresetButton>
              <PresetButton active={preset === 'last_month'} onClick={() => setPreset('last_month')}>
                지난 달
              </PresetButton>
              <PresetButton active={preset === 'all'} onClick={() => setPreset('all')}>
                전체
              </PresetButton>
              <PresetButton active={preset === 'custom'} onClick={() => setPreset('custom')}>
                커스텀
              </PresetButton>
            </div>
            {preset === 'custom' && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-slate-400"
                />
                <span className="text-xs text-slate-300">~</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-slate-400"
                />
              </div>
            )}
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="기간 총 비용"
            value={summary.isLoading ? '...' : formatCost(summary.data?.totals.cost_usd ?? 0)}
            description="현재 단가 기준 추정치"
            tone="blue"
          />
          <SummaryCard
            title="기간 총 토큰"
            value={summary.isLoading ? '...' : formatTokens(
              (summary.data?.totals.input_tokens ?? 0) + (summary.data?.totals.output_tokens ?? 0),
            )}
            description={`입력 ${formatTokens(summary.data?.totals.input_tokens ?? 0)} · 출력 ${formatTokens(summary.data?.totals.output_tokens ?? 0)}`}
          />
          <SummaryCard
            title="누적 충전액"
            value={credit.isLoading ? '...' : formatCost(credit.data?.total_credits_usd ?? 0)}
            description="수동 크레딧 원장 합계"
          />
          <SummaryCard
            title="예상 잔액"
            value={credit.isLoading ? '...' : formatCost(balance)}
            description="누적 충전액 − 전체 누적 사용액"
            tone={balanceTone}
          />
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">워크스페이스별 사용량</h2>
              <p className="mt-1 text-xs text-slate-400">
                행을 클릭하면 최근 세션/전략 토큰 내역을 확인할 수 있습니다.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {summary.isFetching && <Loader2 className="size-4 animate-spin text-slate-300" />}
              <button
                type="button"
                onClick={() => summary.refetch()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <RefreshCw size={13} />
                새로고침
              </button>
            </div>
          </div>

          {summary.isError ? (
            <div className="p-8 text-center text-sm text-red-500">
              {summary.error instanceof Error ? summary.error.message : '사용량 조회 실패'}
            </div>
          ) : summary.isLoading ? (
            <div className="p-8 text-center text-sm text-slate-400">사용량을 불러오는 중...</div>
          ) : sortedWorkspaces.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">해당 기간 사용량이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <SortButton label="워크스페이스" sortKey="name" current={sort} onSort={setSortKey} />
                    </th>
                    {SOURCE_ORDER.map((source) => (
                      <th key={source} className="px-4 py-3 text-left text-xs font-semibold text-slate-400">
                        {SOURCE_FALLBACK_LABEL[source]}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right">
                      <SortButton label="총 토큰" sortKey="tokens" current={sort} onSort={setSortKey} />
                    </th>
                    <th className="px-4 py-3 text-right">
                      <SortButton label="비용" sortKey="cost" current={sort} onSort={setSortKey} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedWorkspaces.map((workspace) => {
                    const expanded = expandedWorkspaceId === workspace.workspace_id;
                    return (
                      <FragmentRow
                        key={workspace.workspace_id}
                        workspace={workspace}
                        expanded={expanded}
                        detailLoading={expanded && detail.isFetching}
                        detailRows={expanded ? detail.data?.recent : undefined}
                        detailError={expanded && detail.isError ? detail.error : null}
                        onToggle={() =>
                          setExpandedWorkspaceId(expanded ? null : workspace.workspace_id)
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Coins size={16} className="text-amber-500" />
                크레딧 관리
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Anthropic Console에서 충전한 금액을 기록합니다. 잔액은 자체 토큰 집계 기반 추정치입니다.
              </p>
            </div>
            <Button size="sm" onClick={() => setCreditModalOpen(true)}>
              <Plus size={14} />
              충전 기록 추가
            </Button>
          </div>

          {credit.isError ? (
            <p className="py-6 text-sm text-red-500">
              {credit.error instanceof Error ? credit.error.message : '크레딧 조회 실패'}
            </p>
          ) : credit.isLoading ? (
            <p className="py-6 text-sm text-slate-400">크레딧 원장을 불러오는 중...</p>
          ) : credit.data?.ledger.length === 0 ? (
            <p className="py-6 text-sm text-slate-400">아직 충전/보정 기록이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs text-slate-400">
                  <tr className="border-b border-slate-100">
                    <th className="py-3 text-left font-semibold">일시</th>
                    <th className="py-3 text-right font-semibold">금액</th>
                    <th className="py-3 text-left font-semibold pl-6">메모</th>
                  </tr>
                </thead>
                <tbody>
                  {credit.data?.ledger.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-3 text-slate-500">{formatDateTime(entry.created_at)}</td>
                      <td
                        className={`py-3 text-right font-semibold tabular-nums ${
                          entry.amount_usd < 0 ? 'text-red-500' : 'text-slate-800'
                        }`}
                      >
                        {formatCost(entry.amount_usd)}
                      </td>
                      <td className="py-3 pl-6 text-slate-500">{entry.note ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
        title="충전/보정 기록 추가"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreditModalOpen(false)}>
              취소
            </Button>
            <Button onClick={submitCredit} disabled={addCredit.isPending}>
              {addCredit.isPending ? '저장 중...' : '추가'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">금액 (USD)</label>
            <input
              type="number"
              step="0.01"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="예: 100 또는 -5"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
            <p className="mt-1 text-[11px] text-slate-400">충전은 양수, 수동 보정은 음수로 입력할 수 있습니다.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">메모</label>
            <input
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="예: Anthropic Console 7월 충전"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function FragmentRow({
  workspace,
  expanded,
  detailLoading,
  detailRows,
  detailError,
  onToggle,
}: {
  workspace: AiUsageWorkspace;
  expanded: boolean;
  detailLoading: boolean;
  detailRows?: {
    sessions: AiUsageRecentRow[];
    strategies: AiUsageRecentRow[];
    insights: AiUsageRecentRow[];
  };
  detailError: unknown;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown size={15} className="text-slate-400" />
            ) : (
              <ChevronRight size={15} className="text-slate-300" />
            )}
            <div>
              <p className="font-semibold text-slate-800">
                {workspace.workspace_name ?? workspace.workspace_id.slice(0, 8)}
              </p>
              <p className="text-[11px] text-slate-400">{workspace.workspace_id}</p>
            </div>
          </div>
        </td>
        {SOURCE_ORDER.map((source) => (
          <td key={source} className="px-4 py-4 align-top">
            <SourceTokenCell workspace={workspace} source={source} />
          </td>
        ))}
        <td className="px-4 py-4 text-right tabular-nums text-slate-700">
          {formatTokens(totalTokens(workspace))}
        </td>
        <td className="px-4 py-4 text-right text-base font-bold tabular-nums text-slate-900">
          {formatCost(workspace.total.cost_usd)}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50/60">
          <td colSpan={5} className="px-4 py-4">
            {detailLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
                <Loader2 className="size-4 animate-spin" />
                상세 내역을 불러오는 중...
              </div>
            ) : detailError ? (
              <p className="py-6 text-center text-sm text-red-500">
                {detailError instanceof Error ? detailError.message : '상세 조회 실패'}
              </p>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                <RecentTable title="최근 분석 세션" rows={detailRows?.sessions ?? []} />
                <RecentTable title="최근 전략/총평" rows={detailRows?.strategies ?? []} />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
