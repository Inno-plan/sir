'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/auth/actions';
import {
  Home,
  LayoutDashboard,
  ShieldAlert,
  Users,
  Activity,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  X,
} from 'lucide-react';
import { SirSymbol } from '@/components/icons/SirSymbol';
import { SirLogoIcon } from '@/components/icons/SirLogo.Icon';
import type { LucideIcon } from 'lucide-react';
import type { AuthUser, ProfileRole } from '@/types/auth';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
  /** 미지정 = 전역 노출. 값 있으면 해당 role 에게만 노출. */
  roles?: ProfileRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: '홈', href: '/', icon: Home, roles: ['super_admin', 'admin'] },
  { label: '워크스페이스', href: '/workspace', icon: LayoutDashboard },
  { label: '리스크 관리', href: '/risk-reports', icon: ShieldAlert },
  { label: '유저 관리', href: '/users', icon: Users, roles: ['super_admin'] },
  { label: '모니터링', href: '/ops', icon: Activity, roles: ['super_admin'] },
  { label: '설정', href: '#', icon: Settings, disabled: true },
];

function getVisibleNavItems(role: ProfileRole | undefined): NavItem[] {
  return NAV_ITEMS.filter((i) => !i.roles || (role && i.roles.includes(role)));
}

interface AppShellProps {
  children: React.ReactNode;
  user?: AuthUser | null;
}

export function AppShell({ children, user = null }: AppShellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const visibleNav = getVisibleNavItems(user?.role);
  const currentLabel = visibleNav.find(
    (i) => pathname === i.href || (i.href !== '#' && pathname?.startsWith(i.href + '/'))
  )?.label;

  return (
    <div className="h-screen flex overflow-hidden">
      {/* 데스크톱 사이드바 — lg 미만 숨김 */}
      <aside
        className={`hidden lg:flex ${isOpen ? 'w-56' : 'w-16'} bg-white border-r border-slate-100 flex-col shrink-0 transition-all duration-300`}
      >
        <SidebarBody isOpen={isOpen} onToggle={setIsOpen} pathname={pathname} user={user} compact />
      </aside>

      {/* 모바일 drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 bg-white border-r border-slate-100 flex flex-col shadow-xl animate-in slide-in-from-left duration-200">
            <SidebarBody
              isOpen
              onToggle={() => setMobileOpen(false)}
              pathname={pathname}
              user={user}
              closeLabel="닫기"
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* 모바일 상단바 */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 h-12 px-3 bg-white/90 backdrop-blur border-b border-slate-100">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="메뉴 열기"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Menu size={18} />
          </button>
          <Link href="/" className="flex items-center gap-1.5">
            <SirSymbol size={14} />
            <SirLogoIcon width={40} height={14} />
          </Link>
          {currentLabel && (
            <>
              <span className="text-slate-200">·</span>
              <span className="text-xs font-semibold text-slate-600 truncate">{currentLabel}</span>
            </>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function SidebarBody({
  isOpen,
  onToggle,
  pathname,
  user,
  compact = false,
  closeLabel,
  onNavigate,
}: {
  isOpen: boolean;
  onToggle: (v: boolean) => void;
  pathname: string | null | undefined;
  user: AuthUser | null;
  compact?: boolean;
  closeLabel?: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {/* 로고 / 토글 */}
      <div className={`relative flex items-center ${isOpen ? 'px-3 py-3' : 'justify-center py-3'}`}>
        {isOpen ? (
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 hover:opacity-80 transition-opacity"
          >
            <SirSymbol size={14} />
            <SirLogoIcon width={48} height={18} />
          </Link>
        ) : (
          <button
            onClick={() => onToggle(true)}
            className="px-3 py-2 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <SirSymbol size={16} />
          </button>
        )}
        {isOpen && compact && (
          <button
            onClick={() => onToggle(false)}
            className="absolute right-3 text-slate-300 hover:text-slate-500 transition-colors cursor-pointer"
            aria-label="사이드바 접기"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        {isOpen && !compact && (
          <button
            onClick={() => onToggle(false)}
            className="absolute right-3 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label={closeLabel ?? '닫기'}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* 네비게이션 */}
      <nav className={`flex-1 py-2 flex flex-col gap-0.5 ${isOpen ? 'px-2' : 'px-2 items-center'}`}>
        {getVisibleNavItems(user?.role).map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || (item.href !== '#' && pathname?.startsWith(item.href + '/'));

          return (
            <Link
              key={item.label}
              href={item.disabled ? '#' : item.href}
              onClick={item.disabled ? undefined : onNavigate}
              className={`group/item relative flex items-center gap-3 rounded-xl text-sm font-medium transition-colors ${
                isOpen ? 'px-3 py-2.5' : 'w-10 h-10 justify-center'
              } ${
                item.disabled
                  ? 'text-slate-300 cursor-default'
                  : isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Icon
                size={18}
                className={`shrink-0 ${
                  item.disabled ? 'text-slate-300' : isActive ? 'text-blue-600' : 'text-slate-400'
                }`}
              />
              <span
                className={`whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 hidden'}`}
              >
                {item.label}
              </span>
              {isOpen && item.disabled && (
                <span className="ml-auto text-[10px] text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded-full">
                  soon
                </span>
              )}
              {!isOpen && (
                <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg opacity-0 group-hover/item:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg z-50">
                  {item.label}
                  {item.disabled && <span className="ml-1.5 text-slate-400">soon</span>}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* 유저 정보 */}
      <div
        className={`border-t border-slate-100 ${isOpen ? 'px-4 py-4' : 'flex justify-center py-4'}`}
      >
        {isOpen ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">
                {user?.companyName ?? '사용자'}
              </p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => logout()}
              className="text-slate-300 hover:text-red-400 transition-colors cursor-pointer shrink-0"
              aria-label="로그아웃"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => logout()}
            className="mx-auto text-slate-300 hover:text-red-400 transition-colors cursor-pointer"
            aria-label="로그아웃"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </>
  );
}
