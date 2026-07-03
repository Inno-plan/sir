'use client';

import { useState } from 'react';
import { login } from '@/app/auth/actions';
import { SirSymbol } from '@/components/icons/SirSymbol';
import { SirLogoIcon } from '@/components/icons/SirLogo.Icon';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await login(formData);

    if (!result.success) {
      setError(result.error ?? '로그인에 실패했습니다.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-light flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2.5 mb-3">
            <SirSymbol size={22} />
            <SirLogoIcon width={72} height={28} />
          </div>
          <p className="text-sm text-text-muted">AI 기반 디지털 평판 관리 플랫폼</p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* 폼 */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-border-light p-6 space-y-4 shadow-sm"
        >
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-dark mb-1">
              이메일
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full px-3 py-2 border border-border-light rounded-lg text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-bg-accent focus:border-transparent"
              placeholder="name@company.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-dark mb-1">
              비밀번호
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full px-3 py-2 border border-border-light rounded-lg text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-bg-accent focus:border-transparent"
              placeholder="비밀번호"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-bg-accent text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* 약관 링크 */}
        <div className="mt-6 flex items-center justify-center gap-3 text-xs text-text-muted">
          <a
            href="https://protective-wasabi-62e.notion.site/39006eadfe0e8076a985d765bee5bf86"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-dark hover:underline transition-colors"
          >
            개인정보처리방침
          </a>
          <span className="text-border-light">|</span>
          <a
            href="https://protective-wasabi-62e.notion.site/39006eadfe0e8058bf86e140bdc01d3d?pvs=74"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-dark hover:underline transition-colors"
          >
            이용약관
          </a>
        </div>
      </div>
    </div>
  );
}
