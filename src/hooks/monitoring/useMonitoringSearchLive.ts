import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getNaverSearchTrendLive,
  type MonitoringSearchPoint,
} from '@/lib/api/monitoringApi';
import { monitoringKeys } from './monitoringKeys';

const ONE_HOUR = 60 * 60 * 1000;

/** 네이버 데이터랩 365일치 검색 관심도 + 클라 슬라이스/재정규화.
 *
 *  - workspaceId 가 같으면 [start, end] 가 바뀌어도 추가 fetch 없음 (queryKey = workspaceId only)
 *  - 슬라이스 후 max=100 으로 재정규화 → 5 프리셋 간 비교 가능
 *  - 반환 타입은 Naver-only MonitoringSearchPoint
 */
export function useMonitoringSearchLive(
  workspaceId: string,
  start: string,
  end: string,
) {
  const query = useQuery({
    queryKey: monitoringKeys.searchLive365(workspaceId),
    queryFn: () => getNaverSearchTrendLive(workspaceId),
    enabled: !!workspaceId,
    staleTime: ONE_HOUR,
  });

  const sliced: MonitoringSearchPoint[] = useMemo(() => {
    const points = query.data?.points ?? [];
    if (!points.length || !start || !end) return [];
    const inRange = points.filter((p) => p.date >= start && p.date <= end);
    if (!inRange.length) return [];
    const max = inRange.reduce((m, p) => (p.ratio > m ? p.ratio : m), 0);
    if (max <= 0) {
      return inRange.map((p) => ({ date: p.date, naver: 0 }));
    }
    return inRange.map((p) => ({
      date: p.date,
      naver: Math.round((p.ratio / max) * 100),
    }));
  }, [query.data, start, end]);

  return {
    data: sliced,
    isPending: query.isPending,
    error: query.error,
  };
}
