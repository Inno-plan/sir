import type { AuthUser } from '@/types/auth';

export const CURRENT_TERMS_VERSION = 'v1.0';
export const CURRENT_PRIVACY_VERSION = 'v1.0';

type ConsentState = Pick<
  AuthUser,
  | 'termsAgreedAt'
  | 'termsAgreedVersion'
  | 'privacyAgreedAt'
  | 'privacyAgreedVersion'
>;

export function needsConsent(user: ConsentState): boolean {
  return (
    !user.termsAgreedAt ||
    user.termsAgreedVersion !== CURRENT_TERMS_VERSION ||
    !user.privacyAgreedAt ||
    user.privacyAgreedVersion !== CURRENT_PRIVACY_VERSION
  );
}
