'use client';

import type { ReactNode } from 'react';
import { ReferenceLine } from 'recharts';
import {
  BarChart3,
  Network,
  Smile,
  ShieldAlert,
  Search,
  Activity,
  type LucideIcon,
} from 'lucide-react';
import type { Channel, CriticalType, MonitoringDayPoint } from '@/lib/api/monitoringApi';

// ── 차트 공용 데이터 타입 ─────────────────────────────────────────────────
export type MergedPoint = MonitoringDayPoint & {
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  risks: Record<CriticalType, number>;
  riskTotal: number;
  searchNaver: number | null;
};

export type SentimentSeriesPoint = {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
  totalVolume: number;
  rawPositive: number;
  rawNeutral: number;
  rawNegative: number;
};

export type ChannelFilteredPoint = MergedPoint & { filteredVolume: number };

// ── 차트 공통 axis props ─────────────────────────────────────────────────
export const SHARED_X_AXIS_PROPS = {
  dataKey: 'date',
  tickFormatter: shortDate,
  tick: { fontSize: 10, fill: '#94a3b8' },
  axisLine: { stroke: '#e2e8f0' },
  tickLine: false,
  interval: 'preserveEnd' as const,
  minTickGap: 32,
};

/** 차트 데이터 포인트 클릭 → 같은 일자 재클릭 시 토글 닫기. */
export function makeChartClickHandler(
  setSelectedDate: (fn: (prev: string | null) => string | null) => void,
) {
  return (state: unknown) => {
    const label = (state as { activeLabel?: string } | null)?.activeLabel;
    if (!label) return;
    setSelectedDate((prev) => (prev === label ? null : label));
  };
}

/** 선택된 일자에 vertical reference line (pin 시각화). yAxisId 차트별로 지정. */
export function buildPinLine(selectedDate: string | null, yAxisId: string): ReactNode {
  if (!selectedDate) return null;
  return (
    <ReferenceLine
      yAxisId={yAxisId}
      x={selectedDate}
      stroke="#0f172a"
      strokeDasharray="3 3"
      strokeWidth={1}
      ifOverflow="hidden"
    />
  );
}

// ── color tokens (인사이트 차트 전반 공통) ────────────────────────────────
export const CHANNEL_COLOR: Record<Channel, string> = {
  news: '#2563eb',
  blog: '#10b981',
  youtube: '#ef4444',
  community: '#f59e0b',
};
export const CRITICAL_COLOR: Record<CriticalType, string> = {
  defamation: '#7c3aed',
  insult: '#ec4899',
  rumor: '#f97316',
  spam: '#0ea5e9',
};
export const SENTIMENT_COLOR = { pos: '#10b981', neu: '#94a3b8', neg: '#ef4444' };
// 수집량 의미 색 — 모든 탭에서 일관 사용 (라인/막대/툴팁 dot/hover cursor)
export const PRIMARY = '#10b981';
export const PRIMARY_SOFT = 'rgba(16, 185, 129, 0.08)';
// F 탭(수집·검색) 전용 — 네이버 검색 그린과 충돌 피하려고 파란색.
export const F_VOLUME = '#2563eb';
export const F_VOLUME_SOFT = 'rgba(37, 99, 235, 0.08)';
export const PRICE_LINE = '#0f172a';
// 한국 관습: 양봉(상승) red, 음봉(하락) blue
export const CANDLE_UP = '#ef4444';
export const CANDLE_DOWN = '#3b82f6';
export const SEARCH_NAVER = '#03c75a';

// ── tick formatters / nice ticks ─────────────────────────────────────────
export function priceTickFormatter(v: number): string {
  if (v >= 10000) {
    const k = v / 1000;
    return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
  }
  return v.toLocaleString();
}

export function shortDate(s: string): string {
  if (!s || s.length < 10) return s;
  return `${parseInt(s.slice(5, 7), 10)}/${parseInt(s.slice(8, 10), 10)}`;
}

/** Y축 nice ticks — 항상 targetCount(=5)개 균등 분할 + step 은 1·1.5·2·2.5·5 의 거듭제곱.
 *  좁은 가격 범위에서 padding 과해지지 않도록 1.5/2.5 도 허용. priceTickFormatter 가
 *  12.5k 같은 소수 한 자리 라벨도 처리.
 */
export function niceTicks(
  rawMin: number,
  rawMax: number,
  targetCount = 5,
): { domain: [number, number]; ticks: number[] } {
  if (!isFinite(rawMin) || !isFinite(rawMax) || rawMax <= rawMin) {
    return { domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1] };
  }
  const span = targetCount - 1;
  const roughStep = (rawMax - rawMin) / span;
  const exp = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const candidates: number[] = [];
  for (const e of [exp, exp * 10, exp * 100]) {
    candidates.push(1 * e, 1.5 * e, 2 * e, 2.5 * e, 5 * e);
  }
  let step = candidates[candidates.length - 1];
  for (const c of candidates) {
    const nMin = Math.floor(rawMin / c) * c;
    if (nMin + span * c >= rawMax) {
      step = c;
      break;
    }
  }
  const niceMin = Math.floor(rawMin / step) * step;
  const ticks = Array.from({ length: targetCount }, (_, i) => niceMin + i * step);
  return { domain: [niceMin, niceMin + span * step], ticks };
}

// ── 캔들 shape (Bar.shape prop) ───────────────────────────────────────────
interface CandleBarProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: {
    open?: number | null;
    close?: number | null;
    high?: number | null;
    low?: number | null;
  };
  priceMin: number;
  priceMax: number;
}

/** recharts Bar 의 shape prop. high(=dataKey) 좌표 + 바 높이에서 priceMin/priceMax 로 OHLC 위치 역산. */
export function CandleBar(props: CandleBarProps) {
  const { x, y, width, height, payload, priceMin, priceMax } = props;
  if (
    x == null ||
    y == null ||
    width == null ||
    height == null ||
    !payload?.open ||
    !payload.close ||
    !payload.high ||
    !payload.low
  )
    return null;
  const { open, close, high, low } = payload;
  const isUp = close >= open;
  const color = isUp ? CANDLE_UP : CANDLE_DOWN;
  const barTop = y;
  const barBottom = y + height;
  const fullRange = priceMax - priceMin;
  const priceRange = high - priceMin;
  const priceToY = (val: number) => {
    if (fullRange <= 0 || priceRange <= 0) return barBottom;
    const ratio = (val - priceMin) / fullRange;
    return barBottom - ratio * (barBottom - barTop) * (fullRange / priceRange);
  };
  const bodyTop = priceToY(Math.max(open, close));
  const bodyBottom = priceToY(Math.min(open, close));
  const bodyH = Math.max(bodyBottom - bodyTop, 1.5);
  const wickTop = priceToY(high);
  const wickBottom = priceToY(low);
  const cx = x + width / 2;
  return (
    <g>
      <line x1={cx} y1={wickTop} x2={cx} y2={wickBottom} stroke={color} strokeWidth={1} />
      <rect
        x={x + width * 0.15}
        y={bodyTop}
        width={width * 0.7}
        height={bodyH}
        fill={color}
        rx={1}
      />
    </g>
  );
}

// ── 차트 카드 wrapper ─────────────────────────────────────────────────────
export type ChartKind =
  | 'volume'
  | 'channel'
  | 'sentiment'
  | 'risk'
  | 'search'
  | 'volumeSearch';

// 탭별 의미 아이콘 + 액센트 컬러 — 헤더 칩에 사용. (accent 뒤 '14' = 8% 소프트 배경)
const CHART_BADGE: Record<ChartKind, { icon: LucideIcon; accent: string }> = {
  volume: { icon: BarChart3, accent: '#10b981' },
  channel: { icon: Network, accent: '#6366f1' },
  sentiment: { icon: Smile, accent: '#8b5cf6' },
  risk: { icon: ShieldAlert, accent: '#f43f5e' },
  search: { icon: Search, accent: '#f59e0b' },
  volumeSearch: { icon: Activity, accent: '#0ea5e9' },
};

export function ChartCard({
  kind,
  subtitle,
  children,
  loading,
  empty,
}: {
  kind?: ChartKind;
  subtitle?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  empty?: boolean;
}) {
  const badge = kind ? CHART_BADGE[kind] : null;
  const BadgeIcon = badge?.icon;
  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 p-5 lg:p-6 flex flex-col gap-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {subtitle && (
        <div className="flex items-center gap-2.5">
          {badge && BadgeIcon && (
            <span
              className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${badge.accent}14`, color: badge.accent }}
            >
              <BadgeIcon size={17} />
            </span>
          )}
          <p className="text-xs lg:text-sm font-normal text-text-muted leading-[1.5] m-0">{subtitle}</p>
        </div>
      )}
      {loading ? (
        <div className="h-[260px] rounded-xl bg-slate-50 animate-pulse" />
      ) : empty ? (
        <div className="h-[260px] flex items-center justify-center text-[12px] text-slate-400">
          이 기간에 표시할 데이터가 없습니다
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// ── 차트 범례 ─────────────────────────────────────────────────────────────
export function ChartLegend({
  items,
}: {
  items: { color: string; label: string; soft?: boolean }[];
}) {
  return (
    <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-500 flex-wrap">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: it.color, opacity: it.soft ? 0.55 : 1 }}
          />
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── 라디오 대체 세그먼트 컨트롤 — 1택, 4채널 라인 동시 필터에 사용 ───────
export function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[10px] font-bold tracking-[0.06em] uppercase text-slate-400">
        {label}
      </span>
      <div className="inline-flex p-0.5 bg-slate-100 rounded-lg">
        {options.map((opt) => {
          const on = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              aria-pressed={on}
              className={`text-[11.5px] font-bold px-3 py-1.5 rounded-md transition-all cursor-pointer tracking-[-0.005em] ${
                on
                  ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
