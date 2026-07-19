import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { AuthUser, ProfileRow } from '@/types/auth';

// React.cache 로 같은 request 내 중복 호출 방지 (layout + page + 등에서 매번 호출돼도 1회만 실행).
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single<ProfileRow>();

  if (profile) {
    return {
      id: profile.id,
      email: profile.email,
      companyName: profile.company_name,
      avatarUrl: profile.avatar_url,
      role: profile.role,
      termsAgreedAt: profile.terms_agreed_at,
      termsAgreedVersion: profile.terms_agreed_version,
      privacyAgreedAt: profile.privacy_agreed_at,
      privacyAgreedVersion: profile.privacy_agreed_version,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  }

  // profiles 테이블에 없는 경우 fallback
  return {
    id: user.id,
    email: user.email ?? '',
    companyName: user.user_metadata?.company_name ?? '',
    avatarUrl: null,
    role: 'user',
    termsAgreedAt: null,
    termsAgreedVersion: null,
    privacyAgreedAt: null,
    privacyAgreedVersion: null,
    createdAt: user.created_at,
    updatedAt: user.created_at,
  };
});
