import { z } from 'zod';
import { sentimentEnum, criticalTypeEnum } from '@/types/common';

// ── reports 테이블 ──

export const reportSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  type: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  sir_score: z.number().nullable(),
  avg_sir_score: z.number().nullable(),
  status: z.string(),
  generated_at: z.string().nullable(),
  created_at: z.string(),
});

export type Report = z.infer<typeof reportSchema>;

// ── session_strategies 테이블 (총평) ──

export const summarySubsectionSchema = z.object({
  title: z.string(),
  points: z.array(z.string()),
});

export const summarySectionSchema = z.object({
  summary: z.string(),
  subsections: z.array(summarySubsectionSchema),
});

export type SummarySubsection = z.infer<typeof summarySubsectionSchema>;
export type SummarySection = z.infer<typeof summarySectionSchema>;

// ── session_strategies 테이블 (대응 전략) ──

export const strategyActionSchema = z.object({
  platform: z.string(),
  topic: z.string(),
  contents: z.array(z.string()),
});

export const strategyDataSchema = z.object({
  background: z.object({
    summary: z.string(),
    points: z.array(z.string()),
  }),
  proposal: z.object({
    summary: z.string(),
    actions: z.array(strategyActionSchema),
  }),
  // 옛 보고서엔 effect 가 있을 수 있어 schema 는 받아주되, 신규 응답엔 없음 (UI/프롬프트에서 제거됨)
  effect: z
    .object({
      summary: z.string(),
      points: z.array(z.string()),
    })
    .optional(),
});

export const strategyGroupSchema = z.object({
  category: z.string(),
  label: z.string(),
  strategy: strategyDataSchema,
});

export type StrategyAction = z.infer<typeof strategyActionSchema>;
export type StrategyData = z.infer<typeof strategyDataSchema>;
export type StrategyGroup = z.infer<typeof strategyGroupSchema>;

// ── daily_snapshots + stock_prices (차트 파생 타입) ──

export const sirStockPointSchema = z.object({
  date: z.string(),
  fullDate: z.string(),
  sir: z.number().nullable(),
  /** 직전 일자에서 carry-forward 된 일자 (raw 0건). 차트에서 ○ 마커로 표시. */
  isCarried: z.boolean(),
  open_price: z.number().nullable(),
  high_price: z.number().nullable(),
  low_price: z.number().nullable(),
  close_price: z.number().nullable(),
});

export type SirStockPoint = z.infer<typeof sirStockPointSchema>;

// ── SIR 순위 (파생 타입) ──

export const tierItemSchema = z.object({
  tier: z.string(),
  count: z.number(),
  isCurrent: z.number(),
});

export const sirRankingSchema = z.object({
  tiers: z.array(tierItemSchema),
  rank: z.number(),
  total: z.number(),
  average: z.number(),
});

export type TierItem = z.infer<typeof tierItemSchema>;
export type SirRanking = z.infer<typeof sirRankingSchema>;

// ── 채널 통계 (파생 타입) ──

export const channelStatSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.number(),
  color: z.string(),
  sir: z.number(),
  positive: z.number(),
  negative: z.number(),
  neutral: z.number(),
});

export type ChannelStat = z.infer<typeof channelStatSchema>;

// ── 채널 아이템 (all_items 뷰 파생) ──

export const channelItemSchema = z.object({
  id: z.string(),
  platform_id: z.string(),
  title: z.string(),
  link: z.string(),
  source: z.string().nullable(),
  content: z.string().nullable(),
  summary: z.string().nullable(),
  published_at: z.string().nullable(),
  sentiment: z.string(),
  cluster_id: z.string().nullable().optional(),
  impact_score: z.number().nullable().optional(),
  views: z.number().nullable().optional(),
  comments: z.number().nullable().optional(),
  metadata_purged_at: z.string().nullable().optional(),
});

export type ChannelItem = z.infer<typeof channelItemSchema>;

// ── 뉴스 클러스터 (API 응답) ──

export const newsClusterResponseSchema = z.object({
  id: z.string(),
  representative_title: z.string(),
  sentiment: z.string().nullable(),
  summary: z.string().nullable(),
  items: z.array(z.object({
    title: z.string(),
    source: z.string(),
    link: z.string(),
    published_at: z.string().nullable(),
  })),
});

export type NewsClusterResponse = z.infer<typeof newsClusterResponseSchema>;

// ── 리스크 아이템 (파생 타입) ──

export const riskItemSchema = z.object({
  id: z.string(),
  platform_id: z.string(),
  title: z.string(),
  link: z.string(),
  critical_type: criticalTypeEnum,
  critical_reason: z.string().nullable(),
  published_at: z.string().nullable(),
  /** 위기 대응 센터에서 여러 report 간 items 를 한꺼번에 표시할 때, 신고 대행 요청
   *  submit 시 올바른 report_id 를 역추적하기 위한 필드. */
  session_id: z.string().nullable().optional(),
  metadata_purged_at: z.string().nullable().optional(),
});

export type RiskItem = z.infer<typeof riskItemSchema>;

// ── 이전 리포트 비교 ──

export const prevReportSchema = z.object({
  id: z.string(),
  type: z.string(),
  sirScore: z.number(),
  createdAt: z.string(),
  totalItems: z.number(),
  riskCount: z.number(),
  channelSirMap: z.record(z.string(), z.number()),
});

export type PrevReport = z.infer<typeof prevReportSchema>;

// ── risk_reports 테이블 ──

export const riskReportSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  report_id: z.string(),
  source_table: z.string(),
  source_id: z.string(),
  platform_id: z.string(),
  title: z.string(),
  link: z.string(),
  critical_type: criticalTypeEnum,
  reason: z.string(),
  evidence: z.string(),
  file_urls: z.array(z.string()),
  status: z.string(),
  admin_note: z.string().nullable(),
  requested_at: z.string(),
  resolved_at: z.string().nullable(),
  metadata_purged_at: z.string().nullable().optional(),
});

export type RiskReport = z.infer<typeof riskReportSchema>;
