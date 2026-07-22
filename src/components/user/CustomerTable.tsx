'use client';

import { format, parseISO } from 'date-fns';
import { CONTRACT_TYPE_LABELS, TIER_LABELS } from '@/types/subscription';
import { getContractSummary, CONTRACT_STATUS_STYLE } from '@/lib/subscription';
import { getContractEndDate, getContractStartDate } from '@/lib/contractDate';
import type { UserWithDetails, WorkspaceTokens } from '@/lib/api/userApi';

interface CustomerTableProps {
  users: UserWithDetails[];
  tokens: WorkspaceTokens[];
  onSelect: (userId: string) => void;
}

function formatTokens(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function CustomerTable({ users, tokens, onSelect }: CustomerTableProps) {
  const tokensByWs = new Map(tokens.map((t) => [t.id, t]));
  // 종료일 빠른 순. 구독 없는 사용자는 뒤로.
  const sorted = [...users].sort((a, b) => {
    const aEnd = a.subscription?.ended_at;
    const bEnd = b.subscription?.ended_at;
    if (!aEnd && !bEnd) return 0;
    if (!aEnd) return 1;
    if (!bEnd) return -1;
    return parseISO(aEnd).getTime() - parseISO(bEnd).getTime();
  });

  return (
    <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-100 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* 데스크톱 헤더 — 스크롤 컨테이너 안 sticky. 행과 같은 폭(스크롤바 제외)을 공유해 칸 어긋남 방지 */}
        <div className="hidden lg:grid grid-cols-[1.2fr_1.6fr_0.7fr_1.3fr_0.6fr_0.9fr_0.7fr] sticky top-0 z-10 bg-white border-b border-slate-100 py-3 px-4 text-xs font-semibold text-slate-500">
          <div>회사명</div>
          <div>이메일</div>
          <div className="text-center">계약/티어</div>
          <div className="text-center">계약 기간</div>
          <div className="text-center">남은</div>
          <div className="text-center">AI 토큰 (잔여 / 월충전)</div>
          <div className="text-center">상태</div>
        </div>
        {sorted.length === 0 && (
          <p className="text-sm text-slate-400 py-8 text-center">등록된 사용자가 없습니다.</p>
        )}
        {sorted.map((u) => {
          const sub = u.subscription;
          const summary = getContractSummary(sub);
          const style = CONTRACT_STATUS_STYLE[summary.status];
          const periodLabel = sub
            ? `${format(getContractStartDate(sub.started_at), 'yy.MM.dd')} ~ ${format(getContractEndDate(sub.ended_at), 'yy.MM.dd')}`
            : '-';
          const remainLabel =
            summary.status === 'scheduled' && summary.daysUntilStart !== null
              ? `D-${summary.daysUntilStart} 시작`
              : summary.daysUntilExpiry === null
                ? '-'
                : summary.daysUntilExpiry < 0
                  ? `${summary.daysUntilExpiry}일`
                  : `D-${summary.daysUntilExpiry}`;
          const tierLabel = sub ? TIER_LABELS[sub.tier] : '-';
          const contractTypeLabel = sub ? CONTRACT_TYPE_LABELS[sub.contract_type] : '-';
          const tk = u.workspace ? tokensByWs.get(u.workspace.id) : undefined;
          // 잔여 토큰이 월 충전량의 20% 미만이면 경고색, 0 이하면 빨간색
          const balanceClass = tk
            ? tk.token_balance <= 0
              ? 'text-red-500'
              : tk.monthly_quota > 0 && tk.token_balance < tk.monthly_quota * 0.2
                ? 'text-amber-600'
                : 'text-slate-600'
            : 'text-slate-400';
          const tokenCell = tk ? (
            <span className="tabular-nums">
              <span className={`font-semibold ${balanceClass}`}>{formatTokens(tk.token_balance)}</span>
              <span className="text-slate-300 mx-1">/</span>
              <span className="text-slate-500">{formatTokens(tk.monthly_quota)}</span>
            </span>
          ) : (
            <span className="text-slate-300">-</span>
          );

          return (
            <div
              key={u.id}
              className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
              onClick={() => onSelect(u.id)}
            >
              {/* 데스크톱 행 */}
              <div className="hidden lg:grid grid-cols-[1.2fr_1.6fr_0.7fr_1.3fr_0.6fr_0.9fr_0.7fr] items-center py-3 px-4">
                <div className="text-sm font-semibold text-slate-700 truncate">{u.company_name}</div>
                <div className="text-sm text-slate-500 truncate">{u.email}</div>
                <div className="flex flex-col items-center gap-0.5 text-center text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      sub?.contract_type === 'trial'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {contractTypeLabel}
                  </span>
                  <span className="text-slate-500">{tierLabel}</span>
                </div>
                <div className="text-center text-xs text-slate-500">{periodLabel}</div>
                <div className="text-center text-xs text-slate-500">{remainLabel}</div>
                <div className="text-center text-xs">{tokenCell}</div>
                <div className="text-center">
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${style.className}`}>
                    {style.label}
                  </span>
                </div>
              </div>

              {/* 모바일 카드 */}
              <div className="lg:hidden flex flex-col gap-1.5 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-slate-800 truncate">{u.company_name}</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                      {tierLabel}
                    </span>
                    {sub && (
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                          sub.contract_type === 'trial'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {contractTypeLabel}
                      </span>
                    )}
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded ${style.className}`}>
                    {style.label}
                  </span>
                </div>
                <div className="text-xs text-slate-500 truncate">{u.email}</div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 tabular-nums">
                  <span>{periodLabel}</span>
                  <span className="text-slate-200">·</span>
                  <span>{remainLabel}</span>
                  {tk && (
                    <>
                      <span className="text-slate-200">·</span>
                      <span>
                        <span className={`font-semibold ${balanceClass}`}>{formatTokens(tk.token_balance)}</span>
                        <span className="text-slate-300 mx-0.5">/</span>
                        <span>{formatTokens(tk.monthly_quota)}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
