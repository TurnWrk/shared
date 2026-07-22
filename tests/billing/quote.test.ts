import { describe, expect, it } from 'vitest';
import {
  SUITE_MONTHLY_MINIMUM_CENTS,
  SUITE_PLANS,
  SUITE_TRIAL_DAYS,
  quoteSuiteSubscription,
  resolveVolumeDiscountPct,
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
  it('prices headline bundle at $7.40/unit before discounts', () => {
    const q = quoteSuiteSubscription({ planSku: 'bundle', unitCount: 1 });
    expect(q.listSubtotalCents).toBe(740);
    expect(q.volumeDiscountPct).toBe(0);
    expect(q.minimumTopUpCents).toBe(SUITE_MONTHLY_MINIMUM_CENTS - 740);
    expect(q.amountDueCents).toBe(SUITE_MONTHLY_MINIMUM_CENTS);
  });

  it('applies 10% volume discount at 25 units and skips minimum', () => {
    const q = quoteSuiteSubscription({ planSku: 'bundle', unitCount: 25 });
    expect(q.listSubtotalCents).toBe(740 * 25);
    expect(q.volumeDiscountPct).toBe(10);
    expect(q.volumeCouponId).toBe(suiteVolumeCouponId(10));
    expect(q.volumeDiscountCents).toBe(Math.round(740 * 25 * 0.1));
    expect(q.discountedSubtotalCents).toBe(740 * 25 - q.volumeDiscountCents);
    expect(q.minimumTopUpCents).toBe(0);
    expect(q.amountDueCents).toBe(q.discountedSubtotalCents);
  });

  it('adds Clean add-on line at same unit count', () => {
    const q = quoteSuiteSubscription({
      planSku: 'dispatch',
      unitCount: 5,
      includeCleanAddon: true,
    });
    expect(q.lines).toHaveLength(2);
    expect(q.lines[0]?.sku).toBe('dispatch');
    expect(q.lines[1]?.sku).toBe('clean_addon');
    expect(q.listSubtotalCents).toBe((600 + 400) * 5);
  });

  it('rejects invalid unit counts', () => {
    expect(() => quoteSuiteSubscription({ planSku: 'restock', unitCount: 0 })).toThrow(
      /unitCount/,
    );
  });
});

describe('suite catalog constants', () => {
  it('locks commercial terms', () => {
    expect(SUITE_PLANS.dispatch.unitAmountCents).toBe(600);
    expect(SUITE_PLANS.restock.unitAmountCents).toBe(300);
    expect(SUITE_PLANS.bundle.unitAmountCents).toBe(740);
    expect(SUITE_PLANS.clean_addon.unitAmountCents).toBe(400);
    expect(SUITE_MONTHLY_MINIMUM_CENTS).toBe(2700);
    expect(SUITE_TRIAL_DAYS).toBe(45);
  });

  it('emits volume coupon specs for Stripe setup', () => {
    const specs = suiteVolumeCouponSpecs();
    expect(specs.map((s) => s.id)).toEqual([
      'suite_vol_5',
      'suite_vol_10',
      'suite_vol_15',
      'suite_vol_20',
      'suite_vol_25',
    ]);
  });
});
