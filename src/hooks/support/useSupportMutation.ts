import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  answerSupportInquiry,
  createSupportInquiry,
  type AnswerSupportInquiryInput,
  type CreateSupportInquiryInput,
} from '@/lib/api/supportApi';
import { getErrorMessage } from '@/lib/utils';
import { supportKeys } from './supportKeys';

export function useCreateSupportInquiry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSupportInquiryInput) => createSupportInquiry(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.lists() });
      toast.success('문의가 접수되었습니다.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, '문의 접수에 실패했습니다.'));
    },
  });
}

export function useAnswerSupportInquiry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AnswerSupportInquiryInput) => answerSupportInquiry(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.lists() });
      toast.success('답변이 등록되었습니다.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, '답변 등록에 실패했습니다.'));
    },
  });
}
