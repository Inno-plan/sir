'use client';

import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { ko } from 'react-day-picker/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, addMonths, format, isSameDay } from 'date-fns';
import { Modal } from '@/components/ui/Modal';
import { AdminButton } from '@/components/ui/AdminButton';
import { getContractPresetEndDate, getKstTodayDate } from '@/lib/contractDate';

interface ContractPeriodPickerProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onChange: (range: { start: Date | undefined; end: Date | undefined }) => void;
  placeholder?: string;
  disabled?: boolean;
  /** 시작일을 포함한 고정 사용 일수. 설정하면 종료일을 직접 선택할 수 없다. */
  fixedDurationDays?: number;
}

const PRESETS: { months: number; label: string }[] = [
  { months: 1, label: '1개월' },
  { months: 3, label: '3개월' },
  { months: 6, label: '6개월' },
  { months: 12, label: '1년' },
];

function MonthHeader({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between w-full max-w-[280px]">
      <button
        type="button"
        onClick={onPrev}
        className="text-text-muted hover:text-text-dark transition-colors cursor-pointer p-1"
        aria-label="이전 달"
      >
        <ChevronLeft size={18} />
      </button>
      <span className="text-sm font-semibold text-text-dark">{label}</span>
      <button
        type="button"
        onClick={onNext}
        className="text-text-muted hover:text-text-dark transition-colors cursor-pointer p-1"
        aria-label="다음 달"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

export function ContractPeriodPicker({
  startDate,
  endDate,
  onChange,
  placeholder = '계약 기간 선택',
  disabled = false,
  fixedDurationDays,
}: ContractPeriodPickerProps) {
  const [open, setOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState<Date | undefined>(startDate);
  const [pendingEnd, setPendingEnd] = useState<Date | undefined>(endDate);
  const [monthStart, setMonthStart] = useState<Date>(startDate ?? getKstTodayDate());
  const [monthEnd, setMonthEnd] = useState<Date>(endDate ?? addMonths(getKstTodayDate(), 1));

  const handleOpen = () => {
    if (disabled) return;
    setPendingStart(startDate);
    setPendingEnd(
      fixedDurationDays && startDate ? addDays(startDate, fixedDurationDays - 1) : endDate,
    );
    const fallbackStart = startDate ?? getKstTodayDate();
    setMonthStart(fallbackStart);
    setMonthEnd(endDate ?? addMonths(fallbackStart, 1));
    setOpen(true);
  };

  const handleConfirm = () => {
    onChange({ start: pendingStart, end: pendingEnd });
    setOpen(false);
  };

  const handleCancel = () => setOpen(false);

  const applyPreset = (months: number) => {
    const base = pendingStart ?? getKstTodayDate();
    const end = getContractPresetEndDate(base, months);
    setPendingStart(base);
    setPendingEnd(end);
    setMonthStart(base);
    setMonthEnd(end);
  };

  const handleStartSelect = (d: Date | undefined) => {
    setPendingStart(d);
    if (fixedDurationDays) {
      const nextEnd = d ? addDays(d, fixedDurationDays - 1) : undefined;
      setPendingEnd(nextEnd);
      if (nextEnd) setMonthEnd(nextEnd);
      return;
    }
    // 시작일이 종료일 이후면 포함 종료일을 1개월 계약 기준으로 자동 보정
    if (d && pendingEnd && d > pendingEnd) {
      const next = getContractPresetEndDate(d, 1);
      setPendingEnd(next);
      setMonthEnd(next);
    }
  };

  const handleEndSelect = (d: Date | undefined) => {
    // 시작일과 같은 날 종료하는 1일 계약도 허용한다.
    if (d && pendingStart && d < pendingStart) return;
    setPendingEnd(d);
  };

  const bumpMonth = (setter: (fn: (prev: Date) => Date) => void, delta: number) => {
    setter((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + delta);
      return d;
    });
  };

  const activePresetMonths: number | null = (() => {
    if (!pendingStart || !pendingEnd) return null;
    for (const p of PRESETS) {
      if (isSameDay(getContractPresetEndDate(pendingStart, p.months), pendingEnd)) return p.months;
    }
    return null;
  })();

  const displayText =
    startDate && endDate
      ? `${format(startDate, 'yyyy-MM-dd')} ~ ${format(endDate, 'yyyy-MM-dd')}`
      : null;

  const canConfirm =
    pendingStart !== undefined && pendingEnd !== undefined && pendingEnd >= pendingStart;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none text-left bg-white hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        {displayText ? (
          <span className="text-slate-800">{displayText}</span>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
      </button>

      <Modal
        open={open}
        onClose={handleCancel}
        title="계약 기간"
        size="lg"
        footer={
          <div className="flex gap-2 w-full">
            <AdminButton variant="secondary" onClick={handleCancel} fullWidth>
              취소
            </AdminButton>
            <AdminButton
              variant="primary"
              onClick={handleConfirm}
              disabled={!canConfirm}
              fullWidth
            >
              확인
            </AdminButton>
          </div>
        }
      >
        <style>{`
          .sir-datepicker .rdp-nav { display: none; }
          .sir-datepicker .rdp-month_caption { display: none; }
          .sir-datepicker .rdp-months { display: flex; justify-content: center; }
          .sir-datepicker .rdp-weekday {
            font-weight: 300;
            font-size: 11px;
            color: var(--color-text-muted, #828EA6);
          }
          .sir-datepicker .rdp-day {
            font-weight: 400;
            font-size: 13px;
            color: var(--color-text-dark, #1E293B);
            height: 34px;
            width: 34px;
          }
          .sir-datepicker .rdp-day_button {
            border-radius: 9999px;
            height: 30px;
            width: 30px;
          }
          .sir-datepicker .rdp-outside {
            color: var(--color-text-muted, #828EA6) !important;
            opacity: 0.6 !important;
          }
          .sir-datepicker .rdp-selected .rdp-day_button {
            background-color: var(--color-bg-accent, #362CFF);
            color: white;
            font-weight: 600;
          }
          .sir-datepicker .rdp-disabled {
            opacity: 0.3;
          }
        `}</style>

        <div className="flex flex-col gap-5">
          {fixedDurationDays ? (
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              시작일을 선택하면 종료일이 {fixedDurationDays}일 이용 기준으로 자동 설정됩니다.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-slate-500">빠른 선택 (시작일 기준)</span>
              <div className="flex gap-1.5 flex-wrap">
                {PRESETS.map((p) => {
                  const active = activePresetMonths === p.months;
                  return (
                    <button
                      key={p.months}
                      type="button"
                      onClick={() => applyPreset(p.months)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors cursor-pointer ${
                        active
                          ? 'bg-bg-accent text-white border-bg-accent'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t border-slate-100" />

          {/* 일반 계약은 시작·종료, 고정 기간은 시작일만 선택 */}
          <div className="flex flex-col lg:flex-row gap-5 lg:gap-8 justify-center">
            <div className="flex flex-col items-center gap-2 flex-1">
              <span className="text-xs font-semibold text-slate-500">시작일</span>
              <MonthHeader
                label={`${monthStart.getFullYear()}년 ${monthStart.getMonth() + 1}월`}
                onPrev={() => bumpMonth(setMonthStart, -1)}
                onNext={() => bumpMonth(setMonthStart, 1)}
              />
              <DayPicker
                className="sir-datepicker"
                mode="single"
                selected={pendingStart}
                onSelect={handleStartSelect}
                locale={ko}
                weekStartsOn={1}
                month={monthStart}
                onMonthChange={setMonthStart}
                showOutsideDays
              />
            </div>

            {!fixedDurationDays && (
              <div className="flex flex-col items-center gap-2 flex-1">
                <span className="text-xs font-semibold text-slate-500">종료일</span>
                <MonthHeader
                  label={`${monthEnd.getFullYear()}년 ${monthEnd.getMonth() + 1}월`}
                  onPrev={() => bumpMonth(setMonthEnd, -1)}
                  onNext={() => bumpMonth(setMonthEnd, 1)}
                />
                <DayPicker
                  className="sir-datepicker"
                  mode="single"
                  selected={pendingEnd}
                  onSelect={handleEndSelect}
                  locale={ko}
                  weekStartsOn={1}
                  month={monthEnd}
                  onMonthChange={setMonthEnd}
                  showOutsideDays
                  disabled={pendingStart ? { before: pendingStart } : undefined}
                />
              </div>
            )}
          </div>

          {pendingStart && pendingEnd && (
            <div className="text-xs text-slate-600 text-center">
              <span className="font-semibold text-slate-800">{format(pendingStart, 'yyyy-MM-dd')}</span>
              {' ~ '}
              <span className="font-semibold text-slate-800">{format(pendingEnd, 'yyyy-MM-dd')}</span>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
