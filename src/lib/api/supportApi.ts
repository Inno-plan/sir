import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';

type Tables = Database['public']['Tables'];
type SupportInquiryRow = Tables['support_inquiries']['Row'];

export const SUPPORT_CATEGORY_OPTIONS = [
  {
    id: 'feature',
    label: '기능 제안',
    placeholder: '제안하고 싶은 기능과 현재 업무에서 불편한 점, 기대하는 개선 결과를 작성해주세요.',
  },
  {
    id: 'bug',
    label: '오류 신고',
    placeholder: '오류가 발생한 화면, 재현 방법, 기대한 동작과 실제 동작을 자세히 작성해주세요.',
  },
  {
    id: 'upgrade',
    label: '서비스 업그레이드',
    placeholder:
      '필요한 기능, 대상 워크스페이스, 희망 적용 시점 등 업그레이드 문의 내용을 작성해주세요.',
  },
  {
    id: 'other',
    label: '기타',
    placeholder: '문의 목적과 필요한 후속 조치를 자유롭게 작성해주세요.',
  },
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORY_OPTIONS)[number]['id'];
export type SupportInquiryStatus = 'waiting' | 'answered';

export interface SupportInquiry {
  id: string;
  workspaceId: string;
  requesterId: string;
  category: SupportCategory;
  title: string;
  content: string;
  status: SupportInquiryStatus;
  answerContent: string | null;
  answeredBy: string | null;
  answeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupportInquiryInput {
  workspaceId: string;
  category: SupportCategory;
  title: string;
  content: string;
}

export interface AnswerSupportInquiryInput {
  inquiryId: string;
  answerContent: string;
}

export interface GetSupportInquiriesParams {
  workspaceId?: string;
}

export function isSupportCategory(value: string | undefined): value is SupportCategory {
  return SUPPORT_CATEGORY_OPTIONS.some((option) => option.id === value);
}

export function getSupportCategoryLabel(category: SupportCategory) {
  return SUPPORT_CATEGORY_OPTIONS.find((option) => option.id === category)?.label ?? '기타';
}

export function getSupportCategoryPlaceholder(category: SupportCategory) {
  return SUPPORT_CATEGORY_OPTIONS.find((option) => option.id === category)?.placeholder ?? '';
}

function normalizeCategory(value: string): SupportCategory {
  return isSupportCategory(value) ? value : 'other';
}

function normalizeStatus(value: string): SupportInquiryStatus {
  return value === 'answered' ? 'answered' : 'waiting';
}

function toSupportInquiry(row: SupportInquiryRow): SupportInquiry {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    requesterId: row.requester_id,
    category: normalizeCategory(row.category),
    title: row.title,
    content: row.content,
    status: normalizeStatus(row.status),
    answerContent: row.answer_content,
    answeredBy: row.answered_by,
    answeredAt: row.answered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const supabase = createClient();

export async function getSupportInquiries(
  params: GetSupportInquiriesParams = {},
): Promise<SupportInquiry[]> {
  let query = supabase
    .from('support_inquiries')
    .select('*')
    .order('created_at', { ascending: false });

  if (params.workspaceId) {
    query = query.eq('workspace_id', params.workspaceId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toSupportInquiry);
}

export async function createSupportInquiry(
  input: CreateSupportInquiryInput,
): Promise<SupportInquiry> {
  const title = input.title.trim();
  const content = input.content.trim();

  if (!input.workspaceId) throw new Error('워크스페이스 정보가 없습니다.');
  if (!title) throw new Error('문의 제목을 입력해주세요.');
  if (!content) throw new Error('문의 내용을 입력해주세요.');

  const { data, error } = await supabase
    .from('support_inquiries')
    .insert({
      workspace_id: input.workspaceId,
      category: input.category,
      title,
      content,
    })
    .select('*')
    .single();

  if (error) throw error;
  return toSupportInquiry(data);
}

export async function answerSupportInquiry(
  input: AnswerSupportInquiryInput,
): Promise<SupportInquiry> {
  const answerContent = input.answerContent.trim();
  if (!input.inquiryId) throw new Error('문의 정보가 없습니다.');
  if (!answerContent) throw new Error('답변 내용을 입력해주세요.');

  const { data, error } = await supabase.rpc('answer_support_inquiry', {
    p_inquiry_id: input.inquiryId,
    p_answer_content: answerContent,
  });

  if (error) throw error;
  if (!data) throw new Error('답변 등록 결과를 확인할 수 없습니다.');

  return toSupportInquiry(data);
}
