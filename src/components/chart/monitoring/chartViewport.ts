export const LONG_RANGE_MIN_DAYS = 90;
export const LONG_RANGE_VISIBLE_POINTS = 45;
export const VISIBLE_DATE_TICK_COUNT = 5;

export interface ChartViewport {
  enabled: boolean;
  startIndex: number;
  endIndex: number;
  offset: number;
  maxOffset: number;
}

/** offset=0은 가장 최근 구간, offset이 커질수록 과거 구간을 표시한다. */
export function getChartViewport(
  dataLength: number,
  requestedOffset: number,
  visiblePointCount = LONG_RANGE_VISIBLE_POINTS,
  enabled = true
): ChartViewport {
  const safeLength = Math.max(0, Math.floor(dataLength));
  const safeVisibleCount = Math.max(1, Math.floor(visiblePointCount));
  const maxOffset = enabled ? Math.max(0, safeLength - safeVisibleCount) : 0;
  const offset = Math.min(maxOffset, Math.max(0, Math.round(requestedOffset)));
  const startIndex = enabled ? Math.max(0, safeLength - safeVisibleCount - offset) : 0;

  return {
    enabled: enabled && maxOffset > 0,
    startIndex,
    endIndex: enabled ? Math.min(safeLength, startIndex + safeVisibleCount) : safeLength,
    offset,
    maxOffset,
  };
}

/** 현재 보이는 구간에서 시작/끝을 포함해 균등한 날짜 눈금을 고른다. */
export function pickVisibleDateTicks<T extends { date: string }>(
  data: T[],
  targetCount = VISIBLE_DATE_TICK_COUNT
): string[] {
  if (data.length === 0 || targetCount <= 0) return [];
  if (data.length <= targetCount) return data.map((point) => point.date);
  if (targetCount === 1) return [data[data.length - 1].date];

  const lastIndex = data.length - 1;
  const indices = Array.from({ length: targetCount }, (_, index) =>
    Math.round((lastIndex * index) / (targetCount - 1))
  );

  return Array.from(new Set(indices)).map((index) => data[index].date);
}
