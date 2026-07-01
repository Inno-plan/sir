'use client';

import { useState } from 'react';
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { Check, CheckCircle2, ChevronDown, MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const CATEGORY_OPTIONS = [
  {
    id: 'feature',
    label: '기능 제안',
    placeholder: '제안하고 싶은 기능과 현재 업무에서 불편한 점, 기대하는 개선 결과를 작성해주세요.',
  },
  {
    id: 'bug',
    label: '오류 신고',
    placeholder: '오류가 발생한 화면, 재현 방법, 기대한 동작과 실제 동작을 자세히 작성해주세요.',
  },
  {
    id: 'upgrade',
    label: '서비스 업그레이드',
    placeholder:
      '필요한 기능, 대상 워크스페이스, 희망 적용 시점 등 업그레이드 문의 내용을 작성해주세요.',
  },
  {
    id: 'other',
    label: '기타',
    placeholder: '문의 목적과 필요한 후속 조치를 자유롭게 작성해주세요.',
  },
] as const;

type CategoryId = (typeof CATEGORY_OPTIONS)[number]['id'];

type Audience = 'admin' | 'user';

interface SupportInquiryFormProps {
  audience: Audience;
  defaultCategory?: string;
  userEmail?: string;
  companyName?: string;
  workspaceId?: string;
}

function isCategoryId(value: string | undefined): value is CategoryId {
  return CATEGORY_OPTIONS.some((option) => option.id === value);
}

function categoryLabel(category: CategoryId) {
  return CATEGORY_OPTIONS.find((option) => option.id === category)?.label ?? '기타';
}

function categoryPlaceholder(category: CategoryId) {
  return CATEGORY_OPTIONS.find((option) => option.id === category)?.placeholder ?? '';
}

export function SupportInquiryForm({ defaultCategory }: SupportInquiryFormProps) {
  const initialCategory = isCategoryId(defaultCategory) ? defaultCategory : 'feature';
  const [category, setCategory] = useState<CategoryId>(initialCategory);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const selectedCategory = CATEGORY_OPTIONS.find((option) => option.id === category);
  const contentLength = content.trim().length;
  const canSubmit = title.trim().length > 0 && contentLength > 0;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitted(true);
  };

  const handleReset = () => {
    setSubmitted(false);
    setTitle('');
    setContent('');
    setCategory(initialCategory);
  };

  return (
    <div className="h-full bg-white overflow-y-auto">
      <section className="mx-auto flex w-full max-w-[1240px] flex-col gap-7 px-4 py-7 lg:px-10 lg:py-10">
        <header className="flex flex-col gap-3 rounded-xl bg-bg-dark px-5 py-5 lg:px-10 lg:py-8">
          <div className="flex items-center gap-2.5">
            <MessageCircle size={24} className="text-blue-400" />
            <h1 className="text-xl font-bold text-white lg:text-2xl">고객 지원</h1>
          </div>
          <p className="text-xs font-medium text-slate-300 lg:text-sm">
            문의 유형을 선택하고 필요한 내용을 작성해주세요.
          </p>
        </header>

        {submitted && (
          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900 sm:flex-row sm:items-start">
            <CheckCircle2 className="mt-0.5 shrink-0" size={20} />
            <div className="flex-1">
              <p className="text-sm font-bold">문의가 접수되었습니다.</p>
              <p className="mt-1 text-sm leading-relaxed text-emerald-800">
                선택한 문의 종류는 <strong>{categoryLabel(category)}</strong>입니다.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleReset}
              variant="secondary"
              size="sm"
              className="w-fit bg-white text-emerald-700 shadow-sm hover:bg-emerald-100"
            >
              새 문의 작성
            </Button>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
        >
          <div className="grid gap-2">
            <label htmlFor="support-category" className="text-sm font-bold text-slate-900">
              문의 종류 <span className="text-red-500">*</span>
            </label>
            <Listbox value={category} onChange={setCategory}>
              <div className="relative w-full sm:w-72">
                <ListboxButton
                  id="support-category"
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors hover:bg-slate-50 focus:border-blue-400 focus:outline-none"
                >
                  <span className="flex-1 text-left font-semibold text-slate-700">
                    {selectedCategory?.label}
                  </span>
                  <ChevronDown size={16} className="shrink-0 text-slate-400" />
                </ListboxButton>
                <ListboxOptions className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {CATEGORY_OPTIONS.map((option) => (
                    <ListboxOption
                      key={option.id}
                      value={option.id}
                      className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors data-[focus]:bg-blue-50"
                    >
                      {({ selected }) => (
                        <>
                          <Check
                            size={14}
                            className={selected ? 'text-blue-600' : 'text-transparent'}
                          />
                          <span
                            className={selected ? 'font-semibold text-blue-600' : 'text-slate-700'}
                          >
                            {option.label}
                          </span>
                        </>
                      )}
                    </ListboxOption>
                  ))}
                </ListboxOptions>
              </div>
            </Listbox>
          </div>

          <div className="grid gap-2">
            <label htmlFor="support-title" className="text-sm font-bold text-slate-900">
              문의 제목 <span className="text-red-500">*</span>
            </label>
            <input
              id="support-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="문의 제목을 입력해주세요."
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              maxLength={80}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="support-content" className="text-sm font-bold text-slate-900">
                문의 내용 <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-slate-400">{contentLength.toLocaleString()}자</span>
            </div>
            <textarea
              id="support-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={categoryPlaceholder(category)}
              rows={8}
              className="w-full resize-y rounded-lg border border-slate-200 px-4 py-3 text-sm leading-relaxed text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-5">
            <Button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center justify-center gap-2"
            >
              <Send size={16} />
              문의 작성
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
