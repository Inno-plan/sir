'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, ExternalLink, Check, AlertCircle } from 'lucide-react';
import { ReportHeader } from '@/components/report/ReportHeader';
import { Highlight } from '@/components/report/Highlight';
import { OnlineReputation } from '@/components/report/OnlineReputation';
// import { RiskContent } from '@/components/report/RiskContent';
import { Strategy } from '@/components/report/Strategy';
import { Loading } from '@/components/ui/Loading';
import { AdminButton } from '@/components/ui/AdminButton';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  useWorkspaceSuspense,
  useReportProgressSuspense,
} from '@/hooks/workspace/useWorkspaceQuery';
import { useReportInfoSuspense } from '@/hooks/report/useReportQuery';
import { usePublishReport } from '@/hooks/report/useReportMutation';
import { getClientReportSections } from '@/components/client/sidebar/sections';
import {
  ACTIVE_PLATFORMS,
  isAllPlatformsDone,
  WEEKLY_REQUIRED_CATEGORIES,
} from '@/lib/api/workspaceApi';

const PLATFORM_LABELS: Record<string, string> = {
  naver_news: '뉴스',
  naver_blog: '블로그',
  youtube: '유튜브',
  naver_stock: '종토방',
  dcinside: '디시인사이드',
};

const BG_COLORS = {
  'bg-light': 'var(--color-bg-light)',
  blue: '#f5faff',
} as const;

function SectionBg({
  color,
  gradient,
  children,
}: {
  color: keyof typeof BG_COLORS;
  gradient?: 'from-light' | 'from-blue';
  children: React.ReactNode;
}) {
  const bg = BG_COLORS[color];
  const gradientFrom =
    gradient === 'from-light'
      ? BG_COLORS['bg-light']
      : gradient === 'from-blue'
        ? BG_COLORS.blue
        : null;

  return (
    <div style={{ backgroundColor: bg }}>
      {gradientFrom && (
        <div
          className="h-10"
          style={{ background: `linear-gradient(to bottom, ${gradientFrom}, ${bg})` }}
        />
      )}
      <div className="mx-auto max-w-[1200px] px-10 py-5">{children}</div>
    </div>
  );
}

export default function ReportPage() {
  // SSR 시점엔 QueryClient 캐시가 비어 있어 서버는 항상 Loading fallback 을 렌더하는데,
  // 클라이언트에는 이전 세션에서 남은 캐시가 있어 useSuspenseQuery 가 즉시 data 를 반환,
  // hydration 불일치가 발생한다. 마운트 전까지는 서버와 동일하게 Loading 만 렌더해 일치시킨다.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []); // eslint-disable-line react-hooks/set-state-in-effect
  if (!mounted) return <Loading />;

  return (
    <Suspense fallback={<Loading />}>
      <ReportPageContent />
    </Suspense>
  );
}

function ReportPageContent() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspaceId = params?.workspaceId as string;
  const reportId = params?.reportId as string;

  const { data: workspace } = useWorkspaceSuspense(workspaceId);
  const { data: report } = useReportInfoSuspense(workspaceId, reportId);
  const { data: progressList } = useReportProgressSuspense(workspaceId);
  const publishMutation = usePublishReport(reportId, workspaceId);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  const isPublished = report?.status === 'published';
  const isDraft = report?.status === 'draft';
  const isDaily = report?.type === 'daily';

  const progress = progressList?.find((p) => p.reportId === reportId);
  const platformsOk = isAllPlatformsDone(progress, report?.type);
  const failedPlatforms = useMemo(() => {
    if (!progress) return [] as string[];
    if (report?.type === 'weekly') {
      // weekly 컴파일 보고서는 sessions 매핑 없음 → strategies 4종 미완료를 라벨로.
      return WEEKLY_REQUIRED_CATEGORIES.filter(
        (c) => !progress.strategies.some((s) => s.category === c && s.status === 'done'),
      ) as unknown as string[];
    }
    const map = new Map(progress.sessions.map((s) => [s.platform_id, s]));
    return ACTIVE_PLATFORMS.filter((p) => map.get(p)?.status !== 'done');
  }, [progress, report?.type]);

  const sections = useMemo(() => getClientReportSections(report?.type), [report?.type]);
  const sectionParam = searchParams?.get('section');
  const activeSection =
    sectionParam && sections.some((s) => s.id === sectionParam)
      ? sectionParam
      : (sections[0]?.id ?? 'section-highlight');

  const handleTabClick = (id: string) => {
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    next.set('section', id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  if (!report) {
    return (
      <div className="min-h-full bg-slate-100 px-6 py-10 lg:px-10">
        <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-900">보고서를 찾을 수 없습니다.</p>
          <p className="mt-2 text-sm text-slate-500">
            요청한 워크스페이스와 보고서 조합이 올바르지 않습니다.
          </p>
          <Link
            href={`/workspace/${workspaceId}`}
            className="mt-5 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            워크스페이스로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-100 px-6 pt-8 lg:px-10 lg:pt-10 pb-0">
      <div className="mx-auto max-w-[1280px] flex flex-col gap-4">
        {/* 상단 바 */}
        <div className="flex items-center justify-between">
          <nav className="flex items-center gap-1.5 text-sm">
            <Link
              href="/workspace"
              className="text-text-muted hover:text-text-dark transition-colors"
            >
              워크스페이스
            </Link>
            <ChevronRight size={14} className="text-slate-300" />
            <Link
              href={`/workspace/${workspaceId}`}
              className="text-text-muted hover:text-text-dark transition-colors"
            >
              {workspace?.company_name ?? '...'}
            </Link>
            <ChevronRight size={14} className="text-slate-300" />
            <span className="text-slate-700 font-semibold">보고서</span>
          </nav>
          <Link
            href={`/report/${workspaceId}/${reportId}`}
            target="_blank"
            className="group flex items-center gap-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:border-slate-400 hover:bg-slate-50 px-4 py-2 rounded-lg transition-all shadow-sm"
          >
            보고서 보기
            <ExternalLink
              size={13}
              className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
            />
          </Link>
        </div>

        {/* 섹션 탭 — 데스크톱: flex-1 균등 분할 / 모바일: 가로 스크롤 */}
        <div className="flex gap-1 border-b border-slate-200 w-full h-full overflow-x-auto overflow-y-hidden">
          {sections.map((s) => {
            const active = activeSection === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleTabClick(s.id)}
                className={`shrink-0 lg:flex-1 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'border-slate-700 text-slate-800'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* 종이 */}
        <div className="bg-white rounded-2xl shadow-[0_2px_40px_rgba(0,0,0,0.08)] overflow-hidden">
          <SectionBg color="bg-light">
            <div className="flex flex-col gap-10">
              <ReportHeader workspaceId={workspaceId} reportId={reportId} showPdfButton={false} />
              {activeSection === 'section-highlight' && (
                <Highlight workspaceId={workspaceId} reportId={reportId} editable />
              )}
            </div>
          </SectionBg>
          {activeSection === 'section-reputation' && (
            <SectionBg color="blue" gradient="from-light">
              <OnlineReputation workspaceId={workspaceId} reportId={reportId} />
            </SectionBg>
          )}
          {/* 리스크 콘텐츠 관리 섹션 임시 비노출.
          {activeSection === 'section-risk' && (
            <SectionBg color="blue" gradient={isDaily ? undefined : 'from-light'}>
              <RiskContent workspaceId={workspaceId} reportId={reportId} editable />
            </SectionBg>
          )}
          */}
          {activeSection === 'section-strategy' && !isDaily && (
            <SectionBg color="bg-light" gradient="from-blue">
              <Strategy workspaceId={workspaceId} reportId={reportId} editable />
            </SectionBg>
          )}
        </div>
      </div>

      {/* 종이와 발행 바 사이 여백 — daily 는 자동 발행이므로 바 자체 숨김 */}
      {!isDaily && <div className="h-8 lg:h-10" />}

      {/* 하단 고정 발행 바 (주간/월간 전용) — iOS safe-area 가림 방지 */}
      {!isDaily && (
        <div
          className="sticky bottom-0 z-30 bg-white/90 backdrop-blur-md border-t border-slate-200 -mx-6 lg:-mx-10"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-3 flex flex-col gap-2">
            {!platformsOk && failedPlatforms.length > 0 && !isPublished && (
              <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-snug">
                  <span className="font-semibold">실패/미완료 플랫폼이 있습니다:</span>{' '}
                  {failedPlatforms.map((p) => PLATFORM_LABELS[p] ?? p).join(', ')}
                  <span className="text-amber-700">
                    {' '}
                    — 워크스페이스 화면에서 재시도 후 발행하세요.
                  </span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPublished && <Check size={16} className="text-emerald-500" />}
                <span
                  className={`text-sm font-medium ${isPublished ? 'text-emerald-600' : isDraft ? 'text-slate-500' : 'text-amber-600'}`}
                >
                  {isPublished ? '발행됨' : isDraft ? '검토 대기' : '분석 중 — 발행 불가'}
                </span>
              </div>
              <AdminButton
                variant={isPublished ? 'secondary' : 'primary'}
                onClick={() => setShowPublishConfirm(true)}
                disabled={publishMutation.isPending || !isDraft || !platformsOk}
              >
                {publishMutation.isPending
                  ? '발행 중...'
                  : isPublished
                    ? '발행 완료'
                    : !platformsOk
                      ? '재시도 필요'
                      : '보고서 발행'}
              </AdminButton>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={showPublishConfirm}
        onClose={() => setShowPublishConfirm(false)}
        onConfirm={() => {
          publishMutation.mutate(undefined, {
            onSettled: () => setShowPublishConfirm(false),
          });
        }}
        loading={publishMutation.isPending}
        title="보고서 발행"
        confirmLabel="발행"
        message={
          <div className="flex flex-col gap-2">
            <p>
              <span className="font-semibold text-slate-800">
                {workspace?.company_name ?? '이 워크스페이스'}
              </span>
              {' '}
              보고서를 고객에게 발행합니다.
            </p>
            <p className="text-text-muted text-xs">
              발행 후에는 모든 고객이 즉시 이 보고서를 열람할 수 있으며, 되돌리려면 별도
              조치가 필요합니다. 본문/전략을 모두 검토했는지 다시 한번 확인해 주세요.
            </p>
          </div>
        }
      />
    </div>
  );
}
