import { describe, expect, it } from 'vitest';
import type { Subscription } from '@/lib/api/subscriptionApi';
import { getContractSummary, isContractExpiryNoticeDismissed } from '@/lib/subscription';

const NOW = new Date('2026-07-21T03:00:00.000Z');

function subscription(endedAt: string, contractType: Subscription['contract_type'] = 'paid'): Subscription {
  return {
    id: 'subscription-id',
    workspace_id: 'workspace-id',
    tier: 'white',
    contract_type: contractType,
    trial_started_at: contractType === 'trial' ? '2026-07-18T15:00:00.000Z' : null,
    started_at: '2026-06-30T15:00:00.000Z',
    ended_at: endedAt,
    has_daily: false,
    has_armor: false,
    has_booster: false,
    reason: 'initial',
    created_at: '2026-07-01T03:00:00.000Z',
  };
}

describe('contract expiry notice', () => {
  it('marks contracts with seven calendar days remaining as expiring', () => {
    expect(getContractSummary(subscription('2026-07-28T15:00:00.000Z'), NOW)).toMatchObject({
      status: 'expiring',
      daysUntilExpiry: 7,
    });
  });

  it('does not mark contracts with eight calendar days remaining as expiring', () => {
    expect(getContractSummary(subscription('2026-07-29T15:00:00.000Z'), NOW).status).toBe('active');
  });

  it('marks free trials with three calendar days remaining as expiring', () => {
    expect(
      getContractSummary(subscription('2026-07-24T15:00:00.000Z', 'trial'), NOW),
    ).toMatchObject({ status: 'expiring', daysUntilExpiry: 3 });
  });

  it('does not show the free trial notice with four days remaining', () => {
    expect(
      getContractSummary(subscription('2026-07-25T15:00:00.000Z', 'trial'), NOW).status,
    ).toBe('active');
  });

  it('uses the inclusive final service date for D-day', () => {
    expect(
      getContractSummary(
        subscription('2026-07-21T15:00:00.000Z'),
        new Date('2026-07-21T14:59:59.000Z'),
      ),
    ).toMatchObject({ status: 'expiring', daysUntilExpiry: 0 });
  });

  it('honors an unexpired dismissal for the same contract end date', () => {
    const sub = subscription('2026-07-28T15:00:00.000Z');
    expect(isContractExpiryNoticeDismissed(sub, {
      acknowledged_ended_at: sub.ended_at,
      dismissed_until: sub.ended_at,
    }, NOW)).toBe(true);
  });

  it('invalidates the dismissal when the contract end date changes', () => {
    const sub = subscription('2026-08-28T15:00:00.000Z');
    expect(isContractExpiryNoticeDismissed(sub, {
      acknowledged_ended_at: '2026-07-28T15:00:00.000Z',
      dismissed_until: '2026-07-28T15:00:00.000Z',
    }, NOW)).toBe(false);
  });
});
