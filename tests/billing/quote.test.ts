import { describe, expect, it } from 'vitest';
import {
  SUITE_BUNDLE_COUPON_ID,
  SUITE_BUNDLE_DISCOUNT_PCT,
  SUITE_MONTHLY_MINIMUM_CENTS,
  SUITE_PRODUCTS,
  SUITE_TRIAL_DAYS,
  quoteSuiteFromFlags,
  quoteSuiteSubscription,
  resolveVolumeDiscountPct,
  suiteBundleCouponSpec,
  suiteCouponSpecs,
  suiteVolumeCouponId,
  suiteVolumeCouponSpecs,
} from '../../src/billing';

describe('resolveVolumeDiscountPct', () => {
  it('matches INDEX/MATCH tier table', () => {
    expect(resolveVolumeDiscountPct(1)).toBe(0);
    expect(resolveVolumeDiscountPct(9)).toBe(0);
    expect(resolveVolumeDiscountPct(10)).toBe(5);
    expect(resolveVolumeDiscountPct(24)).toBe(5);
    expect(resolveVolumeDiscountPct(25)).toBe(10);
    expect(resolveVolumeDiscountPct(50)).toBe(15);
    expect(resolveVolumeDiscountPct(150)).toBe(20);
    expect(resolveVolumeDiscountPct(250)).toBe(25);
    expect(resolveVolumeDiscountPct(999)).toBe(25);
  });
});

describe('quoteSuiteSubscription', () => {
  it('prices a single product at list with no bundle', () => {
    const q = quoteSuiteSubscription({ products: ['dispatch'], unitCount: 1 });
    expect(q.bundleApplied).toBe(false);
    expect(q.listSubtotalCents).toBe(600);
    expect(q.amountDueCents).toBe(600);
    expect(q.minimumTopUpCents).toBe(0);
    expect(q.checkoutLines).toHaveLength(1);
    expect(q.lines[0]?.sku).toBe('dispatch');
  });

  it('bundles any two products at 18% off combined list', () => {
    // Dispatch + Restock: $9 → $7.38/unit (matches old ~$7.40 headline intent)
    const q = quoteSuiteSubscription({
      products: ['dispatch', 'restock'],
      unitCount: 1,
    });
    expect(q.bundleApplied).toBe(true);
    expect(q.bundleDiscountPct).toBe(18);
    expect(q.bundleCouponId).toBe(SUITE_BUNDLE_COUPON_ID);
    expect(q.trueListSubtotalCents).toBe(900);
    expect(q.bundleDiscountCents).toBe(Math.round(900 * 0.18));
    expect(q.listSubtotalCents).toBe(900 - q.bundleDiscountCents);
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0]?.sku).toBe('bundle');
    expect(q.checkoutLines.map((l) => l.sku)).toEqual(['dispatch', 'restock']);
    expect(q.amountDueCents).toBe(q.listSubtotalCents);
  });

  it('bundles all three products and stacks volume discount', () => {
    // $13 list → 18% bundle → then 10% volume at 25 units
    const q = quoteSuiteSubscription({
      products: ['dispatch', 'restock', 'clean'],
      unitCount: 25,
    });
    expect(q.trueListSubtotalCents).toBe(1300 * 25);
    expect(q.bundleDiscountCents).toBe(Math.round(1300 * 25 * 0.18));
    expect(q.listSubtotalCents).toBe(q.trueListSubtotalCents - q.bundleDiscountCents);
    expect(q.volumeDiscountPct).toBe(10);
    expect(q.volumeCouponId).toBe(suiteVolumeCouponId(10));
    expect(q.volumeDiscountCents).toBe(Math.round(q.listSubtotalCents * 0.1));
    expect(q.amountDueCents).toBe(q.listSubtotalCents - q.volumeDiscountCents);
    expect(q.minimumTopUpCents).toBe(0);
  });

  it('allows Clean with Restock only (not only as Dispatch add-on)', () => {
    const q = quoteSuiteSubscription({
      products: ['restock', 'clean'],
      unitCount: 5,
    });
    expect(q.products).toEqual(['restock', 'clean']);
    expect(q.bundleApplied).toBe(true);
    expect(q.trueListSubtotalCents).toBe((300 + 400) * 5);
  });

  it('rejects empty products and invalid unit counts', () => {
    expect(() => quoteSuiteSubscription({ products: [], unitCount: 1 })).toThrow(
      /products/,
    );
    expect(() =>
      quoteSuiteSubscription({ products: ['restock'], unitCount: 0 }),
    ).toThrow(/unitCount/);
  });

  it('quoteSuiteFromFlags selects products', () => {
    const q = quoteSuiteFromFlags({ unitCount: 2, dispatch: true, clean: true });
    expect(q.products).toEqual(['dispatch', 'clean']);
  });
});

describe('suite catalog constants', () => {
  it('locks commercial terms (TURNWRK-217)', () => {
    expect(SUITE_PRODUCTS.dispatch.unitAmountCents).toBe(600);
    expect(SUITE_PRODUCTS.restock.unitAmountCents).toBe(300);
    expect(SUITE_PRODUCTS.clean.unitAmountCents).toBe(400);
    expect(SUITE_BUNDLE_DISCOUNT_PCT).toBe(18);
    expect(SUITE_MONTHLY_MINIMUM_CENTS).toBe(0);
    expect(SUITE_TRIAL_DAYS).toBe(45);
  });

  it('emits bundle + volume coupon specs for Stripe setup', () => {
    expect(suiteBundleCouponSpec().id).toBe(SUITE_BUNDLE_COUPON_ID);
    expect(suiteVolumeCouponSpecs().map((s) => s.id)).toEqual([
      'suite_vol_5',
      'suite_vol_10',
      'suite_vol_15',
      'suite_vol_20',
      'suite_vol_25',
    ]);
    expect(suiteCouponSpecs()[0]?.id).toBe(SUITE_BUNDLE_COUPON_ID);
  });
});
