'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Send } from 'lucide-react';
import { useAnswerSupportInquiry } from '@/hooks/support/useSupportMutation';
import {
  useSupportInquiries,
  useSupportInquiriesRealtime,
} from '@/hooks/support/useSupportQuery';
import { useWorkspaces } from '@/hooks/workspace/useWorkspaceQuery';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { WorkspaceCombobox } from '@/components/ui/WorkspaceCombobox';
import { getErrorMessage } from '@/lib/utils';
import {
  getSupportCategoryLabel,
  type SupportCategory,
  type SupportInquiryStatus,
} from '@/lib/api/supportApi';

type StatusFilter = 'all' | SupportInquiryStatus;

const CATEGORY_BADGE_CLASS: Record<SupportCategory, string> = {
  feature: 'bg-violet-50 text-violet-700 ring-violet-100',
  bug: 'bg-red-50 text-red-700 ring-red-100',
  upgrade: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  other: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체 문의' },
  { key: 'waiting', label: '답변 대기' },
  { key: 'answered', label: '답변 완료' },
];

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${mm}.${dd} ${hh}:${min}`;
}

function statusLabel(status: SupportInquiryStatus) {
  return status === 'answered' ? '답변 완료' : '답변 대기';
}

function StatusBadge({ status }: { status: SupportInquiryStatus }) {
  const answered = status === 'answered';
  const Icon = answered ? CheckCircle2 : Clock3;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
        answered ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      <Icon size={13} />
      {statusLabel(status)}
    </span>
  );
}

function CategoryBadge({ category }: { category: SupportCategory }) {
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold ring-1 ${CATEGORY_BADGE_CLASS[category]}`}
    >
      {getSupportCategoryLabel(category)}
    </span>
  );
}

interface SupportAdminInboxProps {
  assignedIds: string[] | null;
}

export function SupportAdminInbox({ assignedIds }: SupportAdminInboxProps) {
  const { data: allWorkspaces = [] } = useWorkspaces();
  const workspaces = useMemo(() => {
    const source = allWorkspaces;
    if (assignedIds === null) return source;
    const allowed = new Set(assignedIds);
    return source.filter((workspace) => allowed.has(workspace.id));
  }, [allWorkspaces, assignedIds]);

  const workspaceNameById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace.company_name])),
    [workspaces]
  );

  const [selectedWsId, setSelectedWsId] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const answerInquiry = useAnswerSupportInquiry();
  const {
    data: loadedInquiries = [],
    isLoading,
    isError,
    error,
  } = useSupportInquiries(selectedWsId || undefined);

  useSupportInquiriesRealtime(selectedWsId || undefined);

  const inquiries = useMemo(() => {
    if (assignedIds === null || selectedWsId) return loadedInquiries;
    const allowed = new Set(assignedIds);
    return loadedInquiries.filter((item) => allowed.has(item.workspaceId));
  }, [assignedIds, loadedInquiries, selectedWsId]);

  const counts = useMemo(
    () => ({
      all: inquiries.length,
      waiting: inquiries.filter((item) => item.status === 'waiting').length,
      answered: inquiries.filter((item) => item.status === 'answered').length,
    }),
    [inquiries]
  );

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return inquiries;
    return inquiries.filter((item) => item.status === statusFilter);
  }, [inquiries, statusFilter]);

  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;
  const reply = selected ? (replyDrafts[selected.id] ?? '') : '';

  const handleWsChange = (workspaceId: string) => {
    setSelectedWsId(workspaceId);
    setStatusFilter('all');
    setSelectedId('');
  };

  const handleStatusFilterChange = (filter: StatusFilter) => {
    setStatusFilter(filter);
    setSelectedId('');
  };

  const handleReplyChange = (value: string) => {
    if (!selected) return;
    setReplyDrafts((prev) => ({ ...prev, [selected.id]: value }));
  };

  const handleReplyConfirm = async () => {
    if (!selected) return;
    const value = reply.trim();
    if (!value) return;
    try {
      await answerInquiry.mutateAsync({
        inquiryId: selected.id,
        answerContent: value,
      });
      setReplyDrafts((prev) => {
        const next = { ...prev };
        delete next[selected.id];
        return next;
      });
      setConfirmOpen(false);
    } catch {
      // 에러 토스트는 mutation hook 에서 처리.
    }
  };

  return (
    <main className="h-full bg-slate-50 p-4 sm:p-6 lg:p-8">
      <section className="mx-auto flex h-full max-w-7xl flex-col gap-4 sm:gap-6">
        <h1 className="border-b border-slate-100 pb-2 text-xl font-bold text-slate-800">
          고객 지원
        </h1>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <WorkspaceCombobox
            workspaces={workspaces}
            selectedId={selectedWsId}
            onChange={handleWsChange}
          />
        </div>

        <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[380px_1fr]">
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold text-slate-900">접수된 문의</h2>
            </div>

            <div className="grid shrink-0 grid-cols-3 border-b border-border-light bg-white px-4 pt-3">
              {STATUS_FILTERS.map((filter) => {
                const active = statusFilter === filter.key;
                const count = counts[filter.key];
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => handleStatusFilterChange(filter.key)}
                    className="flex min-w-0 cursor-pointer flex-col items-center gap-1"
                  >
                    <span
                      className={`w-full truncate px-1 text-center text-xs transition-colors ${
                        active ? 'font-semibold text-text-dark' : 'font-normal text-text-muted'
                      }`}
                    >
                      {filter.label} ({count})
                    </span>
                    <div
                      className={`h-0.5 w-full rounded-full transition-colors ${
                        active ? 'bg-text-accent' : 'bg-transparent'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {isLoading ? (
                <div className="flex min-h-48 items-center justify-center px-5 text-center">
                  <p className="text-xs text-text-muted">문의를 불러오는 중입니다.</p>
                </div>
              ) : isError ? (
                <div className="flex min-h-48 items-center justify-center px-5 text-center">
                  <p className="text-xs text-red-500">
                    {getErrorMessage(error, '문의 목록을 불러오지 못했습니다.')}
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex h-full min-h-48 items-center justify-center px-5 text-center">
                  <p className="text-xs text-text-muted">
                    {inquiries.length === 0
                      ? '접수된 문의가 없습니다.'
                      : '조건에 맞는 문의가 없습니다.'}
                  </p>
                </div>
              ) : (
                filtered.map((item) => {
                  const active = selected?.id === item.id;
                  const workspaceName = workspaceNameById.get(item.workspaceId);
                  const showWorkspaceName = !selectedWsId && !!workspaceName;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`mb-2 flex w-full cursor-pointer flex-col gap-2 rounded-2xl px-4 py-3 text-left transition-colors last:mb-0 ${
                        active ? 'bg-blue-50 ring-1 ring-blue-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <CategoryBadge category={item.category} />
                        <StatusBadge status={item.status} />
                      </div>
                      <div>
                        <p className="line-clamp-2 text-sm font-bold text-slate-900">
                          {item.title}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-400">
                          {showWorkspaceName && (
                            <>
                              <span>{workspaceName}</span>
                              <span className="mx-1">·</span>
                            </>
                          )}
                          {formatDateTime(item.createdAt)}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            {!selected ? (
              <div className="flex min-h-80 items-center justify-center text-center">
                <p className="text-sm text-text-muted">선택된 문의가 없습니다.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoryBadge category={selected.category} />
                    <StatusBadge status={selected.status} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-950">{selected.title}</h2>
                  <p className="text-xs text-slate-400">{formatDateTime(selected.createdAt)}</p>
                </div>

                <div className="grid gap-5 py-5">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-500">고객 문의 내용</p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-800">
                      {selected.content}
                    </p>
                  </div>

                  {selected.answerContent ? (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                      <p className="text-xs font-bold text-emerald-700">등록된 답변</p>
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-emerald-900">
                        {selected.answerContent}
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      <label htmlFor="support-reply" className="text-sm font-bold text-slate-900">
                        답변 작성
                      </label>
                      <textarea
                        id="support-reply"
                        value={reply}
                        onChange={(event) => handleReplyChange(event.target.value)}
                        disabled={answerInquiry.isPending}
                        rows={8}
                        placeholder="고객에게 전달할 답변을 작성해주세요."
                        className="w-full resize-y rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-relaxed text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                      />
                    </div>
                  )}
                </div>

                {!selected.answerContent && (
                  <div className="flex justify-end border-t border-slate-100 pt-5">
                    <Button
                      type="button"
                      onClick={() => setConfirmOpen(true)}
                      disabled={!reply.trim() || answerInquiry.isPending}
                      className="inline-flex items-center justify-center gap-2"
                    >
                      <Send size={16} />
                      {answerInquiry.isPending ? '등록 중...' : '답변 등록'}
                    </Button>
                  </div>
                )}

                <ConfirmModal
                  open={confirmOpen}
                  onClose={() => setConfirmOpen(false)}
                  onConfirm={() => {
                    void handleReplyConfirm();
                  }}
                  title="답변 등록"
                  confirmLabel="등록"
                  loading={answerInquiry.isPending}
                  message={
                    <div className="flex flex-col gap-3">
                      <p>아래 내용으로 답변을 등록하시겠습니까?</p>
                      <div className="max-h-44 overflow-y-auto rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                        {reply.trim()}
                      </div>
                    </div>
                  }
                />
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
