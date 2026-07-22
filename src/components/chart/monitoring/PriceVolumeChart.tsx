'use client';

import { Bar, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts';
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
  PRIMARY,
  PRIMARY_SOFT,
  SHARED_X_AXIS_PROPS,
} from './shared';
import { PriceVolumeTooltip } from './tooltips';
import { PannableChartViewport, type ChartViewportControlProps } from './PannableChartViewport';

interface Props {
  merged: MergedPoint[];
  priceDomain: [number | string, number | string];
  priceTicks?: number[];
  selectedDate: string | null;
  setSelectedDate: (fn: (prev: string | null) => string | null) => void;
  loading: boolean;
  barSize: number;
  dateTicks: string[];
  viewport: ChartViewportControlProps;
}

/** 탭 A — 주가 + 일별 수집량. */
export function PriceVolumeChart({
  merged,
  priceDomain,
  priceTicks,
  selectedDate,
  setSelectedDate,
  loading,
  barSize,
  dateTicks,
  viewport,
}: Props) {
  const hasPrice = merged.some((d) => d.close != null);
  return (
    <ChartCard
      kind="volume"
      subtitle={
        <>
          매일 생산된 평판 데이터와 주가 간의 상관관계를 확인할 수 있습니다.
          <br />
          주가가 상승/하락한 날 어떤 여론이 지배적이었는지 확인할 수 있습니다.
        </>
      }
      loading={loading}
      empty={!hasPrice}
    >
      <PannableChartViewport
        {...viewport}
        startDate={merged[0]?.date}
        endDate={merged[merged.length - 1]?.date}
      >
        <ChartCanvas width="100%">
          <ComposedChart
            data={merged}
            margin={{ top: 12, right: 24, bottom: 0, left: 0 }}
            onClick={makeChartClickHandler(setSelectedDate)}
            style={{ cursor: 'pointer' }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f1f5f9"
              vertical={false}
              yAxisId="price"
            />
            <XAxis {...SHARED_X_AXIS_PROPS} ticks={dateTicks} interval={0} />
            <YAxis
              yAxisId="vol"
              orientation="left"
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
            <Tooltip cursor={{ fill: PRIMARY_SOFT }} content={<PriceVolumeTooltip />} />
            <Line
              yAxisId="vol"
              type="monotone"
              dataKey="totalVolume"
              name="수집량"
              stroke={PRIMARY}
              strokeWidth={1.8}
              dot={false}
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
      </PannableChartViewport>
      <ChartLegend
        items={[
          { color: PRIMARY, label: '수집량 (좌, 건)' },
          { color: CANDLE_UP, label: '주가 상승 (우)' },
          { color: CANDLE_DOWN, label: '주가 하락 (우)' },
        ]}
      />
    </ChartCard>
  );
}
