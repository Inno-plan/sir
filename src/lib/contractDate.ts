import { addMonths, subDays } from 'date-fns';

const KST_TIME_ZONE = 'Asia/Seoul';

const kstDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: KST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getKstDateKey(date: Date): string {
  const parts = kstDateFormatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  return toDateKey(year, month, day);
}

function getPickerDateKey(date: Date): string {
  return toDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function dateKeyToPickerDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return toDateKey(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

function toKstMidnightIso(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00+09:00`).toISOString();
}

/** 현재 시각을 KST 달력의 오늘 날짜로 변환한다. */
export function getKstTodayDate(now = new Date()): Date {
  return dateKeyToPickerDate(getKstDateKey(now));
}

/** DB started_at을 UI의 포함 시작일로 변환한다. */
export function getContractStartDate(startedAt: string): Date {
  return dateKeyToPickerDate(getKstDateKey(new Date(startedAt)));
}

/** DB exclusive ended_at을 UI의 포함 종료일로 변환한다. */
export function getContractEndDate(endedAt: string): Date {
  const lastIncludedInstant = new Date(new Date(endedAt).getTime() - 1);
  return dateKeyToPickerDate(getKstDateKey(lastIncludedInstant));
}

/** UI 시작일을 해당 날짜의 KST 00:00 경계로 저장한다. */
export function toContractStartIso(startDate: Date): string {
  return toKstMidnightIso(getPickerDateKey(startDate));
}

/** UI 포함 종료일을 다음 날 KST 00:00 exclusive 경계로 저장한다. */
export function toContractEndIso(endDate: Date): string {
  return toKstMidnightIso(shiftDateKey(getPickerDateKey(endDate), 1));
}

/** n개월 계약의 포함 종료일. DB의 exclusive 경계보다 하루 앞선 날짜다. */
export function getContractPresetEndDate(startDate: Date, months: number): Date {
  return subDays(addMonths(startDate, months), 1);
}
