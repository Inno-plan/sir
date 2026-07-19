import { describe, expect, it } from 'vitest';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  needsConsent,
} from '@/lib/legal/consts';

const agreed = {
  termsAgreedAt: '2026-07-20T00:00:00.000Z',
  termsAgreedVersion: CURRENT_TERMS_VERSION,
  privacyAgreedAt: '2026-07-20T00:00:00.000Z',
  privacyAgreedVersion: CURRENT_PRIVACY_VERSION,
};

describe('needsConsent', () => {
  it('현재 버전의 두 문서에 모두 동의했으면 false를 반환한다', () => {
    expect(needsConsent(agreed)).toBe(false);
  });

  it.each([
    ['termsAgreedAt', null],
    ['termsAgreedVersion', null],
    ['privacyAgreedAt', null],
    ['privacyAgreedVersion', null],
    ['termsAgreedVersion', 'v0.9'],
    ['privacyAgreedVersion', 'v0.9'],
  ] as const)('%s가 누락되거나 현재 버전과 다르면 true를 반환한다', (key, value) => {
    expect(needsConsent({ ...agreed, [key]: value })).toBe(true);
  });
});
