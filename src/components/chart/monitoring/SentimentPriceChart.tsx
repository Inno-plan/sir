'use client';

import { Area, Bar, CartesianGrid, ComposedChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCanvas } from '@/components/chart/ChartCanvas';
import {
  buildPinLine,
  CandleBar,
  CANDLE_DOWN,
  CANDLE_UP,
  ChartCard,
  ChartLegend,
  type MergedPoint,
  makeChartClickHandler,
  priceTickFormatter,
  PRIMARY_SOFT,
  SENTIMENT_COLOR,
  type SentimentSeriesPoint,
  SHARED_X_AXIS_PROPS,
} from './shared';
import { SentimentPriceTooltip } from './tooltips';

interface Props {
  merged: MergedPoint[];
  sentimentSeries: SentimentSeriesPoint[];
  priceDomain: [number | string, number | string];
  priceTicks?: number[];
  selectedDate: string | null;
  setSelectedDate: (fn: (prev: string | null) => string | null) => void;
  loading: boolean;
  barSize: number;
}

/** 탭 B — 감정 분포(스택 area) + 주가(캔들). */
export function SentimentPriceChart({
  merged,
  sentimentSeries,
  priceDomain,
  priceTicks,
  selectedDate,
  setSelectedDate,
  loading,
  barSize,
}: Props) {
  const empty = sentimentSeries.every((d) => d.totalVolume === 0);
  // merged + sentimentSeries 같은 일자 매칭 (index 동기 가정 — 둘 다 같은 source 에서 파생)
  const data = merged.map((d, i) => ({ ...d, ...sentimentSeries[i] }));
  return (
    <ChartCard
      kind="sentiment"
      subtitle="수집된 평판의 긍정·중립·부정 비율이 주가 흐름과 맞물리는지 확인할 수 있습니다."
      loading={loading}
      empty={empty}
    >
      <div className="h-[300px]">
        <ChartCanvas width="100%">
          <ComposedChart
            data={data}
            margin={{ top: 12, right: 24, bottom: 0, left: 0 }}
            onClick={makeChartClickHandler(setSelectedDate)}
            style={{ cursor: 'pointer' }}
          >
            <defs>
              <linearGradient id="gPos3" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SENTIMENT_COLOR.pos} stopOpacity={0.4} />
                <stop offset="100%" stopColor={SENTIMENT_COLOR.pos} stopOpacity={0.08} />
              </linearGradient>
              <linearGradient id="gNeu3" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SENTIMENT_COLOR.neu} stopOpacity={0.35} />
                <stop offset="100%" stopColor={SENTIMENT_COLOR.neu} stopOpacity={0.06} />
              </linearGradient>
              <linearGradient id="gNeg3" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SENTIMENT_COLOR.neg} stopOpacity={0.4} />
                <stop offset="100%" stopColor={SENTIMENT_COLOR.neg} stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} yAxisId="sent" />
            <XAxis {...SHARED_X_AXIS_PROPS} />
            <YAxis
              yAxisId="sent"
              orientation="left"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              allowDataOverflow
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <YAxis
              yAxisId="price"
              orientation="right"
              tickFormatter={priceTickFormatter}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={48}
              domain={priceDomain}
              ticks={priceTicks}
            />
            <Tooltip cursor={{ fill: PRIMARY_SOFT }} content={<SentimentPriceTooltip />} />
            <Area
              yAxisId="sent"
              type="monotone"
              dataKey="positive"
              name="긍정"
              stackId="s"
              stroke={SENTIMENT_COLOR.pos}
              strokeWidth={1.2}
              fill="url(#gPos3)"
              isAnimationActive={false}
            />
            <Area
              yAxisId="sent"
              type="monotone"
              dataKey="neutral"
              name="중립"
              stackId="s"
              stroke={SENTIMENT_COLOR.neu}
              strokeWidth={1.2}
              fill="url(#gNeu3)"
              isAnimationActive={false}
            />
            <Area
              yAxisId="sent"
              type="monotone"
              dataKey="negative"
              name="부정"
              stackId="s"
              stroke={SENTIMENT_COLOR.neg}
              strokeWidth={1.2}
              fill="url(#gNeg3)"
              isAnimationActive={false}
            />
            <Bar
              yAxisId="price"
              dataKey="high"
              name="주가"
              fill="transparent"
              barSize={Math.max(barSize * 1.5, 4)}
              isAnimationActive={false}
              shape={(props) => (
                <CandleBar
                  {...props}
                  priceMin={priceDomain[0] as number}
                  priceMax={priceDomain[1] as number}
                />
              )}
            />
            {buildPinLine(selectedDate, 'price')}
          </ComposedChart>
        </ChartCanvas>
      </div>
      <ChartLegend
        items={[
          { color: SENTIMENT_COLOR.pos, label: '긍정' },
          { color: SENTIMENT_COLOR.neu, label: '중립' },
          { color: SENTIMENT_COLOR.neg, label: '부정' },
          { color: CANDLE_UP, label: '주가 상승 (우)' },
          { color: CANDLE_DOWN, label: '주가 하락 (우)' },
        ]}
      />
    </ChartCard>
  );
}
