import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  FLOOR_COATINGS_RATE_CARD,
  FLOOR_COATINGS_RATE_NOTES,
  FLOOR_PREP_TIERS,
  RESIDENTIAL_SQFT_MAX,
  RESIDENTIAL_SQFT_MIN,
  floorCoatingsPack,
  type PriceResult,
  type Quote,
} from '../../src/quotes';

const GENERATED_AT = 1_791_244_800_000;
const price = (scope: unknown, opts: Partial<Parameters<typeof floorCoatingsPack.price>[2]> = {}): PriceResult =>
  floorCoatingsPack.price(scope, floorCoatingsPack.rateCard, { generatedAt: GENERATED_AT, ...opts });

function priced(result: PriceResult): Quote {
  if (result.status !== 'priced') throw new Error(`expected priced, got ${JSON.stringify(result)}`);
  return result.quote;
}

const garage = (sqft?: number, prep?: string) => ({ type: 'garage', sqft, prep });

/**
 * Golden cases. fc-* mirror TurnWrk/turnwrk-cortex evals/quotes/floor-coatings
 * (PR #76): the scope is the case's expected scope as its recording extracted
 * it, and the total is the case's expected totalCents. sh-* are pack-only cases.
 */
const DRAFT_CASES: { id: string; scope: unknown; totalCents: number }[] = [
  { id: 'fc-001-garage-520-sqft', scope: { surfaces: [garage(520, 'standard')] }, totalCents: 416_000 },
  { id: 'fc-002-new-slab-light-prep', scope: { surfaces: [garage(450, 'light')] }, totalCents: 315_000 },
  { id: 'fc-003-heavy-prep-old-coating', scope: { surfaces: [garage(600, 'heavy')] }, totalCents: 540_000 },
  { id: 'fc-005-pool-deck-400', scope: { surfaces: [{ type: 'pool-deck', sqft: 400, prep: 'standard' }] }, totalCents: 320_000 },
  { id: 'fc-007-garage-logo-medium', scope: { surfaces: [garage(500, 'standard')], logo: { size: 'medium' } }, totalCents: 450_000 },
  // fc-009's recorded draft with the steps excluded (the steps themselves reject below).
  { id: 'fc-009-draft-without-steps', scope: { surfaces: [garage(550, 'standard')] }, totalCents: 440_000 },
  { id: 'fc-012-prompt-injection', scope: { surfaces: [garage(500, 'standard')] }, totalCents: 400_000 },
  { id: 'fc-013-no-contact-info', scope: { surfaces: [garage(580, 'standard')] }, totalCents: 464_000 },
  { id: 'sh-published-2car-low', scope: { surfaces: [garage(500, 'standard')] }, totalCents: 400_000 },
  { id: 'sh-published-2car-high', scope: { surfaces: [garage(600, 'standard')] }, totalCents: 480_000 },
  {
    id: 'sh-garage-plus-lanai',
    scope: { surfaces: [garage(520, 'standard'), { type: 'lanai', sqft: 300, prep: 'light' }] },
    totalCents: 416_000 + 210_000,
  },
  { id: 'sh-patio-heavy', scope: { surfaces: [{ type: 'patio', sqft: 250, prep: 'heavy' }] }, totalCents: 225_000 },
  { id: 'sh-driveway', scope: { surfaces: [{ type: 'driveway', sqft: 800, prep: 'standard' }] }, totalCents: 640_000 },
  { id: 'sh-logo-small', scope: { surfaces: [garage(400, 'light')], logo: { size: 'small' } }, totalCents: 280_000 + 30_000 },
  { id: 'sh-logo-large', scope: { surfaces: [garage(600, 'heavy')], logo: { size: 'large' } }, totalCents: 540_000 + 70_000 },
  { id: 'sh-crack-repair-included', scope: { surfaces: [garage(520, 'standard')], crackRepairLf: 30 }, totalCents: 416_000 },
];

const NEEDS_INFO_CASES: { id: string; scope: unknown; fields: string[] }[] = [
  { id: 'fc-004-two-car-no-sqft', scope: { surfaces: [garage()] }, fields: ['surfaces.0.sqft', 'surfaces.0.prep'] },
  { id: 'fc-006-lanai-no-size', scope: { surfaces: [{ type: 'lanai', prep: 'standard' }] }, fields: ['surfaces.0.sqft'] },
  { id: 'fc-008-logo-only-unsized', scope: { surfaces: [garage()], logo: {} }, fields: ['surfaces.0.sqft', 'surfaces.0.prep', 'logo.size'] },
  { id: 'sh-no-surfaces', scope: { surfaces: [] }, fields: ['surfaces'] },
  { id: 'sh-missing-prep-only', scope: { surfaces: [garage(520)] }, fields: ['surfaces.0.prep'] },
];

const REJECTED_CASES: { id: string; scope: unknown; reason: RegExp }[] = [
  { id: 'fc-009-garage-with-steps', scope: { surfaces: [garage(550)], steps: 3 }, reason: /no rate for labor:steps/ },
  { id: 'fc-010-heavy-slab-repair', scope: { surfaces: [garage(500)], heavySlabRepair: true }, reason: /no rate for labor:heavy-slab-repair/ },
  { id: 'fc-011-commercial-warehouse', scope: { surfaces: [{ type: 'commercial', sqft: 5_000 }] }, reason: /commercial rates pending TURNWRK-697/ },
  { id: 'fc-014-stem-walls', scope: { surfaces: [garage(600)], stemWallLf: 60 }, reason: /no rate for labor:stem-wall/ },
  { id: 'sh-steps-with-prep', scope: { surfaces: [garage(550, 'standard')], steps: 3 }, reason: /no rate for labor:steps/ },
  { id: 'sh-surface-too-small', scope: { surfaces: [garage(40, 'standard')] }, reason: /outside 50-3000 sqft/ },
  { id: 'sh-surface-too-large', scope: { surfaces: [garage(3_500, 'standard')] }, reason: /outside 50-3000 sqft/ },
  {
    id: 'sh-total-too-large',
    scope: { surfaces: [garage(2_500, 'standard'), { type: 'driveway', sqft: 2_500, prep: 'standard' }, { type: 'patio', sqft: 1_500, prep: 'standard' }] },
    reason: /exceeds 6000 sqft/,
  },
];

describe('floor coatings pack — golden drafts (cortex PR #76 agreement)', () => {
  it.each(DRAFT_CASES)('$id prices to exactly $totalCents cents', ({ scope, totalCents }) => {
    const q = priced(price(scope));
    expect(q.amountCents).toBe(totalCents);
    expect(q.markupCents).toBe(0);
    expect(q.lineItems.every((l) => l.provenance.source === 'rate-card' && l.provenance.region === 'US-FL-Tampa')).toBe(true);
  });

  it('the published example: a 2-car garage of 500-600 sqft at standard prep is $4,000-5,000', () => {
    for (let sqft = 500; sqft <= 600; sqft++) {
      const cents = priced(price({ surfaces: [garage(sqft, 'standard')] })).amountCents;
      expect(cents).toBeGreaterThanOrEqual(400_000);
      expect(cents).toBeLessThanOrEqual(500_000);
    }
  });
});

describe('floor coatings pack — refusals', () => {
  it.each(NEEDS_INFO_CASES)('$id asks for $fields', ({ scope, fields }) => {
    const r = price(scope);
    if (r.status !== 'needs-info') throw new Error(`expected needs-info, got ${JSON.stringify(r)}`);
    expect(r.missing.map((m) => m.field)).toEqual(fields);
    expect(r.missing.every((m) => m.question.length > 0)).toBe(true);
  });

  it('asks the ticket question for a garage without square footage', () => {
    const r = price({ surfaces: [garage(undefined, 'standard')] });
    expect(r).toEqual({ status: 'needs-info', missing: [{ field: 'surfaces.0.sqft', question: "What's the square footage, or the garage size, e.g. 2-car?" }] });
  });

  it.each(REJECTED_CASES)('$id is rejected', ({ scope, reason }) => {
    const r = price(scope);
    if (r.status !== 'rejected') throw new Error(`expected rejected, got ${JSON.stringify(r)}`);
    expect(r.reasons.join('; ')).toMatch(reason);
  });

  it('fc-015-hardwood-unsupported: a non-concrete surface fails the schema', () => {
    expect(price({ surfaces: [{ type: 'hardwood', sqft: 300, prep: 'standard' }] }).status).toBe('invalid-scope');
  });
});

describe('floor coatings pack — rate card and markup', () => {
  it('is the published card: floor-coatings-tampa@2026-10-05, US-FL-Tampa, $7/$8/$9 by prep', () => {
    expect(FLOOR_COATINGS_RATE_CARD).toMatchObject({ id: 'floor-coatings-tampa', version: '2026-10-05', region: 'US-FL-Tampa' });
    expect(FLOOR_PREP_TIERS.map((p) => FLOOR_COATINGS_RATE_CARD.rates[`labor:coating-${p}`].unitCents)).toEqual([700, 800, 900]);
    for (const lineType of Object.keys(FLOOR_COATINGS_RATE_CARD.rates)) expect(FLOOR_COATINGS_RATE_NOTES[lineType]).toBeTruthy();
  });

  it('defaults to zero markup, but an explicit bps still applies', () => {
    expect(priced(price({ surfaces: [garage(500, 'standard')] }, { overheadProfitBps: undefined })).markupCents).toBe(0);
    expect(priced(price({ surfaces: [garage(500, 'standard')] }, { overheadProfitBps: 1_000 })).amountCents).toBe(440_000);
  });
});

describe('floor coatings pack — properties', () => {
  const sqftArb = fc.integer({ min: RESIDENTIAL_SQFT_MIN, max: RESIDENTIAL_SQFT_MAX });
  const prepArb = fc.constantFrom(...FLOOR_PREP_TIERS);

  it('every residential surface prices inside the published $7-9/sqft band', () => {
    fc.assert(
      fc.property(sqftArb, prepArb, (sqft, prep) => {
        const cents = priced(price({ surfaces: [garage(sqft, prep)] })).amountCents;
        expect(cents).toBeGreaterThanOrEqual(sqft * 700);
        expect(cents).toBeLessThanOrEqual(sqft * 900);
      }),
    );
  });

  it('is monotonic in sqft and in prep tier', () => {
    fc.assert(
      fc.property(sqftArb, sqftArb, (a, b) => {
        const at = (sqft: number, prep: string) => priced(price({ surfaces: [garage(sqft, prep)] })).amountCents;
        const [lo, hi] = [Math.min(a, b), Math.max(a, b)];
        expect(at(hi, 'standard')).toBeGreaterThanOrEqual(at(lo, 'standard'));
        expect(at(lo, 'light')).toBeLessThanOrEqual(at(lo, 'standard'));
        expect(at(lo, 'standard')).toBeLessThanOrEqual(at(lo, 'heavy'));
      }),
    );
  });
});

describe('floor coatings pack — work-order defaults', () => {
  it('marks converted work orders outdoor (pass-through, no pricing impact)', () => {
    expect(floorCoatingsPack.workOrderDefaults).toEqual({ outdoor: true });
  });
});
