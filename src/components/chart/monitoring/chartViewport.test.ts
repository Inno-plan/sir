import { describe, expect, it } from 'vitest';
import { getChartViewport, pickVisibleDateTicks } from './chartViewport';

describe('getChartViewport', () => {
  it('starts at the latest visible window', () => {
    expect(getChartViewport(90, 0, 45)).toEqual({
      enabled: true,
      startIndex: 45,
      endIndex: 90,
      offset: 0,
      maxOffset: 45,
    });
  });

  it('moves toward older data and clamps both ends', () => {
    expect(getChartViewport(90, 20, 45).startIndex).toBe(25);
    expect(getChartViewport(90, 999, 45).startIndex).toBe(0);
    expect(getChartViewport(90, -10, 45).startIndex).toBe(45);
  });

  it('keeps the full range when panning is disabled', () => {
    expect(getChartViewport(90, 20, 45, false)).toEqual({
      enabled: false,
      startIndex: 0,
      endIndex: 90,
      offset: 0,
      maxOffset: 0,
    });
  });
});

describe('pickVisibleDateTicks', () => {
  it('picks evenly spaced ticks including both visible edges', () => {
    const data = Array.from({ length: 9 }, (_, index) => ({ date: `2026-07-${index + 1}` }));
    expect(pickVisibleDateTicks(data, 5)).toEqual([
      '2026-07-1',
      '2026-07-3',
      '2026-07-5',
      '2026-07-7',
      '2026-07-9',
    ]);
  });

  it('uses every date when there are fewer points than ticks', () => {
    const data = [{ date: '2026-07-01' }, { date: '2026-07-02' }];
    expect(pickVisibleDateTicks(data, 5)).toEqual(['2026-07-01', '2026-07-02']);
  });
});
