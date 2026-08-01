import { describe, expect, it } from 'vitest';
import {
  AGREEMENT_BILLING_MODES,
  applyPrepayDrawdown,
  assertMinorAmount,
  buildAgreementTransition,
  prepayBalanceSummary,
  proratePeriod,
  validateTerms,
  visitBilling,
  type AgreementTerms,
} from '../../src/billing';

describe('assertMinorAmount', () => {
  it('accepts non-negative integers and returns them', () => {
    expect(assertMinorAmount(0, 'x')).toBe(0);
    expect(assertMinorAmount(4500, 'x')).toBe(4500);
  });

  it('rejects fractional, negative and non-finite amounts', () => {
    for (const bad of [1.5, -1, NaN, Infinity]) {
      expect(() => assertMinorAmount(bad, 'amountPerVisitMinor')).toThrow(
        /amountPerVisitMinor must be a non-negative integer/,
      );
    }
  });
});

describe('validateTerms', () => {
  it('returns the terms for each valid mode', () => {
    const terms: AgreementTerms[] = [
      { mode: 'per_visit', amountPerVisitMinor: 5000 },
      { mode: 'flat_monthly', amountPerMonthMinor: 20000 },
      { mode: 'seasonal_prepay', prepaidTotalMinor: 120000, drawPerVisitMinor: 5000 },
    ];
    for (const t of terms) expect(validateTerms(t)).toBe(t);
  });

  it('rejects a bad amount inside otherwise-valid terms', () => {
    expect(() =>
      validateTerms({ mode: 'seasonal_prepay', prepaidTotalMinor: 120000, drawPerVisitMinor: -1 }),
    ).toThrow(/drawPerVisitMinor/);
  });

  it('rejects an unknown mode', () => {
    expect(() => validateTerms({ mode: 'annual' } as unknown as AgreementTerms)).toThrow(
      /unknown billing mode/,
    );
  });

  it('lists exactly the three modes', () => {
    expect([...AGREEMENT_BILLING_MODES]).toEqual(['per_visit', 'flat_monthly', 'seasonal_prepay']);
  });
});

describe('visitBilling', () => {
  it('charges the visit amount for per-visit terms', () => {
    expect(visitBilling({ mode: 'per_visit', amountPerVisitMinor: 5000 })).toEqual({
      chargeNowMinor: 5000,
      drawFromBalanceMinor: 0,
    });
  });

  it('charges nothing at the door for flat-monthly terms', () => {
    expect(visitBilling({ mode: 'flat_monthly', amountPerMonthMinor: 20000 })).toEqual({
      chargeNowMinor: 0,
      drawFromBalanceMinor: 0,
    });
  });

  it('draws from the balance for seasonal-prepay terms', () => {
    expect(
      visitBilling({ mode: 'seasonal_prepay', prepaidTotalMinor: 120000, drawPerVisitMinor: 5000 }),
    ).toEqual({ chargeNowMinor: 0, drawFromBalanceMinor: 5000 });
  });
});

describe('applyPrepayDrawdown', () => {
  it('draws the full visit cost when the balance covers it', () => {
    expect(applyPrepayDrawdown(120000, 5000)).toEqual({
      drawnMinor: 5000,
      remainingMinor: 115000,
      shortfallMinor: 0,
    });
  });

  it('clamps the draw and reports a shortfall when the balance is exhausted', () => {
    // Season down to its last $30; a $50 visit lands.
    expect(applyPrepayDrawdown(3000, 5000)).toEqual({
      drawnMinor: 3000,
      remainingMinor: 0,
      shortfallMinor: 2000,
    });
  });

  it('never goes negative on an empty balance', () => {
    expect(applyPrepayDrawdown(0, 5000)).toEqual({
      drawnMinor: 0,
      remainingMinor: 0,
      shortfallMinor: 5000,
    });
  });

  it('rejects fractional inputs', () => {
    expect(() => applyPrepayDrawdown(100.5, 5000)).toThrow(/remainingBalanceMinor/);
  });
});

describe('prepayBalanceSummary', () => {
  it('sums draws and computes the remaining balance and percent', () => {
    expect(prepayBalanceSummary(120000, [5000, 5000, 5000])).toEqual({
      prepaidTotalMinor: 120000,
      consumedMinor: 15000,
      remainingMinor: 105000,
      consumedPct: 13,
    });
  });

  it('reports a fresh season as zero-consumed', () => {
    expect(prepayBalanceSummary(120000, [])).toEqual({
      prepaidTotalMinor: 120000,
      consumedMinor: 0,
      remainingMinor: 120000,
      consumedPct: 0,
    });
  });

  it('clamps an over-drawn ledger to a fully-spent season', () => {
    const s = prepayBalanceSummary(10000, [7000, 7000]);
    expect(s.consumedMinor).toBe(10000);
    expect(s.remainingMinor).toBe(0);
    expect(s.consumedPct).toBe(100);
  });

  it('reads a zero-total season as fully consumed', () => {
    expect(prepayBalanceSummary(0, []).consumedPct).toBe(100);
  });
});

describe('proratePeriod', () => {
  it('earned + unearned always re-sums to the full period amount', () => {
    for (const elapsed of [0, 1, 7, 15, 29, 30]) {
      const { earnedMinor, unearnedMinor } = proratePeriod({
        periodAmountMinor: 20000,
        periodDays: 30,
        elapsedDays: elapsed,
      });
      expect(earnedMinor + unearnedMinor).toBe(20000);
    }
  });

  it('earns nothing at day zero and everything at period end', () => {
    expect(proratePeriod({ periodAmountMinor: 20000, periodDays: 30, elapsedDays: 0 })).toEqual({
      earnedMinor: 0,
      unearnedMinor: 20000,
    });
    expect(proratePeriod({ periodAmountMinor: 20000, periodDays: 30, elapsedDays: 30 })).toEqual({
      earnedMinor: 20000,
      unearnedMinor: 0,
    });
  });

  it('prorates a mid-period switch — half a month owes half, no double charge', () => {
    expect(proratePeriod({ periodAmountMinor: 20000, periodDays: 30, elapsedDays: 15 })).toEqual({
      earnedMinor: 10000,
      unearnedMinor: 10000,
    });
  });

  it('clamps elapsed days beyond the period to the full period', () => {
    expect(proratePeriod({ periodAmountMinor: 20000, periodDays: 30, elapsedDays: 45 })).toEqual({
      earnedMinor: 20000,
      unearnedMinor: 0,
    });
  });

  it('rejects a non-positive period', () => {
    expect(() => proratePeriod({ periodAmountMinor: 20000, periodDays: 0, elapsedDays: 0 })).toThrow(
      /periodDays must be a positive integer/,
    );
  });
});

describe('buildAgreementTransition', () => {
  const at = '2026-07-31T12:00:00Z';
  const per: AgreementTerms = { mode: 'per_visit', amountPerVisitMinor: 5000 };
  const flat: AgreementTerms = { mode: 'flat_monthly', amountPerMonthMinor: 20000 };

  it('records an initial enrolment with a null from', () => {
    const t = buildAgreementTransition({ at, from: null, to: per, reason: 'enrol', netAdjustmentMinor: 0 });
    expect(t.from).toBeNull();
    expect(t.to).toEqual(per);
  });

  it('carries a signed net adjustment (credit is negative)', () => {
    const t = buildAgreementTransition({
      at,
      from: flat,
      to: per,
      reason: 'downgrade mid-month, credit unearned',
      netAdjustmentMinor: -10000,
    });
    expect(t.netAdjustmentMinor).toBe(-10000);
  });

  it('validates the terms it stores', () => {
    expect(() =>
      buildAgreementTransition({
        at,
        from: null,
        to: { mode: 'per_visit', amountPerVisitMinor: -5 },
        reason: 'x',
        netAdjustmentMinor: 0,
      }),
    ).toThrow(/amountPerVisitMinor/);
  });

  it('rejects a non-UTC instant', () => {
    expect(() =>
      buildAgreementTransition({ at: '2026-07-31 12:00', from: null, to: per, reason: 'x', netAdjustmentMinor: 0 }),
    ).toThrow(/UTC ISO-8601/);
  });

  it('rejects an empty reason', () => {
    expect(() =>
      buildAgreementTransition({ at, from: null, to: per, reason: '   ', netAdjustmentMinor: 0 }),
    ).toThrow(/non-empty reason/);
  });

  it('rejects a fractional net adjustment', () => {
    expect(() =>
      buildAgreementTransition({ at, from: null, to: per, reason: 'x', netAdjustmentMinor: 1.5 }),
    ).toThrow(/netAdjustmentMinor must be an integer/);
  });
});

describe('end-to-end: a landscaper runs two customers a full cycle', () => {
  it('flat monthly bills the same each month regardless of visit count', () => {
    const terms: AgreementTerms = { mode: 'flat_monthly', amountPerMonthMinor: 20000 };
    // Four visits in a busy month, one in a slow month: the door charge is zero both times.
    const busy = [0, 0, 0, 0].map(() => visitBilling(terms).chargeNowMinor);
    const slow = [0].map(() => visitBilling(terms).chargeNowMinor);
    expect(busy.reduce((a, b) => a + b, 0)).toBe(0);
    expect(slow.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('seasonal prepay draws each visit down to an exact zero balance', () => {
    const terms = { mode: 'seasonal_prepay', prepaidTotalMinor: 25000, drawPerVisitMinor: 5000 } as const;
    let remaining: number = terms.prepaidTotalMinor;
    const drawn: number[] = [];
    for (let visit = 0; visit < 5; visit += 1) {
      const r = applyPrepayDrawdown(remaining, visitBilling(terms).drawFromBalanceMinor);
      remaining = r.remainingMinor;
      drawn.push(r.drawnMinor);
      expect(r.shortfallMinor).toBe(0);
    }
    expect(remaining).toBe(0);
    expect(prepayBalanceSummary(terms.prepaidTotalMinor, drawn)).toEqual({
      prepaidTotalMinor: 25000,
      consumedMinor: 25000,
      remainingMinor: 0,
      consumedPct: 100,
    });
  });
});
