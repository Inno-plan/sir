'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  Info,
  Minus,
  RefreshCw,
  Signal,
} from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCanvas } from '@/components/chart/ChartCanvas';
import { createClient } from '@/lib/supabase/client';

const SIGNAL_Z_THRESHOLD = 1;

// 가격추종 필터 비교(실험) — sir-backend scripts/backtest_sir_variants.py V8_price_znorm 재현.
// 프로덕션 leading_momentum_z 는 그대로 두고, 이미 저장된 leading_momentum_3d 시계열 위에서
// FE 단독으로 "억제 후 z" 를 다시 계산해 토글로 비교만 함 (DB 쓰기 없음).
// 2026-07-20 실데이터 재백테스트: 관찰 3종목 강신호 21건 적중 62% 스프레드 +6.69%p IC +0.268(p<0.05) /
// pooled 12개 워크스페이스 강신호 54건 적중 53% 스프레드 +2.54%p IC +0.205(p<0.05).
// 데이터 누적에 따라 주기적 재검증 필요 — 위 숫자는 위 스크립트를 다시 돌려 갱신할 것.
const PRICE_CHASE_LOOKBACK_DAYS = 3; // 거래일 기준
const PRICE_CHASE_THRESHOLD = 0.05; // 3거래일 ±5% 이상 동방향이면 '추종'으로 억제
const PRICE_FILTER_Z_WINDOW = 30; // sir-backend LEADING_Z_WINDOW 와 동일
const PRICE_FILTER_Z_MIN = 10; // sir-backend LEADING_Z_MIN 과 동일

const RANGE_OPTIONS = [
  { days: 30, label: '30일' },
  { days: 90, label: '90일' },
  { days: 180, label: '180일' },
  { days: 365, label: '1년' },
] as const;

type WorkspaceOption = {
  id: string;
  company_name: string;
  ticker: string;
  sir_score: number | null;
};

type LeadingSnapshotRow = {
  date: string;
  sir_score: number | null;
  is_carried: boolean;
  leading_sir: number | null;
  leading_momentum_3d: number | null;
  leading_momentum_z: number | null;
};

type StockRow = {
  date: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
};

type SignalType = 'positive' | 'negative' | 'weak' | 'none';

type LeadingChartPoint = {
  date: string;
  fullDate: string;
  sir: number | null;
  isCarried: boolean;
  leadingSir: number | null;
  momentum: number | null;
  momentumZ: number | null;
  signalType: SignalType;
  openPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  closePrice: number | null;
  prevClosePrice: number | null;
  closeChangePct: number | null;
  intradayChangePct: number | null;
};

const EMPTY_WORKSPACES: WorkspaceOption[] = [];
const EMPTY_CHART_POINTS: LeadingChartPoint[] = [];

interface LeadingSirLabClientProps {
  assignedWorkspaceIds: string[] | null;
}

function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getStartDate(days: number): string {
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return localDateString(start);
}

function getSignalType(momentumZ: number | null): SignalType {
  if (momentumZ == null) return 'none';
  if (momentumZ >= SIGNAL_Z_THRESHOLD) return 'positive';
  if (momentumZ <= -SIGNAL_Z_THRESHOLD) return 'negative';
  return 'weak';
}

function getSignalLabel(momentum: number | null): string {
  const type = getSignalType(momentum);
  if (type === 'positive') return '여론 개선 모멘텀';
  if (type === 'negative') return '여론 악화 모멘텀';
  if (type === 'weak') return '약한 신호/중립';
  return '신호 없음';
}

function getSignalTone(momentumZ: number | null): string {
  const type = getSignalType(momentumZ);
  if (type === 'positive') return 'border-red-200 bg-red-50 text-red-700';
  if (type === 'negative') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (type === 'weak') return 'border-slate-200 bg-slate-50 text-slate-600';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function getSignalColor(momentumZ: number | null): string {
  const type = getSignalType(momentumZ);
  if (type === 'positive') return '#ef4444';
  if (type === 'negative') return '#2563eb';
  if (type === 'weak') return '#64748b';
  return '#f59e0b';
}

function formatSigned(value: number | null, digits = 0): string {
  if (value == null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}`;
}

function formatPrice(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('ko-KR');
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${formatSigned(value, 2)}%`;
}

function formatIntensity(momentumZ: number | null | undefined): string {
  if (momentumZ == null) return '판정 불가';
  return `평소 변동의 ${Math.abs(momentumZ).toFixed(1)}배`;
}

function formatPriceTick(value: number): string {
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}만`;
  return value.toLocaleString('ko-KR');
}

function formatDateLabel(date: string): string {
  return date.slice(5).replace('-', '/');
}

function buildPriceDomain(values: (number | null)[]): [number, number] {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return [0, 100];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === max) return [Math.max(0, min * 0.98), max * 1.02 + 1];
  return [Math.floor(min * 0.98), Math.ceil(max * 1.02)];
}

function getXInterval(length: number): number {
  if (length > 180) return 24;
  if (length > 90) return 12;
  if (length > 45) return 5;
  return 2;
}

function getPriceMoveColor(value: number | null | undefined): string {
  if (value == null || value === 0) return '#64748b';
  return value > 0 ? '#ef4444' : '#3b82f6';
}

async function fetchWorkspaces(assignedWorkspaceIds: string[] | null): Promise<WorkspaceOption[]> {
  if (assignedWorkspaceIds && assignedWorkspaceIds.length === 0) return [];

  const supabase = createClient();
  let query = supabase
    .from('workspaces')
    .select('id, company_name, ticker, sir_score')
    .order('company_name', { ascending: true });

  if (assignedWorkspaceIds) {
    query = query.in('id', assignedWorkspaceIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as WorkspaceOption[];
}

async function fetchLeadingSeries(workspaceId: string, days: number): Promise<LeadingChartPoint[]> {
  if (!workspaceId) return [];

  const supabase = createClient();
  const startDate = getStartDate(days);

  const [snapshotRes, stockRes] = await Promise.all([
    supabase
      .from('daily_snapshots')
      .select('date, sir_score, is_carried, leading_sir, leading_momentum_3d, leading_momentum_z')
      .eq('workspace_id', workspaceId)
      .gte('date', startDate)
      .order('date', { ascending: true }),
    supabase
      .from('stock_prices')
      .select('date, open_price, high_price, low_price, close_price')
      .eq('workspace_id', workspaceId)
      .gte('date', startDate)
      .order('date', { ascending: true }),
  ]);

  if (snapshotRes.error) throw snapshotRes.error;
  if (stockRes.error) throw stockRes.error;

  const snapshots = (snapshotRes.data ?? []) as LeadingSnapshotRow[];
  const stocks = (stockRes.data ?? []) as StockRow[];
  const snapshotMap = new Map(snapshots.map((row) => [row.date, row]));
  const stockMap = new Map(stocks.map((row) => [row.date, row]));
  const dates = Array.from(new Set([...snapshotMap.keys(), ...stockMap.keys()])).sort();

  let prevClosePrice: number | null = null;
  return dates.map((date) => {
    const snapshot = snapshotMap.get(date);
    const stock = stockMap.get(date);
    const momentum = snapshot?.leading_momentum_3d ?? null;
    const momentumZ = snapshot?.leading_momentum_z ?? null;
    const closePrice = stock?.close_price ?? null;
    const openPrice = stock?.open_price ?? null;
    const closeChangePct =
      closePrice != null && prevClosePrice != null
        ? ((closePrice - prevClosePrice) / prevClosePrice) * 100
        : null;
    const intradayChangePct =
      closePrice != null && openPrice != null ? ((closePrice - openPrice) / openPrice) * 100 : null;
    const currentPrevClose = prevClosePrice;
    if (closePrice != null) prevClosePrice = closePrice;

    return {
      date: formatDateLabel(date),
      fullDate: date,
      sir: snapshot?.sir_score ?? null,
      isCarried: snapshot?.is_carried ?? false,
      leadingSir: snapshot?.leading_sir ?? null,
      momentum,
      momentumZ,
      signalType: getSignalType(momentumZ),
      openPrice,
      highPrice: stock?.high_price ?? null,
      lowPrice: stock?.low_price ?? null,
      closePrice,
      prevClosePrice: currentPrevClose,
      closeChangePct,
      intradayChangePct,
    };
  });
}

/** 가격추종 필터 비교(실험): 이미 fetch 된 momentum/종가 시계열만으로 재계산.
 * date → 필터 적용 후 z (억제된 날/워밍업은 null). 원본 leading_sir/momentum 은 건드리지 않음.
 * 주의: 조회 기간(rangeDays) 밖 데이터는 안 보이므로, 기간 시작 근처 며칠은
 * 직전 3거래일 종가 부족으로 가격추종 필터가 적용되지 않을 수 있음(백엔드는 전체 히스토리 사용).
 */
function computePriceFilteredSignal(rows: LeadingChartPoint[]): Map<string, number | null> {
  const tradingDays = rows
    .filter((row): row is LeadingChartPoint & { closePrice: number } => row.closePrice != null)
    .map((row) => ({ date: row.fullDate, close: row.closePrice }));
  const tradingIndexByDate = new Map(tradingDays.map((t, i) => [t.date, i]));

  const result = new Map<string, number | null>();
  const momentumHistory: number[] = [];

  for (const row of rows) {
    const m = row.momentum;
    if (m == null) continue;

    let chased = false;
    const idx = tradingIndexByDate.get(row.fullDate);
    if (idx != null && idx >= PRICE_CHASE_LOOKBACK_DAYS) {
      const prevClose = tradingDays[idx - PRICE_CHASE_LOOKBACK_DAYS].close;
      const curClose = tradingDays[idx].close;
      if (prevClose) {
        const ret3 = curClose / prevClose - 1;
        if (Math.abs(ret3) >= PRICE_CHASE_THRESHOLD && Math.sign(ret3) === Math.sign(m) && m !== 0) {
          chased = true;
        }
      }
    }

    if (chased) {
      momentumHistory.push(m); // z 분모 누적은 억제 여부와 무관 (sir-backend V8 과 동일)
      result.set(row.fullDate, null);
      continue;
    }

    const window = momentumHistory.slice(-PRICE_FILTER_Z_WINDOW);
    let z: number | null = null;
    if (window.length >= PRICE_FILTER_Z_MIN) {
      const mean = window.reduce((a, b) => a + b, 0) / window.length;
      const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length;
      const std = Math.sqrt(variance);
      if (std > 0) z = Math.round((m / std) * 100) / 100;
    }
    momentumHistory.push(m);
    result.set(row.fullDate, z);
  }

  return result;
}

function StatCard({
  label,
  value,
  helper,
  tone = 'slate',
}: {
  label: string;
  value: React.ReactNode;
  helper: React.ReactNode;
  tone?: 'slate' | 'green' | 'rose' | 'blue' | 'amber';
}) {
  const toneClass = {
    slate: 'border-slate-100 bg-white',
    green: 'border-emerald-100 bg-emerald-50/60',
    rose: 'border-rose-100 bg-rose-50/60',
    blue: 'border-blue-100 bg-blue-50/60',
    amber: 'border-amber-100 bg-amber-50/60',
  }[tone];

  return (
    <div className={`rounded-2xl border px-4 py-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </div>
  );
}

function SignalIcon({ momentumZ }: { momentumZ: number | null }) {
  const type = getSignalType(momentumZ);
  if (type === 'positive') return <ArrowUpRight size={16} className="text-red-600" />;
  if (type === 'negative') return <ArrowDownRight size={16} className="text-blue-600" />;
  if (type === 'weak') return <Minus size={16} className="text-slate-500" />;
  return <AlertTriangle size={16} className="text-amber-600" />;
}

type StockCandleShapeProps = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  payload?: LeadingChartPoint;
  minPrice: number;
  maxPrice: number;
};

type SignalMarkerPayload = LeadingChartPoint & { signalMarkerY: number | null };

function toNumber(value: number | string | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function StockCandleShape({
  x,
  y,
  width,
  height,
  payload,
  minPrice,
  maxPrice,
}: StockCandleShapeProps) {
  const xNum = toNumber(x);
  const yNum = toNumber(y);
  const widthNum = toNumber(width);
  const heightNum = toNumber(height);
  if (xNum == null || yNum == null || widthNum == null || heightNum == null || !payload)
    return null;

  const { openPrice, closePrice, highPrice, lowPrice } = payload;
  if (openPrice == null || closePrice == null || highPrice == null || lowPrice == null) return null;
  if (!(maxPrice > minPrice)) return null;

  const fullRange = maxPrice - minPrice;
  const renderedPriceRange = Math.max(highPrice - minPrice, 1);
  const barTop = yNum;
  const barBottom = yNum + heightNum;
  const priceToY = (value: number) => {
    const ratio = (value - minPrice) / fullRange;
    return barBottom - ratio * (barBottom - barTop) * (fullRange / renderedPriceRange);
  };

  const color = getPriceMoveColor(payload.closeChangePct ?? payload.intradayChangePct);
  const cx = xNum + widthNum / 2;
  const candleWidth = Math.max(Math.min(widthNum * 0.86, 16), 6);
  const bodyTop = priceToY(Math.max(openPrice, closePrice));
  const bodyBottom = priceToY(Math.min(openPrice, closePrice));
  const bodyHeight = Math.max(bodyBottom - bodyTop, 2.5);
  const wickTop = priceToY(highPrice);
  const wickBottom = priceToY(lowPrice);

  return (
    <g>
      <line x1={cx} y1={wickTop} x2={cx} y2={wickBottom} stroke={color} strokeWidth={1.8} />
      <rect
        x={cx - candleWidth / 2}
        y={bodyTop}
        width={candleWidth}
        height={bodyHeight}
        fill={color}
        rx={2.5}
      />
    </g>
  );
}

function StrongSignalDot(props: {
  cx?: number;
  cy?: number;
  payload?: SignalMarkerPayload;
  index?: number;
}) {
  const { cx, cy, payload, index } = props;
  if (cx == null || cy == null || !payload || payload.signalMarkerY == null) {
    return <g key={`signal-empty-${index ?? 'x'}`} />;
  }

  const isPositive = payload.signalType === 'positive';
  const color = getSignalColor(payload.momentumZ);
  const path = isPositive
    ? `M ${cx} ${cy - 11} L ${cx - 9} ${cy + 7} L ${cx + 9} ${cy + 7} Z`
    : `M ${cx} ${cy + 11} L ${cx - 9} ${cy - 7} L ${cx + 9} ${cy - 7} Z`;

  return (
    <g key={`signal-${payload.fullDate}`}>
      <circle cx={cx} cy={cy} r={13} fill="#fff" stroke={color} strokeWidth={2} opacity={0.95} />
      <path d={path} fill={color} />
    </g>
  );
}

function LeadingMomentumChart({ data }: { data: LeadingChartPoint[] }) {
  const priceDomain = useMemo(
    () => buildPriceDomain(data.flatMap((d) => [d.lowPrice, d.highPrice])),
    [data]
  );
  const chartData = useMemo(
    () =>
      data.map((row) => ({
        ...row,
        signalMarkerY:
          row.signalType === 'positive' ? 940 : row.signalType === 'negative' ? 80 : null,
      })),
    [data]
  );
  const xInterval = getXInterval(data.length);

  if (data.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
        표시할 스냅샷/주가 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="h-[520px] outline-none **:outline-none">
      <ChartCanvas>
        <ComposedChart data={chartData} margin={{ top: 18, right: 66, bottom: 0, left: 8 }}>
          <CartesianGrid
            yAxisId="sir"
            strokeDasharray="3 3"
            stroke="#d8dee9"
            strokeOpacity={0.52}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
            axisLine={{ stroke: '#d8dee9' }}
            tickLine={false}
            interval={xInterval}
          />
          <YAxis
            yAxisId="sir"
            orientation="left"
            domain={[0, 1000]}
            ticks={[0, 250, 500, 750, 1000]}
            tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
            axisLine={{ stroke: '#d8dee9' }}
            tickLine={false}
            width={40}
            label={{
              value: 'SIR',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 10, fill: 'var(--color-text-muted)', textAnchor: 'middle' },
            }}
          />
          <YAxis
            yAxisId="price"
            orientation="right"
            domain={priceDomain}
            tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
            axisLine={{ stroke: '#d8dee9' }}
            tickLine={false}
            width={58}
            tickFormatter={(value) => formatPriceTick(Number(value))}
            label={{
              value: '주가',
              angle: 90,
              position: 'insideRight',
              style: { fontSize: 10, fill: 'var(--color-text-muted)', textAnchor: 'middle' },
            }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(15, 23, 42, 0.06)' }}
            contentStyle={{
              borderRadius: '10px',
              border: 'none',
              fontSize: '12px',
              boxShadow: 'none',
              padding: '0',
              background: 'transparent',
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as SignalMarkerPayload | undefined;
              if (!row) return null;
              return (
                <div className="min-w-72 rounded-xl border border-white bg-bg-dark-95 px-4 py-3 text-xs text-slate-300 shadow-card">
                  <p className="mb-2 text-sm font-semibold text-text-green">{row.fullDate}</p>
                  <div className="flex items-center justify-between gap-4">
                    <span>신호</span>
                    <span className="font-bold text-white">{getSignalLabel(row.momentumZ)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-4">
                    <span>3일 변화량</span>
                    <span className="font-semibold text-white">{formatSigned(row.momentum)}pt</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-4">
                    <span>강도</span>
                    <span className="font-semibold text-white">
                      {formatIntensity(row.momentumZ)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-4">
                    <span>Leading SIR</span>
                    <span className="font-semibold text-cyan-200">
                      {row.leadingSir == null ? '—' : `${Math.round(row.leadingSir)}점`}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-4">
                    <span>운영 SIR</span>
                    <span className="font-semibold text-fuchsia-200">
                      {row.sir == null ? '—' : `${Math.round(row.sir)}점`}
                    </span>
                  </div>
                  {row.isCarried && (
                    <p className="mt-1 text-[11px] text-amber-300">
                      carry 일자: 운영 SIR 자동 보정값 포함
                    </p>
                  )}
                  <div className="mt-2 border-t border-white/10 pt-2">
                    <div className="flex items-center justify-between gap-4">
                      <span>전일대비</span>
                      <span
                        className="font-bold"
                        style={{ color: getPriceMoveColor(row.closeChangePct) }}
                      >
                        {formatPercent(row.closeChangePct)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-4">
                      <span>시가대비</span>
                      <span
                        className="font-semibold"
                        style={{ color: getPriceMoveColor(row.intradayChangePct) }}
                      >
                        {formatPercent(row.intradayChangePct)}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-[auto_1fr_auto_1fr] gap-x-2 gap-y-0.5 border-t border-white/10 pt-2">
                      <span>전종</span>
                      <span className="text-right">{formatPrice(row.prevClosePrice)}</span>
                      <span>시</span>
                      <span className="text-right">{formatPrice(row.openPrice)}</span>
                      <span>고</span>
                      <span className="text-right">{formatPrice(row.highPrice)}</span>
                      <span>저</span>
                      <span className="text-right">{formatPrice(row.lowPrice)}</span>
                      <span>종</span>
                      <span className="text-right font-semibold text-white">
                        {formatPrice(row.closePrice)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }}
          />
          <Bar
            yAxisId="price"
            dataKey="highPrice"
            name="주가 캔들"
            fill="transparent"
            barSize={22}
            isAnimationActive={false}
            shape={(props) => (
              <StockCandleShape {...props} minPrice={priceDomain[0]} maxPrice={priceDomain[1]} />
            )}
          />
          <Line
            yAxisId="sir"
            type="monotone"
            dataKey="leadingSir"
            name="Leading SIR"
            stroke="#06b6d4"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 4, fill: '#06b6d4', stroke: '#fff', strokeWidth: 2 }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            yAxisId="sir"
            type="monotone"
            dataKey="sir"
            name="운영 SIR"
            stroke="#a855f7"
            strokeWidth={2.8}
            dot={false}
            activeDot={{ r: 4, fill: '#a855f7', stroke: '#fff', strokeWidth: 2 }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            yAxisId="sir"
            type="linear"
            dataKey="signalMarkerY"
            name="강신호"
            stroke="transparent"
            dot={(props) => <StrongSignalDot {...props} />}
            activeDot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartCanvas>
    </div>
  );
}

function SignalHistoryTable({ rows }: { rows: LeadingChartPoint[] }) {
  const strongRows = rows
    .filter((row) => row.signalType === 'positive' || row.signalType === 'negative')
    .map((row) => {
      const nextRow = rows.find(
        (candidate) => candidate.fullDate > row.fullDate && candidate.closeChangePct != null
      );
      const hit =
        nextRow?.closeChangePct == null
          ? null
          : row.signalType === 'positive'
            ? nextRow.closeChangePct > 0
            : nextRow.closeChangePct < 0;
      return { row, nextRow, hit };
    })
    .slice(-12)
    .reverse();

  const resolved = strongRows.filter((item) => item.hit != null);
  const hits = resolved.filter((item) => item.hit).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex flex-col gap-1 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800">강신호 히스토리</h2>
          <p className="text-xs text-slate-500">z 기준 |평소 변동| 1배 이상인 날만 표시합니다.</p>
        </div>
        <span className="text-xs font-semibold text-slate-500">
          {resolved.length > 0
            ? `지난 강신호 ${resolved.length}개 중 ${hits}개 적중`
            : '검증 가능한 강신호 없음'}
        </span>
      </div>
      {strongRows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-400">
          선택 기간에 강신호가 없습니다. 이 지표는 종목당 월 2~5회 수준으로 가끔 켜지는 알람입니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">신호일</th>
                <th className="px-4 py-2 text-left">신호</th>
                <th className="px-4 py-2 text-right">3일 변화량</th>
                <th className="px-4 py-2 text-right">강도</th>
                <th className="px-4 py-2 text-right">다음 거래일</th>
                <th className="px-4 py-2 text-center">결과</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {strongRows.map(({ row, nextRow, hit }) => (
                <tr key={row.fullDate} className="hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-slate-800">
                    {row.fullDate}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${getSignalTone(row.momentumZ)}`}
                    >
                      <SignalIcon momentumZ={row.momentumZ} />
                      {row.signalType === 'positive' ? '개선' : '악화'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatSigned(row.momentum)}pt
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatIntensity(row.momentumZ)}
                  </td>
                  <td
                    className="px-4 py-2 text-right font-semibold tabular-nums"
                    style={{ color: getPriceMoveColor(nextRow?.closeChangePct) }}
                  >
                    {nextRow
                      ? `${nextRow.fullDate} · ${formatPercent(nextRow.closeChangePct)}`
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-center font-bold">
                    {hit == null ? (
                      <span className="text-slate-300">—</span>
                    ) : hit ? (
                      <span className="text-emerald-600">✓</span>
                    ) : (
                      <span className="text-rose-600">✗</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function LeadingSirLabClient({ assignedWorkspaceIds }: LeadingSirLabClientProps) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [rangeDays, setRangeDays] = useState<(typeof RANGE_OPTIONS)[number]['days']>(90);
  const [priceFilterOn, setPriceFilterOn] = useState(false);

  const workspacesQuery = useQuery({
    queryKey: ['leading-sir-lab', 'workspaces', assignedWorkspaceIds?.join(',') ?? 'all'],
    queryFn: () => fetchWorkspaces(assignedWorkspaceIds),
  });

  const workspaces = workspacesQuery.data ?? EMPTY_WORKSPACES;
  const effectiveWorkspaceId = selectedWorkspaceId || workspaces[0]?.id || '';
  const selectedWorkspace = workspaces.find((ws) => ws.id === effectiveWorkspaceId) ?? null;

  const seriesQuery = useQuery({
    queryKey: ['leading-sir-lab', 'series', effectiveWorkspaceId, rangeDays],
    queryFn: () => fetchLeadingSeries(effectiveWorkspaceId, rangeDays),
    enabled: !!effectiveWorkspaceId,
  });

  const rows = seriesQuery.data ?? EMPTY_CHART_POINTS;

  const filteredSignalByDate = useMemo(
    () => (priceFilterOn ? computePriceFilteredSignal(rows) : null),
    [rows, priceFilterOn]
  );
  // effectiveRows: 필터 OFF 면 rows 그대로, ON 이면 momentumZ/signalType 만 재계산본으로 교체.
  // leadingSir/momentum/종가 등 나머지 필드는 항상 원본 값(변경 없음).
  const effectiveRows = useMemo(() => {
    if (!filteredSignalByDate) return rows;
    return rows.map((row) => {
      const z = filteredSignalByDate.get(row.fullDate) ?? null;
      return { ...row, momentumZ: z, signalType: getSignalType(z) };
    });
  }, [rows, filteredSignalByDate]);

  const latestRow = useMemo(
    () =>
      [...effectiveRows]
        .reverse()
        .find((row) => row.leadingSir != null || row.momentum != null || row.closePrice != null) ??
      null,
    [effectiveRows]
  );
  const latestSignalRow = useMemo(
    () => [...effectiveRows].reverse().find((row) => row.momentumZ != null) ?? null,
    [effectiveRows]
  );
  const priceChangePct = latestRow?.closeChangePct ?? null;

  const signalStats = useMemo(() => {
    const withSignal = effectiveRows.filter((row) => row.momentumZ != null);
    const positive = withSignal.filter((row) => row.signalType === 'positive').length;
    const negative = withSignal.filter((row) => row.signalType === 'negative').length;
    const weak = withSignal.filter((row) => row.signalType === 'weak').length;
    return { total: withSignal.length, positive, negative, weak };
  }, [effectiveRows]);

  const isLoading = workspacesQuery.isPending || (!!effectiveWorkspaceId && seriesQuery.isPending);
  const isError = workspacesQuery.isError || seriesQuery.isError;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white px-5 py-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            <Signal size={14} />
            테스트용 관리자 페이지
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">SIR 선행지표 검증</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              워크스페이스별 선행 모멘텀과 주가를 함께 확인합니다. 강신호 판정은
              leading_momentum_z를 쓰고, 크기는 leading_momentum_3d(pt)로 표시합니다.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex min-w-72 flex-col gap-1 text-xs font-semibold text-slate-500">
            워크스페이스
            <select
              value={effectiveWorkspaceId}
              onChange={(event) => setSelectedWorkspaceId(event.target.value)}
              disabled={workspaces.length === 0 || workspacesQuery.isPending}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400"
            >
              {workspaces.length === 0 ? (
                <option value="">워크스페이스 없음</option>
              ) : (
                workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.company_name} · {workspace.ticker}
                  </option>
                ))
              )}
            </select>
          </label>
          <div className="flex items-end gap-1">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.days}
                type="button"
                onClick={() => setRangeDays(option.days)}
                className={`h-10 rounded-xl px-3 text-xs font-bold transition-colors ${
                  rangeDays === option.days
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                }`}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPriceFilterOn((v) => !v)}
              className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-colors ${
                priceFilterOn
                  ? 'border-indigo-200 bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter size={14} />
              가격추종 필터(실험)
            </button>
            <button
              type="button"
              onClick={() => seriesQuery.refetch()}
              disabled={!effectiveWorkspaceId || seriesQuery.isFetching}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={14} className={seriesQuery.isFetching ? 'animate-spin' : ''} />
              새로고침
            </button>
          </div>
        </div>
      </header>

      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <div className="flex gap-2">
          <Info size={16} className="mt-0.5 shrink-0" />
          <p>
            이 지표는 통계적 경향 확인용이며 투자 조언이 아닙니다. 강신호는 평소 변동의 1배
            이상(|z|≥1)일 때만 표시합니다. z 정규화 강신호 방향 적중률은 관찰 3종목 기준 약
            64%지만, 전체 워크스페이스로 넓히면 약 58%로 baseline(무보정 57%)과 큰 차이가 없어
            종목별 편차가 큽니다(2026-07-20 재검증, sir-backend scripts/backtest_sir_variants.py).
          </p>
        </div>
      </div>

      {priceFilterOn && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          <div className="flex gap-2">
            <Filter size={16} className="mt-0.5 shrink-0" />
            <p>
              가격추종 필터(실험) 적용 중: 직전 3거래일 주가가 이미 신호와 같은 방향으로 ±5%
              이상 움직인 날은 &apos;추종&apos;으로 보고 강신호에서 뺀 뒤 z를 다시 계산합니다.
              DB에는 저장되지 않는 이 화면 전용 재계산입니다. 2026-07-20 실데이터 재백테스트: 관찰
              3종목 강신호 21건 중 적중 62% · 스프레드 +6.69%p · IC +0.268(p&lt;0.05) / 전체 12개
              워크스페이스 강신호 54건 중 적중 53% · 스프레드 +2.54%p · IC +0.205(p&lt;0.05). 기존
              방식보다 통계적으로는 더 유의하지만 강신호 건수가 절반 이하로 줄고, 종목에 따라
              신호가 거의 안 뜰 수 있습니다(관찰 3종목 중 솔루스첨단소재는 표본 부족).
            </p>
          </div>
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-700">
          데이터를 불러오지 못했습니다. Supabase 컬럼/권한 또는 네트워크 상태를 확인해 주세요.
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="최신 선행 모멘텀"
          tone={
            !latestSignalRow
              ? 'amber'
              : latestSignalRow.signalType === 'positive'
                ? 'green'
                : latestSignalRow.signalType === 'negative'
                  ? 'blue'
                  : 'slate'
          }
          value={
            <span className="inline-flex items-center gap-2">
              <SignalIcon momentumZ={latestSignalRow?.momentumZ ?? null} />
              {latestSignalRow?.momentumZ == null
                ? '신호 없음'
                : `${formatSigned(latestSignalRow.momentum)}pt`}
            </span>
          }
          helper={
            latestSignalRow
              ? `${latestSignalRow.fullDate} · ${getSignalLabel(latestSignalRow.momentumZ)} · ${formatIntensity(latestSignalRow.momentumZ)}`
              : 'z 워밍업/데이터 부족으로 아직 판정 가능한 신호가 없습니다.'
          }
        />
        <StatCard
          label="최신 Leading SIR"
          tone="blue"
          value={
            latestRow?.leadingSir == null
              ? '—'
              : `${Math.round(latestRow.leadingSir).toLocaleString('ko-KR')}점`
          }
          helper="news+community만 재계산한 SIR 레벨"
        />
        <StatCard
          label="최신 종가"
          value={formatPrice(latestRow?.closePrice)}
          helper={
            priceChangePct == null
              ? '전일 대비 계산 불가'
              : `직전 거래일 대비 ${formatSigned(priceChangePct, 2)}%`
          }
          tone={priceChangePct == null ? 'slate' : priceChangePct >= 0 ? 'rose' : 'blue'}
        />
        <StatCard
          label="기간 내 강한 신호"
          value={`${signalStats.positive + signalStats.negative}회`}
          helper={`개선 ${signalStats.positive} · 악화 ${signalStats.negative} · 약한 신호 ${signalStats.weak}`}
        />
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">주가 캔들 × SIR × 강신호 마커</h2>
            <p className="mt-1 text-sm text-slate-500">
              매일 변하는 모멘텀 막대 대신 z 기준 강신호 일자에만 ▲/▼ 마커를 찍습니다. Leading SIR과
              운영 SIR은 별도 색 선으로 보고, 주가는 캔들로 하루 등락률을 확인합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {priceFilterOn && (
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                <Filter size={12} /> 가격추종 필터 적용
              </span>
            )}
            {selectedWorkspace && (
              <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {selectedWorkspace.company_name} · {selectedWorkspace.ticker}
              </span>
            )}
          </div>
        </div>
        {isLoading ? (
          <div className="flex h-96 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
            데이터를 불러오는 중입니다...
          </div>
        ) : (
          <LeadingMomentumChart data={effectiveRows} />
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-red-500" /> ▲ 개선 강신호
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-blue-600" /> ▼ 악화 강신호
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-slate-400" /> |z|&lt;1 약한 신호/중립
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded bg-cyan-500" /> Leading SIR
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded bg-purple-500" /> 운영 SIR
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-red-500" /> 상승 캔들
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-blue-500" /> 하락 캔들
          </span>
        </div>
      </section>

      <SignalHistoryTable rows={effectiveRows} />
    </main>
  );
}
