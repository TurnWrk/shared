import { describe, expect, it } from 'vitest';
import {
  SUITE_PRO_TRIAL_DAYS,
  SUITE_USAGE_MODEL,
  deriveAiActionsFromGmv,
  quoteSuiteUsage,
  quoteSuiteUsageFromGmv,
  suiteProBreakevenGmvCents,
} from '../../src/billing';

const usd = (dollars: number) => dollars * 100;

describe('suite usage model constants', () => {
  it('locks the v2 commercial terms', () => {
    expect(SUITE_USAGE_MODEL.freePaymentRateBps).toBe(100); // 1.00%
    expect(SUITE_USAGE_MODEL.proPaymentRateBps).toBe(60); // 0.60%
    expect(SUITE_USAGE_MODEL.proMonthlyFeeCents).toBe(9_900);
    expect(SUITE_USAGE_MODEL.freeIncludedAiCredits).toBe(15);
    expect(SUITE_USAGE_MODEL.proIncludedAiCredits).toBe(75);
    expect(SUITE_USAGE_MODEL.aiCreditOverageCents).toBe(400);
    expect(SUITE_USAGE_MODEL.restockAffiliateRateBps).toBe(300);
    expect(SUITE_USAGE_MODEL.aiActionsPer1kGmv).toBe(1.2);
    expect(SUITE_PRO_TRIAL_DAYS).toBe(45);
  });
});

describe('suiteProBreakevenGmvCents', () => {
  it('is $24,750 — fee / (freeRate − proRate)', () => {
    expect(suiteProBreakevenGmvCents()).toBe(usd(24_750));
  });
});

describe('deriveAiActionsFromGmv', () => {
  it('derives 1.2 actions per $1,000 of GMV, rounded', () => {
    expect(deriveAiActionsFromGmv(usd(3_000))).toBe(4); // 3.6 → 4
    expect(deriveAiActionsFromGmv(usd(12_000))).toBe(14); // 14.4 → 14
    expect(deriveAiActionsFromGmv(usd(25_000))).toBe(30);
    expect(deriveAiActionsFromGmv(usd(50_000))).toBe(60);
    expect(deriveAiActionsFromGmv(usd(180_000))).toBe(216);
  });

  it('is 0 for zero / negative GMV', () => {
    expect(deriveAiActionsFromGmv(0)).toBe(0);
    expect(deriveAiActionsFromGmv(-500)).toBe(0);
  });
});

describe('quoteSuiteUsage — acceptance table (Dev_Prompt_Pricing_v2 §5)', () => {
  const rows = [
    { gmv: 3_000, ai: 4, free: 30, pro: 117, recommends: 'free', shown: 30 },
    { gmv: 12_000, ai: 14, free: 120, pro: 171, recommends: 'free', shown: 120 },
    { gmv: 25_000, ai: 30, free: 310, pro: 249, recommends: 'pro', shown: 249 },
    { gmv: 50_000, ai: 60, free: 680, pro: 399, recommends: 'pro', shown: 399 },
    {
      gmv: 180_000,
      ai: 216,
      free: 2_604,
      pro: 1_743,
      recommends: 'pro',
      shown: 1_743,
    },
  ] as const;

  for (const row of rows) {
    it(`$${row.gmv.toLocaleString()} GMV → free $${row.free} / pro $${row.pro} → ${row.recommends}`, () => {
      const q = quoteSuiteUsage({ gmvCents: usd(row.gmv), aiActions: row.ai });
      expect(q.free.totalCents).toBe(usd(row.free));
      expect(q.pro.totalCents).toBe(usd(row.pro));
      expect(q.recommended).toBe(row.recommends);
      expect(q.recommendedTotalCents).toBe(usd(row.shown));
      expect(q.savingsCents).toBe(Math.abs(usd(row.free) - usd(row.pro)));
    });
  }

  it('derives the same table from GMV alone', () => {
    for (const row of rows) {
      const q = quoteSuiteUsageFromGmv(usd(row.gmv));
      expect(q.aiActions).toBe(row.ai);
      expect(q.recommendedTotalCents).toBe(usd(row.shown));
    }
  });

  it('reports effective rates matching the published table', () => {
    // bps of the recommended bill against GMV
    expect(quoteSuiteUsageFromGmv(usd(3_000)).effectiveRateBps).toBe(100); // 1.00%
    expect(quoteSuiteUsageFromGmv(usd(12_000)).effectiveRateBps).toBe(100); // 1.00%
    expect(quoteSuiteUsageFromGmv(usd(25_000)).effectiveRateBps).toBe(100); // 0.996% → 1.00%
    expect(quoteSuiteUsageFromGmv(usd(50_000)).effectiveRateBps).toBe(80); // 0.80%
    expect(quoteSuiteUsageFromGmv(usd(180_000)).effectiveRateBps).toBe(97); // 0.97%
  });
});

describe('quoteSuiteUsage — itemization', () => {
  it('splits the $25,000 worked example into its lines', () => {
    const q = quoteSuiteUsage({ gmvCents: usd(25_000), aiActions: 30 });

    // free = 25000×0.010 + (30−15)×4 = 250 + 60
    expect(q.free.membershipCents).toBe(0);
    expect(q.free.paymentCents).toBe(usd(250));
    expect(q.free.aiOverageCents).toBe(usd(60));

    // pro = 99 + 25000×0.006 + max(0, 30−75)×4 = 99 + 150 + 0
    expect(q.pro.membershipCents).toBe(usd(99));
    expect(q.pro.paymentCents).toBe(usd(150));
    expect(q.pro.aiOverageCents).toBe(0);

    expect(q.recommended).toBe('pro');
    expect(q.savingsCents).toBe(usd(61));
  });

  it('never charges AI overage below the included allotment', () => {
    const q = quoteSuiteUsage({ gmvCents: usd(10_000), aiActions: 15 });
    expect(q.free.aiOverageCents).toBe(0);
    expect(q.pro.aiOverageCents).toBe(0);
  });

  it('can flip to Pro below the payments break-even when AI usage is heavy', () => {
    // $20k GMV is under $24,750, but 200 AI actions swamps Free's 15 credits.
    const q = quoteSuiteUsage({ gmvCents: usd(20_000), aiActions: 200 });
    expect(q.gmvCents).toBeLessThan(suiteProBreakevenGmvCents());
    expect(q.recommended).toBe('pro');
  });
});

describe('quoteSuiteUsage — guards', () => {
  it('is safe at zero GMV with no usage', () => {
    const q = quoteSuiteUsage({ gmvCents: 0, aiActions: 0 });
    expect(q.free.totalCents).toBe(0);
    expect(q.pro.totalCents).toBe(usd(99));
    expect(q.recommended).toBe('free');
    expect(q.recommendedTotalCents).toBe(0);
    expect(q.effectiveRateBps).toBe(0); // suppressed, never NaN/Infinity
  });

  it('clamps negative and non-finite inputs instead of throwing', () => {
    const q = quoteSuiteUsage({ gmvCents: -5_000, aiActions: -3 });
    expect(q.gmvCents).toBe(0);
    expect(q.aiActions).toBe(0);
    expect(q.free.totalCents).toBe(0);

    const nan = quoteSuiteUsage({ gmvCents: Number.NaN, aiActions: Number.NaN });
    expect(nan.recommendedTotalCents).toBe(0);
    expect(nan.effectiveRateBps).toBe(0);
  });

  it('resolves a tie to Free rather than upselling', () => {
    // Contrive equality: pro fee exactly offsets the rate spread at breakeven,
    // with AI usage inside both allotments.
    const q = quoteSuiteUsage({
      gmvCents: suiteProBreakevenGmvCents(),
      aiActions: 10,
    });
    expect(q.free.totalCents).toBe(q.pro.totalCents);
    expect(q.recommended).toBe('free');
    expect(q.savingsCents).toBe(0);
  });
});
