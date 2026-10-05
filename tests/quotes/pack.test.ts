import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { z } from 'zod';
import {
  DEFAULT_CONTINGENCY_BPS,
  DEFAULT_OVERHEAD_PROFIT_BPS,
  assembleQuoteLines,
  defineQuotePack,
  percentOfCents,
  type EstimateLineItem,
  type Quote,
  type QuoteResult,
  type QuoteTotals,
  type RateCard,
  type ResolvedRate,
  type ScopedLine,
} from '../../src/quotes';

// --- A tiny example pack (tests only) ----------------------------------------

const RATED_AT = 1_760_000_000_000;
const GENERATED_AT = 1_760_000_500_000;

const floorCard: RateCard = {
  id: 'floor-coating-tampa',
  version: '2026-10-01',
  currency: 'usd',
  region: 'US-FL-Tampa',
  ratedAt: RATED_AT,
  rates: {
    'labor:floor-prep': { kind: 'labor', unit: 'square-foot', unitCents: 125 },
    'labor:coat-application': { kind: 'labor', unit: 'square-foot', unitCents: 90 },
    'material:epoxy-kit': { kind: 'material', unit: 'gallon', unitCents: 6_450 },
    'material:crack-filler': { kind: 'material', unit: 'linear-foot', unitCents: 333 },
  },
};

const floorScope = z.object({
  areaSqFt: z.number().positive().optional(),
  coats: z.number().int().min(1).max(4).default(2),
  crackRepairLf: z.number().min(0).default(0),
});
type FloorScope = z.infer<typeof floorScope>;

const SQFT_PER_GALLON_PER_COAT = 160;

const floorPack = defineQuotePack<FloorScope>({
  id: 'floor-coating',
  scopeSchema: floorScope,
  rateCard: floorCard,
  needsInfo: (s) => (s.areaSqFt === undefined ? [{ field: 'areaSqFt', question: 'How many square feet is the floor?' }] : []),
  bounds: (s) => ((s.areaSqFt ?? 0) > 50_000 ? ['area over 50,000 sq ft needs a site visit'] : []),
  takeoff: (s) => {
    const area = s.areaSqFt ?? 0;
    return [
      { kind: 'labor', lineType: 'labor:floor-prep', label: 'Grind and prep', quantity: area, unit: 'square-foot' },
      { kind: 'labor', lineType: 'labor:coat-application', label: 'Apply coats', quantity: area * s.coats, unit: 'square-foot' },
      {
        kind: 'material',
        lineType: 'material:epoxy-kit',
        label: 'Epoxy kit',
        quantity: Math.ceil((area * s.coats) / SQFT_PER_GALLON_PER_COAT),
        unit: 'gallon',
      },
      { kind: 'material', lineType: 'material:crack-filler', label: 'Crack repair', quantity: s.crackRepairLf, unit: 'linear-foot' },
    ];
  },
});

const price = (scope: unknown, opts: Partial<Parameters<typeof floorPack.price>[2]> = {}): QuoteResult =>
  floorPack.price(scope, floorPack.rateCard, { generatedAt: GENERATED_AT, ...opts });

function priced(result: QuoteResult): Quote {
  if (result.status !== 'priced') throw new Error(`expected priced, got ${JSON.stringify(result)}`);
  return result.quote;
}

// --- Invariants every quote must satisfy ------------------------------------

const sum = (lines: EstimateLineItem[], kind?: EstimateLineItem['kind']): number =>
  lines.filter((l) => !kind || l.kind === kind).reduce((acc, l) => acc + l.totalCents, 0);

function expectInvariants(t: QuoteTotals): void {
  expect(t.amountCents).toBe(sum(t.lineItems));
  expect(t.laborCents).toBe(sum(t.lineItems, 'labor'));
  expect(t.materialsCents).toBe(sum(t.lineItems, 'material'));
  expect(t.markupCents).toBe(sum(t.lineItems, 'markup'));
  expect(t.amountCents).toBe(t.laborCents + t.materialsCents + t.markupCents);
  for (const l of [t.amountCents, ...t.lineItems.flatMap((x) => [x.totalCents, x.unitCents])]) {
    expect(Number.isInteger(l)).toBe(true);
    expect(l).toBeGreaterThanOrEqual(0);
  }
}

// --- Arbitraries -------------------------------------------------------------

const lineArb = fc.record({
  kind: fc.constantFrom('labor' as const, 'material' as const),
  quantity: fc.integer({ min: 0, max: 100_000 }).map((n) => n / 100), // hundredths, like 1.25 hours
  unitCents: fc.integer({ min: 0, max: 5_000_000 }),
});
const bpsArb = fc.integer({ min: 0, max: 10_000 });

function assemble(
  raw: { kind: 'labor' | 'material'; quantity: number; unitCents: number }[],
  overheadProfitBps: number,
  contingencyBps: number,
): QuoteTotals {
  const scoped: ScopedLine[] = raw.map((r, i) => ({
    kind: r.kind,
    lineType: `${r.kind}:l${i}`,
    label: `Line ${i}`,
    quantity: r.quantity,
    unit: r.kind === 'labor' ? 'hour' : 'each',
  }));
  const rates = new Map<string, ResolvedRate>(
    raw.map((r, i) => [`${r.kind}:l${i}`, { unitCents: r.unitCents, provenance: { source: 'rate-card', region: 'r', ratedAt: RATED_AT } }]),
  );
  return assembleQuoteLines(scoped, rates, { region: 'r', generatedAt: GENERATED_AT, overheadProfitBps, contingencyBps });
}

describe('assembleQuoteLines — properties', () => {
  it('totals equal the sum of the lines, in whole non-negative cents', () => {
    fc.assert(
      fc.property(fc.array(lineArb, { maxLength: 30 }), bpsArb, bpsArb, (lines, op, ct) => {
        expectInvariants(assemble(lines, op, ct));
      }),
    );
  });

  it('is monotonic in quantity: raising any one line never lowers the total', () => {
    fc.assert(
      fc.property(
        fc.array(lineArb, { minLength: 1, maxLength: 20 }),
        fc.nat(),
        fc.integer({ min: 0, max: 100_000 }).map((n) => n / 100),
        bpsArb,
        bpsArb,
        (lines, pick, delta, op, ct) => {
          const i = pick % lines.length;
          const bigger = lines.map((l, j) => (j === i ? { ...l, quantity: l.quantity + delta } : l));
          expect(assemble(bigger, op, ct).amountCents).toBeGreaterThanOrEqual(assemble(lines, op, ct).amountCents);
        },
      ),
    );
  });

  it('is deterministic: the same input gives the same output', () => {
    fc.assert(
      fc.property(fc.array(lineArb, { maxLength: 20 }), bpsArb, bpsArb, (lines, op, ct) => {
        expect(assemble(structuredClone(lines), op, ct)).toEqual(assemble(lines, op, ct));
      }),
    );
  });
});

const areaArb = fc.integer({ min: 1, max: 50_000 });
const coatsArb = fc.integer({ min: 1, max: 4 });
const crackArb = fc.integer({ min: 0, max: 2_000 });

describe('quote pack — properties over the example floor-coating pack', () => {
  it('every priced quote satisfies the invariants', () => {
    fc.assert(
      fc.property(areaArb, coatsArb, crackArb, (areaSqFt, coats, crackRepairLf) => {
        expectInvariants(priced(price({ areaSqFt, coats, crackRepairLf })));
      }),
    );
  });

  it('is monotonic in area and in crack-repair length', () => {
    fc.assert(
      fc.property(areaArb, areaArb, coatsArb, crackArb, crackArb, (a, b, coats, c1, c2) => {
        const lo = priced(price({ areaSqFt: Math.min(a, b), coats, crackRepairLf: Math.min(c1, c2) }));
        const hi = priced(price({ areaSqFt: Math.max(a, b), coats, crackRepairLf: Math.max(c1, c2) }));
        expect(hi.amountCents).toBeGreaterThanOrEqual(lo.amountCents);
      }),
    );
  });

  it('is deterministic', () => {
    fc.assert(
      fc.property(areaArb, coatsArb, crackArb, (areaSqFt, coats, crackRepairLf) => {
        expect(price({ areaSqFt, coats, crackRepairLf })).toEqual(price({ areaSqFt, coats, crackRepairLf }));
      }),
    );
  });
});

describe('quote pack — behaviour', () => {
  it('prices a known scope to the cent with rate-card provenance on every line', () => {
    const q = priced(price({ areaSqFt: 400, coats: 2, crackRepairLf: 12 }));
    // prep 400×125 + coats 800×90 = 50,000 + 72,000
    expect(q.laborCents).toBe(122_000);
    // epoxy ceil(800/160)=5 gal × 6,450 + cracks 12×333
    expect(q.materialsCents).toBe(32_250 + 3_996);
    const base = 122_000 + 36_246;
    expect(q.markupCents).toBe(percentOfCents(base, DEFAULT_OVERHEAD_PROFIT_BPS) + percentOfCents(base, DEFAULT_CONTINGENCY_BPS));
    expect(q.amountCents).toBe(base + q.markupCents);
    expect(q).toMatchObject({ packId: 'floor-coating', rateCardId: 'floor-coating-tampa', rateCardVersion: '2026-10-01', region: 'US-FL-Tampa' });
    for (const l of q.lineItems) {
      expect(l.provenance.source).toBe(l.kind === 'markup' ? 'derived' : 'rate-card');
    }
    expect(q.rateSources.sort()).toEqual(['derived', 'rate-card']);
  });

  it('refuses to price when a required field is missing (needs-info, never guessed)', () => {
    expect(price({ coats: 2 })).toEqual({
      status: 'needs-info',
      missing: [{ field: 'areaSqFt', question: 'How many square feet is the floor?' }],
    });
    expect(floorPack.needsInfo(floorScope.parse({}))).toHaveLength(1);
  });

  it('rejects a scope that fails the schema', () => {
    const r = price({ areaSqFt: -5 });
    expect(r.status).toBe('invalid-scope');
    if (r.status === 'invalid-scope') expect(r.issues[0]).toMatch(/^areaSqFt:/);
  });

  it('rejects a scope outside the pack bounds', () => {
    expect(price({ areaSqFt: 60_000 })).toEqual({ status: 'rejected', reasons: ['area over 50,000 sq ft needs a site visit'] });
  });

  it('rejects when the rate card cannot price a takeoff line', () => {
    const { ['material:epoxy-kit']: _gone, ...rest } = floorCard.rates;
    const r = floorPack.price({ areaSqFt: 100 }, { ...floorCard, rates: rest }, { generatedAt: GENERATED_AT });
    expect(r).toEqual({ status: 'rejected', reasons: ['rate card floor-coating-tampa@2026-10-01 has no rate for material:epoxy-kit'] });
  });

  it('applies an override with override provenance, and omits zero-quantity lines', () => {
    const q = priced(price({ areaSqFt: 100 }, { overrides: [{ lineType: 'labor:floor-prep', unitCents: 150 }] }));
    const prep = q.lineItems.find((l) => l.label === 'Grind and prep');
    expect(prep).toMatchObject({ unitCents: 150, totalCents: 15_000, provenance: { source: 'override' } });
    expect(q.lineItems.some((l) => l.label === 'Crack repair')).toBe(false);
  });

  it('honours caller markup bps, clamped to [0, 10000]', () => {
    const q = priced(price({ areaSqFt: 100 }, { overheadProfitBps: 0, contingencyBps: 0 }));
    expect(q.markupCents).toBe(0);
    expect(q.lineItems.every((l) => l.kind !== 'markup')).toBe(true);
  });
});

// --- Field compatibility with dispatch ProposalLineItem (dispatch types.ts) --
// Copied shape; `npx tsc --noEmit` over this file fails if a quote line stops
// being assignable to it.
interface ProposalLineItem {
  id: string;
  kind: 'labor' | 'material' | 'markup';
  label: string;
  quantity: number;
  unitCents: number;
  totalCents: number;
  purchaseRequestId?: string;
  percentBps?: number;
}

describe('ProposalLineItem compatibility', () => {
  it('a quote line is assignable to dispatch ProposalLineItem', () => {
    const lines: ProposalLineItem[] = priced(price({ areaSqFt: 10 })).lineItems;
    expect(lines.length).toBeGreaterThan(0);
  });
});
