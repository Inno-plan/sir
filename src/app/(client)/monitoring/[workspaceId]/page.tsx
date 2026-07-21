'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { TrendingDown, Activity, MessageSquare, Calendar, LineChart } from 'lucide-react';
import { useWorkspace } from '@/hooks/workspace/useWorkspaceQuery';
import {
  useMonitoringDaily,
  useMonitoringStock,
  useMonitoringRisks,
  useMonitoringChannelMatrix,
  useMonitoringLatestClose,
} from '@/hooks/monitoring/useMonitoringQuery';
// import { useMonitoringSearchLive } from '@/hooks/monitoring/useMonitoringSearchLive';
import {
  pickMatrixCount,
  type Channel,
  type SentimentFilter,
} from '@/lib/api/monitoringApi';
// import { AiAnalysisCard } from '@/components/client/monitoring/AiAnalysisCard';
import { DayDetailDrawer } from '@/components/client/monitoring/DayDetailDrawer';
import { ReportDisclaimer } from '@/components/report/ReportDisclaimer';
import {
  niceTicks,
  type MergedPoint,
  type SentimentSeriesPoint,
  type ChannelFilteredPoint,
} from '@/components/chart/monitoring/shared';
import { PriceVolumeChart } from '@/components/chart/monitoring/PriceVolumeChart';
import { SentimentPriceChart } from '@/components/chart/monitoring/SentimentPriceChart';
// import { SearchPriceChart } from '@/components/chart/monitoring/SearchPriceChart';
// import { RiskPriceChart } from '@/components/chart/monitoring/RiskPriceChart';
import { ChannelVolumePriceChart } from '@/components/chart/monitoring/ChannelVolumePriceChart';
// import { VolumeSearchChart } from '@/components/chart/monitoring/VolumeSearchChart';

// ── date utils (KST 기준) ──────────────────────────────────────────────
function kstTodayStr(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function shiftDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + days);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

const PRESETS = [
  { id: 7, label: '7일' },
  { id: 30, label: '30일' },
  { id: 90, label: '90일' },
  { id: 180, label: '180일' },
  { id: 365, label: '1년' },
] as const;

const TABS = [
  { id: 'A', label: '데이터 수집량과 주가 관계' },
  { id: 'E', label: '채널별 여론과 주가 관계' },
  { id: 'B', label: '감정 분포와 주가 관계' },
  // { id: 'D', label: '리스크 유형과 주가 관계' },
  // { id: 'C', label: '검색량과 주가 관계' },
  // { id: 'F', label: '데이터 수집량과 검색량 관계' },
] as const;
type TabId = (typeof TABS)[number]['id'];

// ── PAGE ────────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const params = useParams();
  const workspaceId = (params?.workspaceId as string) ?? '';
  const { data: workspace } = useWorkspace(workspaceId);

  const today = useMemo(() => kstTodayStr(), []);
  const [presetDays, setPresetDays] = useState<number>(30);
  // 분석/차트 기준 — 오늘은 미완결 데이터 (KST 자정 cutoff). end = 어제, start = end - (N-1)
  const end = useMemo(() => shiftDays(today, -1), [today]);
  const start = useMemo(() => shiftDays(end, -(presetDays - 1)), [end, presetDays]);
  const [activeTab, setActiveTab] = useState<TabId>('A');
  // 차트 데이터 포인트 클릭 → 우측 drawer 에 노출할 KST 일자. null = drawer 닫힘.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // E 탭(채널별 수집량 + 주가) 감정 토글. 4채널 라인에 동시 적용.
  // is_relevant=true 인 항목만 매트릭스에 들어오므로 관련성 토글은 두지 않는다 (동명 노이즈 자동 차단).
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('all');
  // E 탭 채널 가시성. 기본 전체 ON.
  const [visibleChannels, setVisibleChannels] = useState<Set<Channel>>(
    () => new Set(['news', 'blog', 'youtube', 'community']),
  );
  const toggleChannel = (id: Channel) => {
    setVisibleChannels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const range = presetDays;

  const { data: daily = [], isPending: dailyLoading } = useMonitoringDaily(workspaceId, start, end);
  const { data: stock = [], isPending: stockLoading } = useMonitoringStock(workspaceId, start, end);
  const { data: risks = [], isPending: risksLoading } = useMonitoringRisks(workspaceId, start, end);
  // 검색량 기반 탭(C/F)은 임시 비노출하므로 live search fetch도 중지.
  // const { data: search = [], isPending: searchLoading } = useMonitoringSearchLive(
  //   workspaceId,
  //   start,
  //   end,
  // );
  // E 탭(필터 토글) 전용 raw 매트릭스. E 탭 활성화 시에만 가져온다.
  const { data: matrix = [], isPending: matrixLoading } = useMonitoringChannelMatrix(
    activeTab === 'E' ? workspaceId : '',
    start,
    end,
  );

  const isLoading = dailyLoading || stockLoading || risksLoading;

  // ── 머지: 전체 일자 축 (수집/주가/리스크/검색 모두 한 series 안에 두면 차트 정렬 안정) ──
  const merged: MergedPoint[] = useMemo(() => {
    const dailyMap = new Map(daily.map((d) => [d.date, d]));
    const stockMap = new Map(stock.map((d) => [d.date, d]));
    const riskMap = new Map(risks.map((d) => [d.date, d]));
    // const searchMap = new Map(search.map((d) => [d.date, d]));
    const allDates = new Set<string>([
      ...daily.map((d) => d.date),
      ...stock.map((d) => d.date),
      ...risks.map((d) => d.date),
      // ...search.map((d) => d.date),
    ]);
    return Array.from(allDates)
      .sort()
      .map((date) => {
        const d = dailyMap.get(date);
        const s = stockMap.get(date);
        const r = riskMap.get(date);
        // const sr = searchMap.get(date);
        return {
          date,
          isCarried: d?.isCarried ?? false,
          channelVolume: d?.channelVolume ?? { news: 0, blog: 0, youtube: 0, community: 0 },
          totalVolume: d?.totalVolume ?? 0,
          positive: d?.positive ?? 0,
          neutral: d?.neutral ?? 0,
          negative: d?.negative ?? 0,
          open: s?.open ?? null,
          high: s?.high ?? null,
          low: s?.low ?? null,
          close: s?.close ?? null,
          risks: r?.byType ?? { defamation: 0, insult: 0, rumor: 0, spam: 0 },
          riskTotal: r?.total ?? 0,
          searchNaver: null,
        };
      });
  }, [daily, stock, risks]);

  // ── 현재 주가(최신 종가) — 기간 무관 ──
  const { data: lastClose, isPending: lastCloseLoading } = useMonitoringLatestClose(workspaceId);

  // ── 선택 기간 KPI — 차트와 동일 소스(merged=daily/risks)로 합산해 카드=차트 일치 보장 ──
  const periodVolume = useMemo(() => merged.reduce((s, d) => s + d.totalVolume, 0), [merged]);
  const periodRisk = useMemo(() => merged.reduce((s, d) => s + d.riskTotal, 0), [merged]);

  // ── 감정 비율 시계열 (스택 area 용) ────────────────────────────────
  // pos/neg 를 독립 반올림하면 합이 99~101 이 될 수 있어 Y축이 101% 까지 늘어나므로,
  // pos·neg 만 round 하고 neutral 은 차감으로 산정해 합 = 100 보장.
  const sentimentSeries: SentimentSeriesPoint[] = useMemo(
    () =>
      merged.map((d) => {
        const t = d.positive + d.neutral + d.negative;
        if (!t)
          return {
            date: d.date,
            positive: 0,
            neutral: 0,
            negative: 0,
            totalVolume: 0,
            rawPositive: 0,
            rawNeutral: 0,
            rawNegative: 0,
          };
        let pos = Math.round((d.positive / t) * 100);
        let neg = Math.round((d.negative / t) * 100);
        if (pos + neg > 100) {
          if (pos >= neg) pos = 100 - neg;
          else neg = 100 - pos;
        }
        const neu = 100 - pos - neg;
        return {
          date: d.date,
          positive: pos,
          neutral: neu,
          negative: neg,
          totalVolume: t,
          rawPositive: d.positive,
          rawNeutral: d.neutral,
          rawNegative: d.negative,
        };
      }),
    [merged],
  );

  // E 탭용: matrix 를 (relevant × sentiment) 토글에 따라 슬라이스해 채널 4선용 일자 시리즈로 변환.
  // merged 와 동일한 일자 축을 유지해 주가/캔들과 정렬되도록 한다.
  const channelFiltered: ChannelFilteredPoint[] = useMemo(() => {
    const matrixMap = new Map(matrix.map((m) => [m.date, m]));
    return merged.map((d) => {
      const m = matrixMap.get(d.date);
      const cv: Record<Channel, number> = { news: 0, blog: 0, youtube: 0, community: 0 };
      if (m) {
        for (const ch of ['news', 'blog', 'youtube', 'community'] as Channel[]) {
          cv[ch] = pickMatrixCount(m.byChannel[ch], sentimentFilter);
        }
      }
      return {
        ...d,
        channelVolume: cv,
        filteredVolume: cv.news + cv.blog + cv.youtube + cv.community,
      };
    });
  }, [merged, matrix, sentimentFilter]);

  // ── 가격 Y축 nice ticks 계산 (모든 차트 공통) ──
  const priceMin = Math.min(
    ...merged.filter((d) => d.low != null).map((d) => d.low as number),
    Infinity,
  );
  const priceMax = Math.max(
    ...merged.filter((d) => d.high != null).map((d) => d.high as number),
    -Infinity,
  );
  const priceNice = isFinite(priceMin) && isFinite(priceMax)
    ? niceTicks(priceMin * 0.98, priceMax * 1.02, 5)
    : null;
  const priceDomain: [number | string, number | string] = priceNice
    ? priceNice.domain
    : ['auto', 'auto'];
  const priceTicks: number[] | undefined = priceNice?.ticks;
  const hasPrice = merged.some((d) => d.close != null);
  // 데이터 점 폭에 따라 캔들/막대 두께. 60일 이상이면 좀게, 90일 이상이면 더 좁게.
  const barSize = range >= 180 ? 2 : range >= 90 ? 4 : 8;

  return (
    <div className="h-full bg-white overflow-y-auto">
      <div className="mx-auto w-full max-w-[1240px] px-4 lg:px-10 py-7 lg:py-10 flex flex-col gap-7">
        {/* 헤더 ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 bg-bg-dark px-5 py-5 lg:px-10 lg:py-8 rounded-xl">
          <div className="flex items-center gap-2.5">
            <LineChart size={24} className="text-blue-400" />
            <h1 className="text-xl lg:text-2xl font-bold text-white">
              {workspace?.company_name ?? '워크스페이스'} 인사이트
            </h1>
          </div>
          <p className="text-xs lg:text-sm font-medium text-slate-300">
            수집된 온라인 평판 데이터와 주가 간 상관관계를 분석해 효과적인 기업가치 관리를 위한
            인사이트를 얻을 수 있습니다.
          </p>
        </div>

        {/* 기간 프리셋 ───────────────────────────────── */}
        {/* 모바일: 2줄 (1줄=라벨+날짜, 2줄=프리셋) / 데스크톱: 1줄 */}
        <div className="rounded-2xl bg-slate-50/70 border border-slate-200/80 px-4 lg:px-5 py-3.5 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-5">
          <div className="flex items-center gap-2 text-slate-400 lg:shrink-0">
            <Calendar size={15} />
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase">기간</span>
            <span className="text-[11px] text-slate-400 tabular-nums ml-auto lg:hidden">
              {start} ~ {end}
            </span>
          </div>
          <div className="flex items-center gap-1 w-full lg:w-auto lg:flex-wrap">
            {PRESETS.map((p) => {
              const active = presetDays === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPresetDays(p.id)}
                  className={`text-[11.5px] font-bold px-3.5 py-1.5 rounded-full border transition-colors cursor-pointer tracking-[-0.005em] flex-1 lg:flex-none ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <span className="hidden lg:inline text-[11px] text-slate-400 tabular-nums ml-auto">
            {start} ~ {end}
          </span>
        </div>

        {/* KPI — 선택 기간 기준 (현재 주가만 최신 종가) ──────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          <KpiCard
            icon={<MessageSquare size={14} />}
            label="수집량"
            value={periodVolume.toLocaleString()}
            unit="건"
            loading={dailyLoading}
          />
          <KpiCard
            icon={<Activity size={14} />}
            label="현재 주가"
            value={lastClose != null ? lastClose.toLocaleString() : '—'}
            unit="원"
            loading={lastCloseLoading}
          />
          <KpiCard
            icon={<TrendingDown size={14} />}
            label="리스크 건수"
            value={periodRisk.toLocaleString()}
            unit="건"
            loading={risksLoading}
          />
        </div>

        {/* 탭 ───────────────────────────────────────────── */}
        <TabBar activeTab={activeTab} onChange={setActiveTab} />

        <p className="text-xs font-medium leading-relaxed text-slate-900 lg:text-sm">
          일자 클릭 시 그날의 상세한 평판 내역을 보실 수 있습니다.
        </p>

        {/* 차트 — 탭별 분기. 한 화면에 한 탭만 노출. */}
        <div className="-mt-3 flex flex-col gap-4">
          {activeTab === 'A' && (
            <PriceVolumeChart
              merged={merged}
              priceDomain={priceDomain}
              priceTicks={priceTicks}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              loading={isLoading}
              barSize={barSize}
            />
          )}
          {activeTab === 'B' && (
            <SentimentPriceChart
              merged={merged}
              sentimentSeries={sentimentSeries}
              priceDomain={priceDomain}
              priceTicks={priceTicks}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              loading={isLoading}
              barSize={barSize}
            />
          )}
          {/* 임시 비노출 탭: 리스크 유형과 주가 관계 / 검색량과 주가 관계 / 데이터 수집량과 검색량 관계
          {activeTab === 'C' && (
            <SearchPriceChart
              merged={merged}
              priceDomain={priceDomain}
              priceTicks={priceTicks}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              loading={isLoading}
              barSize={barSize}
            />
          )}
          {activeTab === 'D' && (
            <RiskPriceChart
              merged={merged}
              priceDomain={priceDomain}
              priceTicks={priceTicks}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              loading={isLoading}
              barSize={barSize}
            />
          )}
          */}
          {activeTab === 'E' && (
            <ChannelVolumePriceChart
              channelFiltered={channelFiltered}
              priceDomain={priceDomain}
              priceTicks={priceTicks}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              loading={isLoading || matrixLoading}
              barSize={barSize}
              sentimentFilter={sentimentFilter}
              setSentimentFilter={setSentimentFilter}
              visibleChannels={visibleChannels}
              toggleChannel={toggleChannel}
              hasPrice={hasPrice}
            />
          )}
          {/* 임시 비노출 탭: 데이터 수집량과 검색량 관계
          {activeTab === 'F' && (
            <VolumeSearchChart
              merged={merged}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              loading={isLoading}
              barSize={barSize}
            />
          )}
          */}
        </div>

        {/* AI 분석 ─────────────────────────────────────── */}
        {/* AI 분석 임시 비노출
        페이지 기간 프리셋(차트용) 과 완전 분리 — 카드 자체가 모달 트리거 + 토큰 차감 흐름 관리.
        <AiAnalysisCard workspaceId={workspaceId} />
        */}

        <ReportDisclaimer />
      </div>

      {/* 차트 데이터 포인트 클릭 → 그 날(KST) 수집 데이터 상세 drawer */}
      <DayDetailDrawer
        workspaceId={workspaceId}
        date={selectedDate}
        onClose={() => setSelectedDate(null)}
      />
    </div>
  );
}

// ── page-local subcomponents ────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  unit,
  tone,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  tone?: 'default' | 'warn' | 'danger';
  loading?: boolean;
}) {
  const toneClass =
    tone === 'warn'
      ? 'border-amber-200/80 bg-gradient-to-br from-amber-50/60 to-white'
      : tone === 'danger'
        ? 'border-red-200/80 bg-gradient-to-br from-red-50/50 to-white'
        : 'border-slate-200/80 bg-white';
  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col gap-2.5 ${toneClass} shadow-[0_1px_2px_rgba(15,23,42,0.04)]`}
    >
      <div className="flex items-center gap-2 text-slate-400">
        <span>{icon}</span>
        <span className="text-[11px] font-bold tracking-[0.06em] uppercase">{label}</span>
      </div>
      {loading ? (
        <div className="h-10 w-24 bg-slate-100 rounded animate-pulse" />
      ) : (
        <div className="flex items-baseline gap-1">
          <span className="text-[26px] sm:text-[30px] lg:text-[34px] font-bold tracking-[-0.025em] leading-none tabular-nums text-slate-900">
            {value}
          </span>
          {unit && <span className="text-xs sm:text-sm font-semibold text-slate-400">{unit}</span>}
        </div>
      )}
    </div>
  );
}

function TabBar({ activeTab, onChange }: { activeTab: TabId; onChange: (id: TabId) => void }) {
  // 라벨이 길어 가로 스크롤 대신 반응형 그리드로 줄바꿈 처리.
  // 현재 노출 탭 3개가 한 줄을 꽉 채우도록 sm 이상 3열 고정.
  // 모바일은 1열로 세로 배치해 긴 라벨 가독성 유지.
  // 셀 stretch(grid 기본) + min-h-[44px] 로 버튼 높이 균일 + 터치 타깃 확보.
  // break-keep: 한국어를 단어(어절) 단위로만 줄바꿈해 "데이터 수집량과 / 주가 관계" 처럼 자연스럽게.
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 lg:gap-2">
      {TABS.map((t) => {
        const active = t.id === activeTab;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`min-h-[44px] flex items-center justify-center text-center break-keep leading-tight text-[11.5px] lg:text-[12px] font-bold px-2.5 py-2 rounded-lg transition-colors cursor-pointer tracking-[-0.01em] ${
              active
                ? 'bg-slate-900 text-white shadow-[0_2px_6px_rgba(15,23,42,0.18)]'
                : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-200/80 hover:border-slate-300'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
