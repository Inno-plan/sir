import { describe, expect, it } from 'vitest';
import { isRiskNewerThanSeen } from '@/components/client/sidebar/riskNoticeBadge';

describe('isRiskNewerThanSeen', () => {
  it('does not show NEW when there is no latest risk timestamp', () => {
    expect(isRiskNewerThanSeen(null, null)).toBe(false);
    expect(isRiskNewerThanSeen(undefined, '2026-07-02T00:00:00.000Z')).toBe(false);
  });

  it('shows NEW when latest risk exists and no read-state exists', () => {
    expect(isRiskNewerThanSeen('2026-07-02T00:00:00.000Z', null)).toBe(true);
  });

  it('shows NEW only when latest risk is newer than latest seen risk', () => {
    expect(isRiskNewerThanSeen(
      '2026-07-02T00:00:01.000Z',
      '2026-07-02T00:00:00.000Z',
    )).toBe(true);
    expect(isRiskNewerThanSeen(
      '2026-07-02T00:00:00.000Z',
      '2026-07-02T00:00:00.000Z',
    )).toBe(false);
    expect(isRiskNewerThanSeen(
      '2026-07-01T23:59:59.000Z',
      '2026-07-02T00:00:00.000Z',
    )).toBe(false);
  });

  it('fails closed for invalid latest timestamps after read-state exists and treats invalid seen timestamps as unread', () => {
    expect(isRiskNewerThanSeen('not-a-date', '2026-07-02T00:00:00.000Z')).toBe(false);
    expect(isRiskNewerThanSeen('2026-07-02T00:00:00.000Z', 'not-a-date')).toBe(true);
  });
});
