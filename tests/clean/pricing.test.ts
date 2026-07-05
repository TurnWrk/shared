import { describe, it, expect } from 'vitest';
import {
  priceCleanQuote,
  splitAllocatedMinutes,
  CleanQuoteError,
} from '../../src/clean/pricing';
import type { CleanCatalog, CleanQuoteSelection } from '../../src/types/clean';

const catalog: CleanCatalog = {
  orgId: 'org1',
  services: [
    {
      id: 'svc-std',
      name: 'Standard Clean',
      basePriceMinor: 10000, // $100
      baseMinutes: 60,
      mode: 'residential',
      active: true,
      params: [
        { id: 'p-bed', label: 'Bedrooms', unitPriceMinor: 2500, unitMinutes: 30, min: 1, max: 6, sort: 0 },
        { id: 'p-bath', label: 'Full Baths', unitPriceMinor: 3000, unitMinutes: 45, min: 1, max: 4, sort: 1 },
      ],
      extraIds: ['x-oven', 'x-carpet'],
    },
    {
      id: 'svc-off',
      name: 'Retired Service',
      basePriceMinor: 5000,
      baseMinutes: 30,
      mode: 'both',
      active: false,
      params: [],
      extraIds: [],
    },
  ],
  extras: [
    { id: 'x-oven', label: 'Inside oven', priceMinor: 3500, minutes: 30, qtyEnabled: false },
    { id: 'x-carpet', label: 'Carpet cleaning', priceMinor: 2000, minutes: 20, qtyEnabled: true },
  ],
  frequencies: [
    { key: 'once', widgetLabel: 'One-time', discountPct: 0 },
    { key: 'weekly', widgetLabel: 'Weekly', discountPct: 25 },
  ],
  discountCodes: { SAVE10: { pct: 10, active: true }, DEAD: { pct: 50, active: false } },
  updatedAt: 0,
};

const ctx = { taxPct: 10, currency: 'USD' };

const selection = (over: Partial<CleanQuoteSelection> = {}): CleanQuoteSelection => ({
  serviceId: 'svc-std',
  frequencyKey: 'once',
  params: [{ id: 'p-bed', qty: 3 }, { id: 'p-bath', qty: 2 }],
  extras: [],
  ...over,
});

describe('priceCleanQuote', () => {
  it('prices base + params + extras with tax', () => {
    const q = priceCleanQuote(catalog, selection({
      extras: [{ id: 'x-oven', qty: 1 }, { id: 'x-carpet', qty: 3 }],
    }), ctx);
    // 10000 + 3×2500 + 2×3000 + 3500 + 3×2000 = 33000
    expect(q.pricing.subtotalMinor).toBe(33000);
    expect(q.pricing.discountMinor).toBe(0);
    expect(q.pricing.taxMinor).toBe(3300);
    expect(q.pricing.totalMinor).toBe(36300);
    // 60 + 3×30 + 2×45 + 30 + 3×20 = 330
    expect(q.estMinutes).toBe(330);
    expect(q.serviceLabel).toBe('Standard Clean');
  });

  it('applies frequency discount before tax', () => {
    const q = priceCleanQuote(catalog, selection({ frequencyKey: 'weekly' }), ctx);
    // subtotal 10000 + 7500 + 6000 = 23500; 25% = 5875; tax 10% of 17625 = 1763 (rounded)
    expect(q.pricing.subtotalMinor).toBe(23500);
    expect(q.pricing.discountMinor).toBe(5875);
    expect(q.pricing.taxMinor).toBe(1763);
    expect(q.pricing.totalMinor).toBe(23500 - 5875 + 1763);
  });

  it('stacks discount codes with the frequency discount, capped at subtotal', () => {
    const q = priceCleanQuote(
      catalog,
      selection({ frequencyKey: 'weekly', discountCode: 'save10' }), // case-insensitive
      ctx,
    );
    expect(q.pricing.discountMinor).toBe(5875 + 2350);
  });

  it('clamps param quantities to catalog min/max and defaults omitted params to min', () => {
    const q = priceCleanQuote(catalog, selection({ params: [{ id: 'p-bed', qty: 99 }] }), ctx);
    const bed = q.paramsSnapshot.find((p) => p.paramId === 'p-bed')!;
    const bath = q.paramsSnapshot.find((p) => p.paramId === 'p-bath')!;
    expect(bed.qty).toBe(6); // clamped to max
    expect(bath.qty).toBe(1); // defaulted to min
  });

  it('forces qty 1 on non-qty extras and drops qty-0 selections', () => {
    const q = priceCleanQuote(catalog, selection({
      extras: [{ id: 'x-oven', qty: 5 }, { id: 'x-carpet', qty: 0 }],
    }), ctx);
    expect(q.extrasSnapshot).toHaveLength(1);
    expect(q.extrasSnapshot[0].qty).toBe(1);
  });

  it('rejects unknown/inactive services, foreign extras, and bad codes', () => {
    expect(() => priceCleanQuote(catalog, selection({ serviceId: 'nope' }), ctx))
      .toThrowError(CleanQuoteError);
    expect(() => priceCleanQuote(catalog, selection({ serviceId: 'svc-off' }), ctx))
      .toThrow(/inactive/i);
    expect(() => priceCleanQuote(catalog, selection({ extras: [{ id: 'ghost', qty: 1 }] }), ctx))
      .toThrow(/not offered/i);
    expect(() => priceCleanQuote(catalog, selection({ discountCode: 'DEAD' }), ctx))
      .toThrow(/not valid/i);
  });
});

describe('splitAllocatedMinutes', () => {
  it('splits evenly and distributes remainder to earliest slots', () => {
    expect(splitAllocatedMinutes(480, 2)).toEqual([240, 240]);
    expect(splitAllocatedMinutes(100, 3)).toEqual([34, 33, 33]);
    expect(splitAllocatedMinutes(0, 2)).toEqual([0, 0]);
    expect(splitAllocatedMinutes(90, 0)).toEqual([]);
  });

  it('always sums to the input', () => {
    for (const [total, n] of [[481, 2], [59, 4], [1, 3]] as const) {
      const parts = splitAllocatedMinutes(total, n);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
});
