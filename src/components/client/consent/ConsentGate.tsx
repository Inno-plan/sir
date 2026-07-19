'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { LogOut } from 'lucide-react';
import { logout } from '@/app/auth/actions';
import { agreeToTerms } from '@/lib/legal/actions';

export function ConsentGate() {
  const router = useRouter();
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const allAgreed = termsAgreed && privacyAgreed;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function toggleAll(checked: boolean) {
    setTermsAgreed(checked);
    setPrivacyAgreed(checked);
  }

  function submitConsent() {
    if (!allAgreed || isPending) return;

    setError(null);
    startTransition(async () => {
      const result = await agreeToTerms();
      if (!result.success) {
        setError(result.error ?? '동의를 저장하지 못했습니다.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-stretch bg-slate-950/50 sm:items-center sm:justify-center sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        aria-describedby="consent-description"
        className="flex h-full w-full flex-col bg-white sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl sm:shadow-2xl"
      >
        <div className="border-b border-slate-100 px-5 py-5 sm:px-7 sm:py-6">
          <h1 id="consent-title" className="text-xl font-bold text-text-dark">
            약관 및 개인정보처리방침 동의
          </h1>
          <p id="consent-description" className="mt-2 text-sm leading-relaxed text-text-muted">
            각 문서의 전문을 확인한 후 동의 여부를 선택해주세요.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-bg-light px-4 py-3">
            <input
              type="checkbox"
              checked={allAgreed}
              onChange={(event) => toggleAll(event.target.checked)}
              className="size-4 accent-bg-accent"
            />
            <span className="text-sm font-semibold text-text-dark">모두 동의</span>
          </label>

          <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-border-light px-4">
            <ConsentItem
              checked={termsAgreed}
              onChange={setTermsAgreed}
              label="이용약관 동의"
              href="/legal/terms"
            />
            <ConsentItem
              checked={privacyAgreed}
              onChange={setPrivacyAgreed}
              label="개인정보처리방침 동의"
              href="/legal/privacy"
            />
          </div>

          <p className="mt-4 text-xs leading-relaxed text-text-muted">
            필수 항목에 동의하지 않으면 SIR 서비스를 이용할 수 없습니다.
          </p>

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="border-t border-slate-100 px-5 py-4 sm:px-7 sm:py-5">
          <button
            type="button"
            disabled={!allAgreed || isPending}
            onClick={submitConsent}
            className="w-full rounded-lg bg-bg-accent py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? '동의 저장 중...' : '동의하고 시작하기'}
          </button>
          <button
            type="button"
            onClick={() => logout()}
            disabled={isPending}
            className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 py-1 text-xs text-text-muted transition-colors hover:text-text-dark disabled:cursor-not-allowed"
          >
            <LogOut size={14} />
            로그아웃
          </button>
        </div>
      </section>
    </div>
  );
}

interface ConsentItemProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  href: string;
}

function ConsentItem({ checked, onChange, label, href }: ConsentItemProps) {
  return (
    <div className="flex items-center gap-3 py-4">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="size-4 shrink-0 accent-bg-accent"
        />
        <span className="truncate text-sm text-text-dark">
          <span className="font-semibold text-text-accent">[필수]</span> {label}
        </span>
      </label>
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-xs font-medium text-text-muted underline underline-offset-2 hover:text-text-dark"
      >
        전문 보기
      </Link>
    </div>
  );
}
