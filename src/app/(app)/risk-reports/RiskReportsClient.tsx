'use client';

import { useState, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { ChevronDown, ChevronLeft, ChevronRight, Check, Paperclip, Download } from 'lucide-react';
import { useWorkspaces } from '@/hooks/workspace/useWorkspaceQuery';
import { useRiskReports } from '@/hooks/report/useReportQuery';
import { useUpdateRiskReport } from '@/hooks/report/useReportMutation';
import { getErrorMessage } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { WorkspaceCombobox } from '@/components/ui/WorkspaceCombobox';
import { ReportCalendarSelector } from '@/components/report/ReportCalendarSelector';
import type { RiskReport } from '@/lib/api/reportApi';
import {
  YOUTUBE_METADATA_EXPIRED_LABEL,
  getYoutubeDisplayTitle,
  getYoutubeMetadataNotice,
} from '@/lib/youtubeMetadata';

const PAGE_SIZE = 50;

type SortKey = 'requested_desc' | 'requested_asc' | 'company' | 'status';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'requested_desc', label: '감지/신청일 최신순' },
  { value: 'requested_asc', label: '감지/신청일 오래된순' },
  { value: 'company', label: '회사명' },
  { value: 'status', label: '처리 상태' },
];

const STATUS_OPTIONS = [
  { value: 'detected', label: '미처리' },
  { value: 'requested', label: '요청 완료' },
  { value: 'pending', label: '삭제 처리 중' },
  { value: 'resolved', label: '삭제 완료' },
  { value: 'rejected', label: '삭제 불가' },
] as const;

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  detected: { label: '미처리', className: 'bg-zinc-100 text-zinc-600' },
  requested: { label: '요청 완료', className: 'bg-blue-50 text-blue-600' },
  pending: { label: '삭제 처리 중', className: 'bg-amber-50 text-amber-600' },
  resolved: { label: '삭제 완료', className: 'bg-blue-50 text-blue-600' },
  rejected: { label: '삭제 불가', className: 'bg-red-50 text-red-600' },
};

const UNKNOWN_STATUS_STYLE = { label: '알 수 없음', className: 'bg-slate-100 text-slate-600' };

const CRITICAL_TYPE_LABELS: Record<string, string> = {
  defamation: '명예훼손',
  insult: '욕설/비방',
  rumor: '루머',
  spam: '스팸',
};

function normalizeStatus(status: string | null | undefined): string {
  return (status ?? '').trim().toLowerCase();
}

function getStatusConfig(status: string | null | undefined): { label: string; className: string } {
  const normalized = normalizeStatus(status);
  return STATUS_STYLES[normalized] ?? {
    ...UNKNOWN_STATUS_STYLE,
    label: status?.trim() || UNKNOWN_STATUS_STYLE.label,
  };
}

function getCriticalTypeLabel(type: string): string {
  return CRITICAL_TYPE_LABELS[type] ?? type;
}

const PLATFORM_LABELS: Record<string, string> = {
  naver_news: '뉴스',
  naver_blog: '블로그',
  youtube: '유튜브',
  naver_stock: '종토방',
  dcinside: '디시인사이드',
};

const STATUS_FILTERS = [
  { key: 'all', label: '전체' },
  ...STATUS_OPTIONS.map((s) => ({ key: s.value, label: s.label })),
] as const;

// ── 상세 모달 ──

function DetailModal({ report, onClose }: { report: RiskReport; onClose: () => void }) {
  const initialStatus = normalizeStatus(report.status);
  const [status, setStatus] = useState(initialStatus);
  const [adminNote, setAdminNote] = useState(report.admin_note ?? '');
  const [showConfirm, setShowConfirm] = useState(false);
  const displayTitle = getYoutubeDisplayTitle(report);
  const metadataNotice = getYoutubeMetadataNotice(report);

  const update = useUpdateRiskReport(report.workspace_id);
  const saving = update.isPending;

  const statusChanged = status !== initialStatus;
  const noteChanged = adminNote !== (report.admin_note ?? '');
  const hasChanges = statusChanged || noteChanged;

  const oldStatusLabel = getStatusConfig(report.status).label;
  const newStatusLabel = getStatusConfig(status).label;
  const criticalTypeLabel = getCriticalTypeLabel(report.critical_type);

  const doSave = async () => {
    try {
      await update.mutateAsync({ id: report.id, body: { status, admin_note: adminNote } });
      toast.success('업데이트 완료');
      onClose();
    } catch (e) {
      toast.error(getErrorMessage(e, '업데이트 실패'));
    } finally {
      setShowConfirm(false);
    }
  };

  // 처리 상태 변경은 destructive (고객 노출용 신고 처리 결과) — confirm 게이트.
  // 메모만 변경된 경우엔 바로 저장.
  const handleSaveClick = () => {
    if (statusChanged) setShowConfirm(true);
    else doSave();
  };

  return (
    <>
    <Modal
      open
      onClose={onClose}
      title="리스크 항목 상세"
      size="lg"
      footer={
        <Button onClick={handleSaveClick} disabled={!hasChanges || saving}>
          {saving ? '저장 중...' : '저장'}
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-text-dark">리스크 콘텐츠</label>
        <div className="bg-bg-blue rounded-lg px-4 py-3">
          <a href={report.link} target="_blank" rel="noopener noreferrer" className="text-sm text-text-accent hover:underline">
            {displayTitle}
          </a>
          {metadataNotice && (
            <span
              className="mt-2 block w-fit text-[10px] font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5"
              title={metadataNotice}
            >
              {YOUTUBE_METADATA_EXPIRED_LABEL}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-text-muted">채널</span>
          <span className="text-sm text-text-dark">{PLATFORM_LABELS[report.platform_id] ?? report.platform_id}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-text-muted">리스크 유형</span>
          <span className="text-sm text-text-dark">{criticalTypeLabel}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-text-muted">사유</span>
        <span className="text-sm text-text-dark">{report.reason}</span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-text-muted">근거</span>
        <div className="bg-bg-light rounded-lg px-4 py-3 text-sm text-text-dark whitespace-pre-line">
          {report.evidence}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-text-muted">
          첨부 파일 {report.file_urls.length > 0 ? `(${report.file_urls.length})` : ''}
        </span>
        {report.file_urls.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {report.file_urls.map((url, i) => {
              const filename = url.split('/').pop() ?? url;
              const ext = filename.split('.').pop()?.toUpperCase() ?? '';
              const handleDownload = async () => {
                const supabase = createClient();
                try {
                  const { data, error } = await supabase.storage
                    .from('risk-attachments')
                    .download(url);
                  if (error || !data) {
                    toast.error('첨부 다운로드에 실패했습니다.');
                    console.error('[risk attachment download]', error);
                    return;
                  }
                  const blobUrl = URL.createObjectURL(data);
                  const a = document.createElement('a');
                  a.href = blobUrl;
                  a.download = filename;
                  a.click();
                  URL.revokeObjectURL(blobUrl);
                } catch (e) {
                  toast.error('첨부 다운로드에 실패했습니다.');
                  console.error('[risk attachment download]', e);
                }
              };
              return (
                <li key={i} className="flex items-center gap-3 px-3 py-2 bg-bg-light rounded-lg">
                  <Paperclip size={14} className="text-slate-400 shrink-0" />
                  <span className="text-xs text-text-dark truncate flex-1">{filename}</span>
                  <span className="text-[10px] text-text-muted bg-white px-1.5 py-0.5 rounded shrink-0">{ext}</span>
                  <button onClick={handleDownload} className="text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shrink-0">
                    <Download size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-text-muted">없음</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-text-dark">처리 상태</label>
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                status === s.value ? 'bg-bg-accent text-white' : 'bg-bg-light text-text-muted hover:bg-slate-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-text-dark">관리자 메모</label>
        <textarea
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          placeholder="처리 내용이나 메모를 입력하세요."
          rows={3}
          className="w-full text-sm border border-border-light rounded-lg px-3 py-2.5 outline-none focus:border-bg-accent transition-colors resize-none"
        />
      </div>
    </Modal>
      <ConfirmModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={doSave}
        title="처리 상태 변경"
        message={
          <>
            처리 상태를 <strong>{oldStatusLabel}</strong>에서{' '}
            <strong>{newStatusLabel}</strong>(으)로 변경하시겠습니까?
          </>
        }
        confirmLabel="변경"
        loading={saving}
      />
    </>
  );
}

// ── 메인 페이지 ──

interface RiskReportsClientProps {
  // null → 전체 (super_admin), 배열 → 해당 id 만 (admin)
  assignedIds: string[] | null;
}

export function RiskReportsClient({ assignedIds }: RiskReportsClientProps) {
  const { data: allWorkspaces = [] } = useWorkspaces();
  const workspaces = useMemo(() => {
    if (assignedIds === null) return allWorkspaces;
    const allowed = new Set(assignedIds);
    return allWorkspaces.filter((ws) => allowed.has(ws.id));
  }, [allWorkspaces, assignedIds]);

  const [selectedWsId, setSelectedWsId] = useState('');
  const [selectedReportId, setSelectedReportId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState<SortKey>('requested_desc');
  const [page, setPage] = useState(1);

  // 모달 오픈 상태는 URL 의 ?riskReportId= 에서 derive — 관리자 홈에서 deep-link 로 들어오면 자동 오픈
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const targetId = searchParams?.get('riskReportId') ?? '';
  const setSelectedId = (id: string | null) => {
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    if (id) next.set('riskReportId', id);
    else next.delete('riskReportId');
    const qs = next.toString();
    const path = pathname ?? '/risk-reports';
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  };

  const { data: rawRiskReports, isLoading } = useRiskReports(
    selectedWsId || '_all',
    selectedReportId || undefined,
  );

  // admin 은 배정받은 ws 의 risk 만 보이도록 클라이언트에서 한 번 더 필터
  const riskReports = useMemo(() => {
    if (assignedIds === null) return rawRiskReports;
    const allowed = new Set(assignedIds);
    return (rawRiskReports ?? []).filter((r) => allowed.has(r.workspace_id));
  }, [rawRiskReports, assignedIds]);

  // workspace 변경 시 report 선택 초기화 + 1페이지로
  const handleWsChange = (wsId: string) => {
    setSelectedWsId(wsId);
    setSelectedReportId('');
    setPage(1);
  };
  const handleReportIdChange = (id: string) => {
    setSelectedReportId(id);
    setPage(1);
  };
  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };
  const handleSortChange = (val: SortKey) => {
    setSort(val);
    setPage(1);
  };

  // workspace명 매핑
  const wsMap = useMemo(() => new Map(workspaces.map((ws) => [ws.id, ws.company_name])), [workspaces]);

  const filtered = useMemo(() => {
    let list = riskReports ?? [];
    if (statusFilter !== 'all') {
      list = list.filter((r) => normalizeStatus(r.status) === statusFilter);
    }
    return list;
  }, [riskReports, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      switch (sort) {
        case 'requested_desc':
          return (b.requested_at ?? '').localeCompare(a.requested_at ?? '');
        case 'requested_asc':
          return (a.requested_at ?? '').localeCompare(b.requested_at ?? '');
        case 'company':
          return (wsMap.get(a.workspace_id) ?? '').localeCompare(wsMap.get(b.workspace_id) ?? '');
        case 'status':
          return getStatusConfig(a.status).label.localeCompare(getStatusConfig(b.status).label);
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sort, wsMap]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage],
  );

  // URL 의 riskReportId 와 매칭되는 보고서 — 데이터 로드 후 자동 매칭, 없거나 권한 밖이면 null
  const selected = useMemo(() => {
    if (!targetId) return null;
    return riskReports?.find((r) => r.id === targetId) ?? null;
  }, [targetId, riskReports]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full bg-slate-50">
      <div className="max-w-5xl mx-auto flex flex-col gap-4 sm:gap-6 h-full">
        <h1 className="text-xl font-bold text-slate-800 pb-2 border-b border-slate-100">
          리스크 관리
        </h1>

        {/* 필터 영역 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 sm:flex-wrap">
          <WorkspaceCombobox
            workspaces={workspaces}
            selectedId={selectedWsId}
            onChange={handleWsChange}
          />

          <ReportCalendarSelector
            workspaceId={selectedWsId}
            selectedReportId={selectedReportId}
            onChange={handleReportIdChange}
          />

          <div className="sm:ml-auto">
            <Listbox value={sort} onChange={handleSortChange}>
              <div className="relative">
                <ListboxButton className="flex items-center gap-2 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white hover:bg-slate-50 transition-colors cursor-pointer min-w-[140px]">
                  <span className="text-slate-700 flex-1 text-left">
                    {SORT_OPTIONS.find((o) => o.value === sort)?.label}
                  </span>
                  <ChevronDown size={14} className="text-slate-400 shrink-0" />
                </ListboxButton>
                <ListboxOptions className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg bg-white border border-slate-200 shadow-lg py-1">
                  {SORT_OPTIONS.map((opt) => (
                    <ListboxOption
                      key={opt.value}
                      value={opt.value}
                      className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer data-[focus]:bg-blue-50 transition-colors"
                    >
                      {({ selected: isSelected }) => (
                        <>
                          <Check size={14} className={isSelected ? 'text-blue-600' : 'text-transparent'} />
                          <span className={isSelected ? 'font-semibold text-blue-600' : 'text-slate-700'}>
                            {opt.label}
                          </span>
                        </>
                      )}
                    </ListboxOption>
                  ))}
                </ListboxOptions>
              </div>
            </Listbox>
          </div>
        </div>

        {/* 테이블 (탭 + 바디 통합) */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* 상태 필터 (탭 스타일) - 모바일 가로 스크롤.
              flex-1 overflow-y-auto 위 sibling 이라 항상 상단 고정. */}
          <div className="bg-white flex gap-3 sm:gap-4 px-4 pt-3 border-b border-border-light shrink-0 overflow-x-auto">
            {STATUS_FILTERS.map((f) => {
              const count = f.key === 'all'
                ? (riskReports ?? []).length
                : (riskReports ?? []).filter((r) => normalizeStatus(r.status) === f.key).length;
              const active = statusFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => handleStatusFilterChange(f.key)}
                  className="flex flex-col items-center gap-1 cursor-pointer shrink-0"
                >
                  <span className={`text-xs px-2 whitespace-nowrap transition-colors ${active ? 'text-text-dark font-semibold' : 'text-text-muted font-normal'}`}>
                    {f.label} ({count})
                  </span>
                  <div className={`h-0.5 w-full rounded-full transition-colors ${active ? 'bg-text-accent' : 'bg-transparent'}`} />
                </button>
              );
            })}
          </div>
          {/* 스크롤 영역: 헤더와 바디가 같은 스크롤바 폭을 공유해야 컬럼 정렬이 어긋나지 않는다. */}
          <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
            {/* 헤더 (데스크톱만) — 같은 스크롤 컨테이너 안에서 sticky 고정 */}
            <div className="hidden lg:grid sticky top-0 z-10 bg-white grid-cols-[8%_10%_8%_8%_1fr_12%] border-b border-slate-100 py-3 px-4 text-xs font-semibold text-slate-500 text-center">
              <div>감지/요청일</div>
              <div>회사명</div>
              <div>채널명</div>
              <div>사유</div>
              <div className="text-left pl-2">세부 내용</div>
              <div>상태</div>
            </div>

            {isLoading ? (
              <div className="min-h-48 flex items-center justify-center">
                <p className="text-xs text-text-muted">불러오는 중...</p>
              </div>
            ) : sorted.length === 0 ? (
              <div className="min-h-48 flex items-center justify-center px-6 text-center">
                {(riskReports?.length ?? 0) === 0 ? (
                  <p className="text-xs text-text-muted">
                    {selectedReportId
                      ? '선택한 보고서에 등록된 리스크 항목이 없습니다.'
                      : selectedWsId
                        ? '이 워크스페이스에 등록된 리스크 항목이 없습니다.'
                        : '리스크 항목이 없습니다.'}
                  </p>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs text-text-muted">
                      <span className="font-semibold text-slate-700">
                        {STATUS_FILTERS.find((s) => s.key === statusFilter)?.label}
                      </span>
                      {' '}상태의 리스크 항목이 없습니다.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleStatusFilterChange('all')}
                      className="text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                    >
                      전체 보기
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
              {paged.map((rr) => {
                const statusCfg = getStatusConfig(rr.status);
                const requestedLabel = rr.requested_at?.slice(5, 10).replace(/-/g, '.') ?? '';
                const companyLabel = wsMap.get(rr.workspace_id) ?? '';
                const platformLabel = PLATFORM_LABELS[rr.platform_id] ?? rr.platform_id;
                const displayTitle = getYoutubeDisplayTitle(rr);
                const metadataNotice = getYoutubeMetadataNotice(rr);
                return (
                  <div
                    key={rr.id}
                    onClick={() => setSelectedId(rr.id)}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  >
                    {/* 데스크톱 행 */}
                    <div className="hidden lg:grid grid-cols-[8%_10%_8%_8%_1fr_12%] items-center py-3 px-4">
                      <div className="text-center text-xs text-slate-500">
                        {requestedLabel}
                      </div>
                      <div className="text-center text-xs text-slate-500 truncate">
                        {companyLabel}
                      </div>
                      <div className="text-center text-xs text-slate-500">
                        {platformLabel}
                      </div>
                      <div className="text-center text-xs text-slate-500">
                        {rr.reason}
                      </div>
                      <div className="pl-2 flex items-center gap-2 min-w-0">
                        <span className="text-sm text-slate-800 font-semibold truncate">
                          {displayTitle}
                        </span>
                        {metadataNotice && (
                          <span
                            className="text-[10px] font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 shrink-0"
                            title={metadataNotice}
                          >
                            {YOUTUBE_METADATA_EXPIRED_LABEL}
                          </span>
                        )}
                        {rr.file_urls.length > 0 && (
                          <span className="flex items-center gap-0.5 text-slate-400 shrink-0">
                            <Paperclip size={12} />
                            <span className="text-[10px]">{rr.file_urls.length}</span>
                          </span>
                        )}
                      </div>
                      <div className="text-center">
                        <span className={`inline-block text-xs font-semibold px-3 py-1.5 rounded-lg ${statusCfg.className}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                    </div>

                    {/* 모바일 카드 */}
                    <div className="lg:hidden flex flex-col gap-1.5 px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700 truncate">
                          {companyLabel}
                        </span>
                        <span className={`shrink-0 inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md ${statusCfg.className}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <p className="text-sm text-slate-800 font-semibold leading-snug line-clamp-2">
                            {displayTitle}
                          </p>
                          {metadataNotice && (
                            <span
                              className="w-fit text-[10px] font-medium text-amber-600 bg-amber-50 rounded-full px-2 py-0.5"
                              title={metadataNotice}
                            >
                              {YOUTUBE_METADATA_EXPIRED_LABEL}
                            </span>
                          )}
                        </div>
                        {rr.file_urls.length > 0 && (
                          <span className="flex items-center gap-0.5 text-slate-400 shrink-0 mt-0.5">
                            <Paperclip size={12} />
                            <span className="text-[10px]">{rr.file_urls.length}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 tabular-nums">
                        <span>{requestedLabel}</span>
                        <span className="text-slate-300">·</span>
                        <span>{platformLabel}</span>
                        <span className="text-slate-300">·</span>
                        <span className="truncate">{rr.reason}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              </>
            )}
          </div>

          {/* 페이지네이션 + 총 건수 */}
          <div className="flex items-center justify-between gap-3 px-4 py-2 shrink-0 border-t border-slate-50">
            <p className="text-xs text-text-muted tabular-nums">총 {sorted.length}건</p>
            {sorted.length > PAGE_SIZE && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  aria-label="이전 페이지"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-text-muted tabular-nums px-2">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  aria-label="다음 페이지"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <DetailModal
          report={selected}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
