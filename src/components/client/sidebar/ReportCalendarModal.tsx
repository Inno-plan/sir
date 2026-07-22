'use client';

import { useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { ko } from 'react-day-picker/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import 'react-day-picker/style.css';

interface Report {
  id: string;
  type: string;
  status: string | null;
  period_start: string | null;
  period_end: string | null;
}

interface ReportCalendarModalProps {
  reports: Report[];
  currentReportId?: string;
  onSelect: (reportId: string) => void;
  onClose: () => void;
}

type Mode = 'daily' | 'weekly' | 'monthly';

// UI 모드 → reports.type 매핑. 월간은 백엔드 상 'initial' (온보딩 첫 30일).
const TYPE_BY_MODE: Record<Mode, string> = {
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'initial',
};

const MODE_LABELS: Record<Mode, string> = {
  daily: '일간',
  weekly: '주간',
  monthly: '초기 종합',
};

function parseDate(str: string | null): Date | null {
  if (!str) return null;
  return new Date(str + 'T00:00:00');
}

function getDatesInRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const d = new Date(start);
  while (d <= end) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export function ReportCalendarModal({
  reports,
  currentReportId,
  onSelect,
  onClose,
}: ReportCalendarModalProps) {
  // 현재 보고 있는 보고서 type 에 따라 초기 모드 결정.
  // 전체 보기(currentReportId 없음) 진입 시 — 가장 넓은 기간을 다루는 초기 종합으로.
  const [mode, setMode] = useState<Mode>(() => {
    const current = reports.find((r) => r.id === currentReportId);
    if (current?.type === 'daily') return 'daily';
    if (current?.type === 'initial') return 'monthly';
    if (!currentReportId) return 'monthly';
    return 'weekly';
  });

  // 모드에 해당하는 보고서만 필터
  const visibleReports = useMemo(
    () => reports.filter((r) => r.type === TYPE_BY_MODE[mode]),
    [reports, mode],
  );

  const [selectedReportId, setSelectedReportId] = useState<string | undefined>(currentReportId);
  // 달력 시점 — 현재 보고서 있으면 그 period_end, 없으면 최신 보고서의 period_end 로 폴백.
  // 폴백 없으면 month 가 undefined 라 nnnn년 n월 라벨이 비어 보이는 버그 발생.
  const [month, setMonth] = useState<Date | undefined>(() => {
    const current = reports.find((r) => r.id === currentReportId);
    if (current?.period_end) return parseDate(current.period_end) ?? undefined;
    const latestEnd = reports
      .map((r) => r.period_end)
      .filter((d): d is string => !!d)
      .sort()
      .pop();
    if (latestEnd) return parseDate(latestEnd) ?? undefined;
    return new Date();
  });

  // 날짜 → 보고서 매핑 (현재 모드 내에서만)
  const reportDateMap = useMemo(() => {
    const map = new Map<string, Report>();
    for (const report of visibleReports) {
      const start = parseDate(report.period_start);
      const end = parseDate(report.period_end);
      if (!start || !end) continue;
      for (const date of getDatesInRange(start, end)) {
        map.set(date.toISOString().slice(0, 10), report);
      }
    }
    return map;
  }, [visibleReports]);

  // 모드별 전체 보고서 날짜 (범위·점 표시용)
  const allReportDates = useMemo(() => {
    const dates: Date[] = [];
    const starts: Date[] = [];
    const ends: Date[] = [];
    for (const r of visibleReports) {
      const s = parseDate(r.period_start);
      const e = parseDate(r.period_end);
      if (!s || !e) continue;
      dates.push(...getDatesInRange(s, e));
      starts.push(s);
      ends.push(e);
    }
    return { dates, starts, ends };
  }, [visibleReports]);

  // 현재 보고서 하이라이트 — 현재 모드와 같은 타입일 때만
  const currentHighlight = useMemo(() => {
    if (!currentReportId) return { dates: [], starts: [], ends: [] };
    const target = reports.find((r) => r.id === currentReportId);
    if (!target || target.type !== TYPE_BY_MODE[mode]) {
      return { dates: [], starts: [], ends: [] };
    }
    const s = parseDate(target.period_start);
    const e = parseDate(target.period_end);
    if (!s || !e) return { dates: [], starts: [], ends: [] };
    return { dates: getDatesInRange(s, e), starts: [s], ends: [e] };
  }, [reports, currentReportId, mode]);

  // 선택된 보고서 기간 (현재 보고서와 다른 것, 같은 모드만)
  const selectedHighlight = useMemo(() => {
    if (!selectedReportId || selectedReportId === currentReportId)
      return { dates: [], start: null as Date | null, end: null as Date | null };
    const target = reports.find((r) => r.id === selectedReportId);
    if (!target || target.type !== TYPE_BY_MODE[mode]) {
      return { dates: [], start: null, end: null };
    }
    const s = parseDate(target.period_start);
    const e = parseDate(target.period_end);
    if (!s || !e) return { dates: [], start: null, end: null };
    return { dates: getDatesInRange(s, e), start: s, end: e };
  }, [reports, selectedReportId, currentReportId, mode]);

  // 최신 보고서의 period_end 이후는 비활성화 (모드 무관 전체 기준)
  const latestEnd = useMemo(() => {
    const dates = reports.map((r) => parseDate(r.period_end)).filter((d): d is Date => d !== null);
    if (dates.length === 0) return undefined;
    return dates.reduce((max, d) => (d > max ? d : max));
  }, [reports]);

  const handleDayClick = (day: Date) => {
    const key = day.toISOString().slice(0, 10);
    const report = reportDateMap.get(key);
    if (report) setSelectedReportId(report.id);
  };

  const handleApply = () => {
    if (!selectedReportId || selectedReportId === currentReportId) return;
    onSelect(selectedReportId);
  };

  const isChanged = selectedReportId && selectedReportId !== currentReportId;

  const goToPrevMonth = () => {
    setMonth((prev) => {
      const d = prev ? new Date(prev) : new Date();
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };
  const goToNextMonth = () => {
    setMonth((prev) => {
      const d = prev ? new Date(prev) : new Date();
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  const monthLabel = month ? `${month.getFullYear()}년 ${month.getMonth() + 1}월` : '';

  return (
    <Modal
      open
      onClose={onClose}
      title="지난 보고서 보기"
      size="md"
      footer={
        <Button onClick={handleApply} disabled={!isChanged} fullWidth>
          적용하기
        </Button>
      }
    >
      <div className="flex flex-col gap-4 items-center">
        {/* 모드 토글 */}
        <div className="flex gap-1 bg-slate-100 rounded-full p-1">
          {(['weekly', 'daily', 'monthly'] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setSelectedReportId(currentReportId);
                }}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer ${
                  active ? 'bg-white text-text-dark shadow-sm' : 'text-text-muted hover:text-text-dark'
                }`}
              >
                {MODE_LABELS[m]}
              </button>
            );
          })}
        </div>

        <style>{`
          .report-calendar .rdp-nav { display: none; }
          .report-calendar .rdp-month_caption { display: none; }
          .report-calendar .rdp-months { display: flex; justify-content: center; }
          .report-calendar .rdp-weekday {
            font-weight: 300;
            color: var(--color-text-muted, #828EA6);
          }
          .report-calendar .rdp-day {
            font-weight: 400;
            font-size: 12px;
            color: var(--color-text-dark, #1E293B);
            height: 30px;
          }
          .report-calendar .rdp-outside {
            color: var(--color-text-dark, #1E293B) !important;
            opacity: 1 !important;
          }
          .report-calendar .rdp-disabled {
            color: var(--color-text-muted, #828EA6) !important;
          }
          .report-calendar .rdp-today {
            position: relative;
          }
          .report-calendar .rdp-today::after {
            content: '';
            position: absolute;
            left: 50%;
            bottom: 4px;
            transform: translateX(-50%);
            width: 4px;
            height: 4px;
            border-radius: 9999px;
            background-color: var(--color-bg-accent, #362CFF);
          }
          /* 전체 모드 보고서 표시 — 모드별로 다름 */
          .report-calendar .day-has-report,
          .report-calendar .day-current,
          .report-calendar .day-selected {
            position: relative;
            isolation: isolate;
          }
          .report-calendar .day-has-report::before {
            content: '';
            position: absolute;
            inset: 20% 0;
            z-index: -1;
            border-radius: 0;
          }
          .report-calendar.mode-weekly .day-has-report::before {
            background-color: rgba(54, 44, 255, 0.08);
          }
          .report-calendar.mode-daily .day-has-report::before {
            background-color: rgba(151, 71, 255, 0.1);
            border-radius: 9999px;
            inset: 15% 15%;
          }
          /* 현재 / 선택 보고서 강조 (위 표시보다 위에 쌓임) */
          .report-calendar .day-current::before,
          .report-calendar .day-selected::before {
            content: '';
            position: absolute;
            inset: 15% 0;
            z-index: -1;
            border-radius: 0;
          }
          .report-calendar .day-current::before {
            background-color: var(--color-bg-blue, #E8F1FF);
          }
          .report-calendar .day-selected::before {
            background-color: var(--color-bg-pupple-calendar, #9747ff26);
          }
          .report-calendar.mode-daily .day-current::before,
          .report-calendar.mode-daily .day-selected::before {
            border-radius: 9999px;
            inset: 10% 10%;
          }
          /* 일간·주간 모드: 현재(파랑) / 선택(보라)을 같은 색 체계로 구분 */
          .report-calendar.mode-daily .day-current::before,
          .report-calendar.mode-weekly .day-current::before {
            background-color: #362cff;
          }
          .report-calendar.mode-daily .rdp-day.day-current,
          .report-calendar.mode-weekly .rdp-day.day-current {
            color: #ffffff;
            font-weight: 600;
          }
          .report-calendar.mode-daily .day-selected::before,
          .report-calendar.mode-weekly .day-selected::before {
            background-color: #9747ff;
          }
          .report-calendar.mode-daily .rdp-day.day-selected,
          .report-calendar.mode-weekly .rdp-day.day-selected {
            color: #ffffff;
            font-weight: 600;
          }
          .report-calendar .day-range-start::before {
            border-radius: 9999px 0 0 9999px;
          }
          .report-calendar .day-range-end::before {
            border-radius: 0 9999px 9999px 0;
          }
          .report-calendar .day-range-start.day-range-end::before {
            border-radius: 9999px;
          }
        `}</style>
        {mode === 'monthly' ? (
          <MonthlyList
            reports={visibleReports}
            currentReportId={currentReportId}
            selectedReportId={selectedReportId}
            onSelect={setSelectedReportId}
          />
        ) : (
          <>
            <div className="inline-flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={goToPrevMonth}
                  className="text-text-muted hover:text-text-dark transition-colors cursor-pointer p-1"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm font-semibold text-text-dark">{monthLabel}</span>
                <button
                  onClick={goToNextMonth}
                  className="text-text-muted hover:text-text-dark transition-colors cursor-pointer p-1"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <DayPicker
                className={`report-calendar mode-${mode}`}
                locale={ko}
                weekStartsOn={1}
                month={month}
                onMonthChange={setMonth}
                disabled={latestEnd ? { after: latestEnd } : undefined}
                modifiers={{
                  hasReport: allReportDates.dates,
                  current: currentHighlight.dates,
                  currentStart: currentHighlight.starts,
                  currentEnd: currentHighlight.ends,
                  selected: selectedHighlight.dates,
                  selectedStart: selectedHighlight.start ? [selectedHighlight.start] : [],
                  selectedEnd: selectedHighlight.end ? [selectedHighlight.end] : [],
                }}
                modifiersClassNames={{
                  hasReport: 'day-has-report',
                  current: 'day-current',
                  currentStart: 'day-range-start',
                  currentEnd: 'day-range-end',
                  selected: 'day-selected',
                  selectedStart: 'day-range-start',
                  selectedEnd: 'day-range-end',
                }}
                onDayClick={handleDayClick}
                showOutsideDays
              />
            </div>

            {/* 범례 */}
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-2.5 h-2.5 ${mode === 'daily' ? 'rounded-full' : ''}`}
                  style={{
                    backgroundColor:
                      mode === 'daily' ? 'rgba(151, 71, 255, 0.1)' : 'rgba(54, 44, 255, 0.08)',
                  }}
                />
                <span className="text-xs text-text-muted">{mode === 'daily' ? '일간 보고서' : '주간 보고서'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#362cff]" />
                <span className="text-xs text-text-muted">현재 보고서</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#9747ff]" />
                <span className="text-xs text-text-muted">선택된 보고서</span>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function MonthlyList({
  reports,
  currentReportId,
  selectedReportId,
  onSelect,
}: {
  reports: Report[];
  currentReportId?: string;
  selectedReportId?: string;
  onSelect: (reportId: string) => void;
}) {
  if (reports.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-text-muted">
        생성된 초기 종합 보고서가 없습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full min-w-[280px] max-w-[360px]">
      {reports
        .slice()
        .sort((a, b) => (b.period_end ?? '').localeCompare(a.period_end ?? ''))
        .map((r) => {
          const isCurrent = r.id === currentReportId;
          const isSelected = r.id === selectedReportId && !isCurrent;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r.id)}
              className={`text-left rounded-lg border px-3.5 py-3 transition-colors cursor-pointer ${
                isSelected
                  ? 'border-bg-pupple bg-bg-pupple-calendar'
                  : isCurrent
                    ? 'border-text-accent bg-bg-blue'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-text-dark">초기 종합 보고서</span>
                {isCurrent && (
                  <span className="text-[10px] font-semibold text-text-accent bg-white rounded-full px-2 py-0.5">
                    현재
                  </span>
                )}
              </div>
              <div className="text-xs text-text-muted tabular-nums">
                {r.period_start} ~ {r.period_end}
              </div>
            </button>
          );
        })}
    </div>
  );
}
