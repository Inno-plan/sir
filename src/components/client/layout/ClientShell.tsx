'use client';

import { ClientSidebar } from '@/components/client/sidebar/ClientSidebar';
import { MobileFab } from '@/components/client/MobileFab';
import { MobileHeader } from '@/components/client/MobileHeader';
import { MobileTabBar } from '@/components/client/MobileTabBar';
import { ContractExpiryNotice } from '@/components/client/layout/ContractExpiryNotice';
import type { AuthUser } from '@/types/auth';

interface ClientShellProps {
  children: React.ReactNode;
  user?: AuthUser | null;
}

export function ClientShell({ children, user = null }: ClientShellProps) {
  return (
    <div className="h-screen w-full bg-slate-50 flex overflow-hidden">
      {/* 데스크톱: 사이드바 */}
      <div className="hidden lg:flex h-full">
        <ClientSidebar user={user} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 모바일: 상단 헤더 */}
        <MobileHeader user={user} />

        <main
          id="client-main"
          className="relative flex-1 overflow-y-auto pt-12.25 pb-14.5 lg:pt-0 lg:pb-0"
        >
          {children}
        </main>
      </div>

      {/* 모바일: 하단 탭 + FAB 섹션 네비 (보고서 페이지 한정) */}
      <MobileTabBar />
      <MobileFab />
      <ContractExpiryNotice user={user} />
    </div>
  );
}
