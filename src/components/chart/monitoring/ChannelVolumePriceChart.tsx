'use client';

import { Area, Bar, CartesianGrid, ComposedChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCanvas } from '@/components/chart/ChartCanvas';
import { MONITORING_CHANNELS, type Channel, type SentimentFilter } from '@/lib/api/monitoringApi';
import {
  buildPinLine,
  CandleBar,
  CANDLE_DOWN,
  CANDLE_UP,
  CHANNEL_COLOR,
  ChartCard,
  ChartLegend,
  type ChannelFilteredPoint,
  FilterGroup,
  type MergedPoint,
  makeChartClickHandler,
  priceTickFormatter,
  PRIMARY_SOFT,
  SHARED_X_AXIS_PROPS,
} from './shared';
import { ChannelPriceTooltip } from './tooltips';

const SENTIMENT_OPTIONS: { id: SentimentFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'positive', label: '긍정' },
  { id: 'neutral', label: '중립' },
  { id: 'negative', label: '부정' },
];

interface Props {
  channelFiltered: ChannelFilteredPoint[];
  priceDomain: [number | string, number | string];
  priceTicks?: number[];
  selectedDate: string | null;
  setSelectedDate: (fn: (prev: string | null) => string | null) => void;
  loading: boolean;
  barSize: number;
  sentimentFilter: SentimentFilter;
  setSentimentFilter: (v: SentimentFilter) => void;
  visibleChannels: Set<Channel>;
  toggleChannel: (id: Channel) => void;
  hasPrice: boolean;
}

/** 탭 E — 채널별 수집량(스택 area) + 주가(캔들) + 감정/채널 토글. */
export function ChannelVolumePriceChart({
  channelFiltered,
  priceDomain,
  priceTicks,
  selectedDate,
  setSelectedDate,
  loading,
  barSize,
  sentimentFilter,
  setSentimentFilter,
  visibleChannels,
  toggleChannel,
  hasPrice,
}: Props) {
  const empty = channelFiltered.every((d) => d.filteredVolume === 0) && !hasPrice;
  return (
    <>
      {/* 공통 토글 패널 — 두 차트(E1/E2)에 동시 적용. 현재는 E1 만 노출. */}
      <div className="rounded-2xl bg-white border border-slate-200/80 p-4 lg:p-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-8 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <FilterGroup
          label="감정"
          options={SENTIMENT_OPTIONS}
          value={sentimentFilter}
          onChange={setSentimentFilter}
        />
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 lg:pt-0 lg:border-t-0 lg:border-l lg:border-slate-100 lg:pl-6">
          <span className="text-[10px] font-bold tracking-[0.06em] uppercase text-slate-400 mr-1">
            채널
          </span>
          {MONITORING_CHANNELS.map((c) => {
            const on = visibleChannels.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleChannel(c.id)}
                aria-pressed={on}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  on
                    ? 'border-transparent text-white'
                    : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600'
                }`}
                style={on ? { backgroundColor: CHANNEL_COLOR[c.id] } : undefined}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: on ? '#fff' : CHANNEL_COLOR[c.id], opacity: on ? 0.9 : 0.7 }}
                />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <ChartCard
        kind="channel"
        subtitle={
          <>
            어떤 채널이 주가에 영향을 많이 미치는지 확인할 수 있습니다.
            <br />
            채널별 긍정/부정 반응이 주가에 영향을 미치는지 확인할 수 있습니다.
          </>
        }
        loading={loading}
        empty={empty}
      >
        <div className="h-[300px]">
          <ChartCanvas width="100%">
            <ComposedChart
              data={channelFiltered}
              margin={{ top: 12, right: 24, bottom: 0, left: 0 }}
              onClick={makeChartClickHandler(setSelectedDate)}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} yAxisId="vol" />
              <XAxis {...SHARED_X_AXIS_PROPS} />
              <YAxis
                yAxisId="vol"
                orientation="left"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={36}
                allowDecimals={false}
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
              <Tooltip
                cursor={{ fill: PRIMARY_SOFT }}
                content={<ChannelPriceTooltip visibleChannels={visibleChannels} showOhlc />}
              />
              {MONITORING_CHANNELS.filter((c) => visibleChannels.has(c.id)).map((c) => (
                <Area
                  key={c.id}
                  yAxisId="vol"
                  type="monotone"
                  dataKey={(d: MergedPoint) => d.channelVolume[c.id]}
                  name={c.label}
                  stackId="vol"
                  stroke={CHANNEL_COLOR[c.id]}
                  strokeWidth={1.8}
                  fill={CHANNEL_COLOR[c.id]}
                  fillOpacity={0.08}
                  isAnimationActive={false}
                />
              ))}
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
            ...MONITORING_CHANNELS.filter((c) => visibleChannels.has(c.id)).map((c) => ({
              color: CHANNEL_COLOR[c.id],
              label: c.label,
            })),
            { color: CANDLE_UP, label: '주가 상승 (우)' },
            { color: CANDLE_DOWN, label: '주가 하락 (우)' },
          ]}
        />
      </ChartCard>
    </>
  );
}
