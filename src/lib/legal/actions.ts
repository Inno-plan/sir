'use server';

import { createClient } from '@/lib/supabase/server';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '@/lib/legal/consts';

export interface AgreeToTermsResult {
  success: boolean;
  error?: string;
}

export async function agreeToTerms(): Promise<AgreeToTermsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: '로그인 세션을 확인할 수 없습니다. 다시 로그인해주세요.' };
  }

  const agreedAt = new Date().toISOString();
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .update({
      terms_agreed_at: agreedAt,
      terms_agreed_version: CURRENT_TERMS_VERSION,
      privacy_agreed_at: agreedAt,
      privacy_agreed_version: CURRENT_PRIVACY_VERSION,
    })
    .eq('id', user.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Failed to save user consent', error);
    return { success: false, error: '동의를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.' };
  }

  if (!profile) {
    return { success: false, error: '사용자 프로필을 확인할 수 없습니다. 관리자에게 문의해주세요.' };
  }

  return { success: true };
}
