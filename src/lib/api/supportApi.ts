import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';

type Tables = Database['public']['Tables'];
type SupportInquiryRow = Tables['support_inquiries']['Row'];

export const SUPPORT_CATEGORY_OPTIONS = [
  {
    id: 'feature',
    label: '기능 제안',
    placeholder: 'SIR에 추가하고 싶은 새로운 기능, 개선하고 싶은 불편한 점 등을 자유롭게 제안해주세요.',
  },
  {
    id: 'bug',
    label: '오류 신고',
    placeholder: '오류가 발생한 상황과 현재 상태 등을 자세히 작성해주세요.',
  },
  {
    id: 'upgrade',
    label: '서비스 업그레이드',
    placeholder:
      'Armor, Booster 서비스로 업그레이드를 원하시면 문의를 남겨주세요.',
  },
  {
    id: 'contract_extension',
    label: '계약 연장',
    placeholder: '계약 연장을 원하는 기간과 문의 내용을 작성해주세요.',
  },
  {
    id: 'other',
    label: '기타',
    placeholder: '이용방법, 정산, 결제, 탈퇴 등 어떤 의견이든 부담 없이 문의해주세요.',
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
