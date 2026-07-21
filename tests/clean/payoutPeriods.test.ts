import { describe, it, expect } from 'vitest';
import {
  weekBoundsFor,
  payoutPeriodDocId,
  billableMinutes,
  timePayoutAmountMinor,
} from '../../src/clean/payoutPeriods';

describe('weekBoundsFor / payoutPeriodDocId (TURNWRK-100)', () => {
  it('returns Monday–Sunday bounds for a mid-week date', () => {
    // 2026-07-15 is a Wednesday
    expect(weekBoundsFor('2026-07-15')).toEqual({
      periodStart: '2026-07-13',
      periodEnd: '2026-07-19',
    });
  });

  it('keeps Sunday inside the prior Monday-start week', () => {
    expect(weekBoundsFor('2026-07-19')).toEqual({
      periodStart: '2026-07-13',
      periodEnd: '2026-07-19',
    });
  });

  it('builds deterministic period doc ids', () => {
    expect(payoutPeriodDocId('org1', '2026-07-13')).toBe('org1_2026-07-13');
  });
});

describe('billableMinutes / timePayoutAmountMinor (TURNWRK-100)', () => {
  it('prefers override over actual and rounds to non-negative integers', () => {
    expect(billableMinutes({ actualMinutes: 90, overrideMinutes: 60 })).toBe(60);
    expect(billableMinutes({ actualMinutes: 90 })).toBe(90);
    expect(billableMinutes({ actualMinutes: 90.4 })).toBe(90);
    expect(billableMinutes({ overrideMinutes: -5 })).toBe(0);
    expect(billableMinutes({})).toBe(0);
  });

  it('computes integer minor units from minutes × rate (Math.round)', () => {
    expect(timePayoutAmountMinor(60, 2500)).toBe(2500);
    expect(timePayoutAmountMinor(30, 2500)).toBe(1250);
    expect(timePayoutAmountMinor(0, 2500)).toBe(0);
    // 45 min @ $25.00/hr → 1875; 1 min @ $25.01/hr → 417
    expect(timePayoutAmountMinor(45, 2500)).toBe(1875);
    expect(timePayoutAmountMinor(1, 2501)).toBe(42);
  });
});
