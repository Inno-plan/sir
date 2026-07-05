import { z } from 'zod';
import { sentimentEnum, criticalTypeEnum } from '@/types/common';

// ── sns_items 테이블 ──

export const snsItemSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  session_id: z.string().uuid().nullable(),
  platform_id: z.string(),
  title: z.string(),
  link: z.string(),
  content: z.string().nullable(),
  author: z.string().nullable(),
  summary: z.string().nullable(),
  published_at: z.string().nullable(),
  sentiment: sentimentEnum.nullable(),
  critical_type: criticalTypeEnum.nullable(),
  is_relevant: z.boolean().nullable(),
  metadata_purged_at: z.string().nullable(),
  impact_score: z.number().nullable(),
  views: z.number().nullable(),
  comments: z.number().nullable(),
  critical_reason: z.string().nullable(),
  created_at: z.string(),
});

export type SnsItem = z.infer<typeof snsItemSchema>;
