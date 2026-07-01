'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Send } from 'lucide-react';
import { useWorkspaces } from '@/hooks/workspace/useWorkspaceQuery';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { WorkspaceCombobox } from '@/components/ui/WorkspaceCombobox';
import type { Workspace } from '@/types/workspace';

const CATEGORY_LABEL = {
  feature: '기능 제안',
  bug: '오류 신고',
  upgrade: '서비스 업그레이드',
  other: '기타',
} as const;

type CategoryId = keyof typeof CATEGORY_LABEL;
type InquiryStatus = 'waiting' | 'answered';
type StatusFilter = 'all' | InquiryStatus;

const CATEGORY_BADGE_CLASS: Record<CategoryId, string> = {
  feature: 'bg-violet-50 text-violet-700 ring-violet-100',
  bug: 'bg-red-50 text-red-700 ring-red-100',
  upgrade: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  other: 'bg-slate-100 text-slate-600 ring-slate-200',
};

interface SupportInquiryItem {
  id: string;
  workspaceId: string;
  workspaceName: string;
  category: CategoryId;
  title: string;
  content: string;
  createdAt: string;
  status: InquiryStatus;
  reply?: string;
}

const FALLBACK_WORKSPACES: Workspace[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    company_name: '디케이앤디',
    ticker: '263020',
    sir_score: null,
    created_at: '2026-01-01T00:00:00+09:00',
    updated_at: '2026-01-01T00:00:00+09:00',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    company_name: '샘플 고객사',
    ticker: '000000',
    sir_score: null,
    created_at: '2026-01-01T00:00:00+09:00',
    updated_at: '2026-01-01T00:00:00+09:00',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    company_name: '테스트 기업',
    ticker: '111111',
    sir_score: null,
    created_at: '2026-01-01T00:00:00+09:00',
    updated_at: '2026-01-01T00:00:00+09:00',
  },
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체 문의' },
  { key: 'waiting', label: '답변 대기' },
  { key: 'answered', label: '답변 완료' },
];

function buildSampleInquiries(workspaces: Workspace[]): SupportInquiryItem[] {
  const [first, second = first, third = first] = workspaces;
  if (!first) return [];

  const items: SupportInquiryItem[] = [
    {
      id: `inq-${first.id}-upgrade`,
      workspaceId: first.id,
      workspaceName: first.company_name,
      category: 'upgrade',
      title: '위기 대응 센터 기능을 추가로 사용하고 싶습니다',
      content:
        '현재 보고서와 인사이트를 확인하고 있습니다. 리스크 콘텐츠 처리 결과까지 확인할 수 있도록 서비스 업그레이드 가능 여부와 예상 일정을 안내해주세요.',
      createdAt: '2026-07-01T10:24:00+09:00',
      status: 'waiting',
    },
    {
      id: `inq-${second.id}-bug`,
      workspaceId: second.id,
      workspaceName: second.company_name,
      category: 'bug',
      title: '모바일에서 보고서 탭 이동이 잘 안 됩니다',
      content:
        '아이폰 사파리에서 보고서 하단 탭을 누르면 가끔 반응이 없습니다. 새로고침하면 다시 동작하지만 반복적으로 발생합니다.',
      createdAt: '2026-07-01T09:42:00+09:00',
      status: 'answered',
      reply:
        '제보 감사합니다. 모바일 사파리 탭 이벤트를 확인 중이며, 재현 환경을 확보한 뒤 수정 예정입니다. 임시로 새로고침 후 이용 부탁드립니다.',
    },
    {
      id: `inq-${third.id}-feature`,
      workspaceId: third.id,
      workspaceName: third.company_name,
      category: 'feature',
      title: '주간 리포트 요약을 메일로 받고 싶습니다',
      content:
        '매주 월요일 오전에 주간 핵심 지표와 주요 리스크만 요약해서 받을 수 있는 기능이 있으면 좋겠습니다.',
      createdAt: '2026-06-30T16:18:00+09:00',
      status: 'waiting',
    },
  ];

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${mm}.${dd} ${hh}:${min}`;
}

function statusLabel(status: InquiryStatus) {
  return status === 'answered' ? '답변 완료' : '답변 대기';
}

function StatusBadge({ status }: { status: InquiryStatus }) {
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

function CategoryBadge({ category }: { category: CategoryId }) {
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold ring-1 ${CATEGORY_BADGE_CLASS[category]}`}
    >
      {CATEGORY_LABEL[category]}
    </span>
  );
}

interface SupportAdminInboxProps {
  assignedIds: string[] | null;
}

export function SupportAdminInbox({ assignedIds }: SupportAdminInboxProps) {
  const { data: allWorkspaces = [] } = useWorkspaces();
  const workspaces = useMemo(() => {
    const source = allWorkspaces.length > 0 ? allWorkspaces : FALLBACK_WORKSPACES;
    if (assignedIds === null) return source;
    if (allWorkspaces.length === 0) return source;
    const allowed = new Set(assignedIds);
    return source.filter((workspace) => allowed.has(workspace.id));
  }, [allWorkspaces, assignedIds]);

  const baseInquiries = useMemo(() => buildSampleInquiries(workspaces), [workspaces]);
  const [answeredById, setAnsweredById] = useState<Record<string, string>>({});
  const [selectedWsId, setSelectedWsId] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const inquiries = useMemo(
    () =>
      baseInquiries
        .map((item) => {
          const overrideReply = answeredById[item.id];
          if (!overrideReply) return item;
          return { ...item, status: 'answered' as InquiryStatus, reply: overrideReply };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [baseInquiries, answeredById]
  );

  const workspaceFiltered = useMemo(() => {
    if (!selectedWsId) return inquiries;
    return inquiries.filter((item) => item.workspaceId === selectedWsId);
  }, [inquiries, selectedWsId]);

  const counts = useMemo(
    () => ({
      all: workspaceFiltered.length,
      waiting: workspaceFiltered.filter((item) => item.status === 'waiting').length,
      answered: workspaceFiltered.filter((item) => item.status === 'answered').length,
    }),
    [workspaceFiltered]
  );

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return workspaceFiltered;
    return workspaceFiltered.filter((item) => item.status === statusFilter);
  }, [workspaceFiltered, statusFilter]);

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

  const handleReplyConfirm = () => {
    if (!selected) return;
    const value = reply.trim();
    if (!value) return;
    setAnsweredById((prev) => ({ ...prev, [selected.id]: value }));
    setReplyDrafts((prev) => {
      const next = { ...prev };
      delete next[selected.id];
      return next;
    });
    setConfirmOpen(false);
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
              {filtered.length === 0 ? (
                <div className="flex min-h-48 items-center justify-center px-5 text-center">
                  <p className="text-xs text-text-muted">조건에 맞는 문의가 없습니다.</p>
                </div>
              ) : (
                filtered.map((item) => {
                  const active = selected?.id === item.id;
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
                        <p className="mt-1 text-xs text-slate-400">
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

                  {selected.reply ? (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                      <p className="text-xs font-bold text-emerald-700">등록된 답변</p>
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-emerald-900">
                        {selected.reply}
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
                        rows={8}
                        placeholder="고객에게 전달할 답변을 작성해주세요."
                        className="w-full resize-y rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-relaxed text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>
                  )}
                </div>

                {!selected.reply && (
                  <div className="flex justify-end border-t border-slate-100 pt-5">
                    <Button
                      type="button"
                      onClick={() => setConfirmOpen(true)}
                      disabled={!reply.trim()}
                      className="inline-flex items-center justify-center gap-2"
                    >
                      <Send size={16} />
                      답변 등록
                    </Button>
                  </div>
                )}

                <ConfirmModal
                  open={confirmOpen}
                  onClose={() => setConfirmOpen(false)}
                  onConfirm={handleReplyConfirm}
                  title="답변 등록"
                  confirmLabel="등록"
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
