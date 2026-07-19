import { describe, expect, it } from 'vitest';
import { isLegalPath } from '@/lib/legal/routes';

describe('isLegalPath', () => {
  it.each(['/legal', '/legal/terms', '/legal/privacy'])('%s를 공개 경로로 판정한다', (path) => {
    expect(isLegalPath(path)).toBe(true);
  });

  it.each(['/legal-notice', '/auth/login', '/report/legal'])(
    '%s를 공개 경로로 판정하지 않는다',
    (path) => {
      expect(isLegalPath(path)).toBe(false);
    },
  );
});
