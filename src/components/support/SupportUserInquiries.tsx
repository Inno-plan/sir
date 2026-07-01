'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, MessageCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SupportInquiryForm } from '@/components/support/SupportInquiryForm';
import {
  useSupportInquiries,
  useSupportInquiriesRealtime,
} from '@/hooks/support/useSupportQuery';
import {
  getSupportCategoryLabel,
  type SupportCategory,
  type SupportInquiryStatus,
} from '@/lib/api/supportApi';
import { getErrorMessage } from '@/lib/utils';

type StatusFilter = 'all' | SupportInquiryStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체 문의' },
  { key: 'waiting', label: '답변 대기' },
  { key: 'answered', label: '답변 완료' },
];

const CATEGORY_BADGE_CLASS: Record<SupportCategory, string> = {
  feature: 'bg-violet-50 text-violet-700 ring-violet-100',
  bug: 'bg-red-50 text-red-700 ring-red-100',
  upgrade: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  other: 'bg-slate-100 text-slate-600 ring-slate-200',
};

interface SupportUserInquiriesProps {
  workspaceId: string;
  defaultCategory?: string;
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

export function SupportUserInquiries({
  workspaceId,
  defaultCategory,
}: SupportUserInquiriesProps) {
  const [writeOpen, setWriteOpen] = useState(Boolean(defaultCategory));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const {
    data: inquiries = [],
    isLoading,
    isError,
    error,
  } = useSupportInquiries(workspaceId);

  useSupportInquiriesRealtime(workspaceId);

  const counts = useMemo(
    () => ({
      all: inquiries.length,
      waiting: inquiries.filter((item) => item.status === 'waiting').length,
      answered: inquiries.filter((item) => item.status === 'answered').length,
    }),
    [inquiries],
  );

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return inquiries;
    return inquiries.filter((item) => item.status === statusFilter);
  }, [inquiries, statusFilter]);

  const selectedInquiry = useMemo(
    () => inquiries.find((item) => item.id === selectedId) ?? null,
    [inquiries, selectedId],
  );

  return (
    <div className="h-full overflow-y-auto bg-white">
      <section className="mx-auto flex w-full max-w-[1240px] flex-col gap-7 px-4 py-7 lg:px-10 lg:py-10">
        <header className="flex flex-col gap-3 rounded-xl bg-bg-dark px-5 py-5 lg:px-10 lg:py-8">
          <div className="flex items-center gap-2.5">
            <MessageCircle size={24} className="text-blue-400" />
            <h1 className="text-xl font-bold text-white lg:text-2xl">고객 지원</h1>
          </div>
          <p className="text-xs font-medium text-slate-300 lg:text-sm">
            등록한 문의 내역을 확인하고 새 문의를 작성할 수 있습니다.
          </p>
        </header>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900">내 문의</h2>
              <p className="mt-1 text-xs text-slate-500">
                접수된 문의는 최신순으로 표시됩니다.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setWriteOpen(true)}
              className="inline-flex shrink-0 items-center justify-center gap-2"
            >
              <Plus size={16} />
              문의 작성
            </Button>
          </div>

          <div className="grid grid-cols-3 border-b border-border-light bg-white px-4 pt-3 sm:px-6">
            {STATUS_FILTERS.map((filter) => {
              const active = statusFilter === filter.key;
              const count = counts[filter.key];
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setStatusFilter(filter.key)}
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

          <div className="min-h-[360px] p-4 sm:p-6">
            {isLoading ? (
              <div className="flex min-h-[320px] items-center justify-center text-center">
                <p className="text-sm text-text-muted">문의 내역을 불러오는 중입니다.</p>
              </div>
            ) : isError ? (
              <div className="flex min-h-[320px] items-center justify-center px-5 text-center">
                <p className="text-sm text-red-500">
                  {getErrorMessage(error, '문의 내역을 불러오지 못했습니다.')}
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 px-5 text-center">
                <p className="text-sm text-text-muted">
                  {inquiries.length === 0
                    ? '등록한 문의가 없습니다.'
                    : '조건에 맞는 문의가 없습니다.'}
                </p>
                {inquiries.length === 0 && (
                  <Button
                    type="button"
                    onClick={() => setWriteOpen(true)}
                    className="inline-flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    문의 작성하기
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-3">
                {filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className="flex w-full cursor-pointer flex-col gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-4 text-left shadow-sm transition-colors hover:border-slate-200 hover:bg-slate-50 sm:px-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryBadge category={item.category} />
                      <StatusBadge status={item.status} />
                    </div>
                    <h3 className="line-clamp-1 text-base font-bold text-slate-950">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-400">{formatDateTime(item.createdAt)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </section>

      <Modal open={writeOpen} onClose={() => setWriteOpen(false)} title="문의 작성" size="xl">
        <SupportInquiryForm
          variant="modal"
          defaultCategory={defaultCategory}
          workspaceId={workspaceId}
          onSubmitted={() => setWriteOpen(false)}
        />
      </Modal>

      <Modal
        open={Boolean(selectedInquiry)}
        onClose={() => setSelectedId(null)}
        title="문의 상세"
        size="xl"
      >
        {selectedInquiry && (
          <div className="grid gap-5">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-5">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryBadge category={selectedInquiry.category} />
                <StatusBadge status={selectedInquiry.status} />
                <span className="text-xs text-slate-400">
                  {formatDateTime(selectedInquiry.createdAt)}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-950">{selectedInquiry.title}</h2>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">문의 내용</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-800">
                {selectedInquiry.content}
              </p>
            </div>

            {selectedInquiry.answerContent ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-xs font-bold text-emerald-700">등록된 답변</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-emerald-900">
                  {selectedInquiry.answerContent}
                </p>
                {selectedInquiry.answeredAt && (
                  <p className="mt-3 text-xs text-emerald-700">
                    {formatDateTime(selectedInquiry.answeredAt)}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-2xl bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-700">
                  관리자 답변을 기다리고 있습니다.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
