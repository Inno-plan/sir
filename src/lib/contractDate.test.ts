import { describe, expect, it } from 'vitest';
import {
  getContractEndDate,
  getContractStartDate,
  getKstTodayDate,
  getTrialEndDate,
  toContractEndIso,
  toContractStartIso,
} from '@/lib/contractDate';

function dateParts(date: Date): [number, number, number] {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
}

describe('contract date boundaries', () => {
  it('stores an inclusive UI period as KST midnight half-open boundaries', () => {
    const start = new Date(2026, 6, 1);
    const end = new Date(2026, 6, 15);

    expect(toContractStartIso(start)).toBe('2026-06-30T15:00:00.000Z');
    expect(toContractEndIso(end)).toBe('2026-07-15T15:00:00.000Z');
  });

  it('restores the inclusive dates from DB boundaries', () => {
    expect(dateParts(getContractStartDate('2026-06-30T15:00:00.000Z'))).toEqual([2026, 7, 1]);
    expect(dateParts(getContractEndDate('2026-07-15T15:00:00.000Z'))).toEqual([2026, 7, 15]);
  });

  it('uses the KST calendar date around the UTC day boundary', () => {
    expect(dateParts(getKstTodayDate(new Date('2026-07-20T15:00:00.000Z')))).toEqual([
      2026, 7, 21,
    ]);
  });

  it('calculates a ten-day trial as an inclusive UI range', () => {
    expect(dateParts(getTrialEndDate(new Date(2026, 6, 22)))).toEqual([2026, 7, 31]);
  });
});
