/**
 * Floor coatings quote pack (TURNWRK-691): Tampa Concrete Coatings, our own
 * company, quoting garage / lanai / patio / pool deck / driveway floors.
 *
 * Every residential rate is the PUBLISHED consumer price (site copy, rent-local-sites
 * `apps/sites/tampa-concrete-coatings/niche.config.json`): $7-9/sqft all-in
 * (diamond grind, routine crack repair, polyurea base, flake, polyaspartic top)
 * by prep, logo inlay a flat $300-700 by size. The quoted total must equal what
 * the site promises, so this pack prices with ZERO overhead/contingency markup
 * by default; a caller can still pass bps explicitly.
 *
 * Steps, stem walls and heavy slab repair are "priced line by line" on the site
 * with no published amount, and commercial is "priced lower per sqft", also
 * unpublished. Those lines have no rate on the card, so the shared pricer
 * rejects them (never guessed) until TURNWRK-697 supplies the rates.
 */
import { z } from 'zod';
import { defineQuotePack, type MissingInfo, type QuotePack, type RateCard } from '../pack';
import type { ScopedLine } from '../types';

export const FLOOR_SURFACE_TYPES = ['garage', 'lanai', 'patio', 'pool-deck', 'driveway', 'commercial'] as const;
export type FloorSurfaceType = (typeof FLOOR_SURFACE_TYPES)[number];

export const FLOOR_PREP_TIERS = ['light', 'standard', 'heavy'] as const;
export type FloorPrepTier = (typeof FLOOR_PREP_TIERS)[number];

export const LOGO_SIZES = ['small', 'medium', 'large'] as const;
export type LogoSize = (typeof LOGO_SIZES)[number];

const surfaceSchema = z.object({
  type: z.enum(FLOOR_SURFACE_TYPES),
  /** Measured square feet. Absent means ask; a car count is never converted silently. */
  sqft: z.number().positive().finite().optional(),
  /** Slab condition tier. Absent means ask; there is no default. */
  prep: z.enum(FLOOR_PREP_TIERS).optional(),
});

export const floorCoatingsScopeSchema = z.object({
  surfaces: z.array(surfaceSchema).max(10),
  /** Routine crack repair is inside the all-in $/sqft; recorded, not priced separately. */
  crackRepairLf: z.number().min(0).finite().optional(),
  steps: z.number().int().min(0).optional(),
  stemWallLf: z.number().min(0).finite().optional(),
  /** Settled sections, wide cracks, spalling: outside the all-in crack repair. */
  heavySlabRepair: z.boolean().optional(),
  /** A requested logo inlay; `size` absent means ask. */
  logo: z.object({ size: z.enum(LOGO_SIZES).optional() }).optional(),
});
export type FloorCoatingsScope = z.infer<typeof floorCoatingsScopeSchema>;
export type FloorSurface = FloorCoatingsScope['surfaces'][number];

/** Commercial is derived from the surface type, never a separate flag that can disagree. */
export const isCommercialScope = (scope: FloorCoatingsScope): boolean =>
  scope.surfaces.some((s) => s.type === 'commercial');

/** Residential per-surface sanity bounds, square feet. */
export const RESIDENTIAL_SQFT_MIN = 50;
export const RESIDENTIAL_SQFT_MAX = 3_000;
/** Whole-job residential sanity bound: beyond this it is a site visit, not a phone quote. */
export const RESIDENTIAL_TOTAL_SQFT_MAX = 6_000;

const coatingLineType = (prep: FloorPrepTier): string => `labor:coating-${prep}`;
const logoLineType = (size: LogoSize): string => `material:logo-inlay-${size}`;

export const FLOOR_COATINGS_RATE_CARD: RateCard = {
  id: 'floor-coatings-tampa',
  version: '2026-10-05',
  currency: 'usd',
  region: 'US-FL-Tampa',
  ratedAt: Date.UTC(2026, 9, 5),
  rates: {
    [coatingLineType('light')]: { kind: 'labor', unit: 'square-foot', unitCents: 700 },
    [coatingLineType('standard')]: { kind: 'labor', unit: 'square-foot', unitCents: 800 },
    [coatingLineType('heavy')]: { kind: 'labor', unit: 'square-foot', unitCents: 900 },
    [logoLineType('small')]: { kind: 'material', unit: 'each', unitCents: 30_000 },
    [logoLineType('medium')]: { kind: 'material', unit: 'each', unitCents: 50_000 },
    [logoLineType('large')]: { kind: 'material', unit: 'each', unitCents: 70_000 },
    // No rate for labor:steps, labor:stem-wall, labor:heavy-slab-repair or any
    // commercial coating: unpublished, pending TURNWRK-697.
  },
};

/**
 * Where each rate came from. The framework's RateCardEntry carries no note, so
 * the provenance text lives beside the card, keyed the same way.
 */
export const FLOOR_COATINGS_RATE_NOTES: Readonly<Record<string, string>> = {
  [coatingLineType('light')]: 'Published: $7/sqft, low end of the $7-9 all-in band (clean or new slab).',
  [coatingLineType('standard')]: 'Assumption pending TURNWRK-697: $8/sqft midpoint of the published $7-9 band for typical prep.',
  [coatingLineType('heavy')]: 'Published: $9/sqft, high end of the $7-9 all-in band (coating removal, oil, heavy grind).',
  [logoLineType('small')]: 'Assumption pending TURNWRK-697: small inlay at $300, the low end of the published $300-700 band.',
  [logoLineType('medium')]: 'Assumption pending TURNWRK-697: medium inlay at $500, midpoint of the published $300-700 band.',
  [logoLineType('large')]: 'Assumption pending TURNWRK-697: large inlay at $700, the high end of the published $300-700 band.',
};

const SURFACE_LABEL: Record<FloorSurfaceType, string> = {
  garage: 'Garage floor',
  lanai: 'Lanai',
  patio: 'Patio',
  'pool-deck': 'Pool deck',
  driveway: 'Driveway',
  commercial: 'Commercial floor',
};

/** Line-by-line items the scope asks for, as the lineTypes takeoff emits for them. */
function lineByLineTypes(scope: FloorCoatingsScope): string[] {
  const types: string[] = [];
  if (scope.steps) types.push('labor:steps');
  if (scope.stemWallLf) types.push('labor:stem-wall');
  if (scope.heavySlabRepair) types.push('labor:heavy-slab-repair');
  return types;
}

function needsInfo(scope: FloorCoatingsScope): MissingInfo[] {
  // A job that cannot be priced from this card goes to a human whatever the
  // customer answers, so do not ask them questions first.
  if (isCommercialScope(scope)) return [];
  if (lineByLineTypes(scope).some((t) => !(t in FLOOR_COATINGS_RATE_CARD.rates))) return [];
  const missing: MissingInfo[] = [];
  if (scope.surfaces.length === 0) {
    missing.push({ field: 'surfaces', question: 'Which areas do you want coated (garage, lanai, patio, pool deck, driveway)?' });
  }
  scope.surfaces.forEach((s, i) => {
    if (s.sqft === undefined) {
      missing.push({
        field: `surfaces.${i}.sqft`,
        question:
          s.type === 'garage'
            ? "What's the square footage, or the garage size, e.g. 2-car?"
            : `What's the square footage of the ${SURFACE_LABEL[s.type].toLowerCase()} (length x width works)?`,
      });
    }
    if (s.prep === undefined) {
      missing.push({
        field: `surfaces.${i}.prep`,
        question: `What condition is the ${SURFACE_LABEL[s.type].toLowerCase()} concrete in: bare, painted, or already coated?`,
      });
    }
  });
  if (scope.logo && scope.logo.size === undefined) {
    missing.push({ field: 'logo.size', question: 'How big should the logo be, and how many colors or how much detail does it have?' });
  }
  return missing;
}

function bounds(scope: FloorCoatingsScope): string[] {
  if (isCommercialScope(scope)) return ['commercial rates pending TURNWRK-697'];
  const reasons: string[] = [];
  let total = 0;
  scope.surfaces.forEach((s, i) => {
    const sqft = s.sqft ?? 0;
    total += sqft;
    if (sqft < RESIDENTIAL_SQFT_MIN || sqft > RESIDENTIAL_SQFT_MAX) {
      reasons.push(
        `surfaces.${i} (${s.type}) is ${sqft} sqft, outside ${RESIDENTIAL_SQFT_MIN}-${RESIDENTIAL_SQFT_MAX} sqft for a residential surface`,
      );
    }
  });
  if (total > RESIDENTIAL_TOTAL_SQFT_MAX) {
    reasons.push(`total ${total} sqft exceeds ${RESIDENTIAL_TOTAL_SQFT_MAX} sqft for one residential job`);
  }
  return reasons;
}

function takeoff(scope: FloorCoatingsScope): ScopedLine[] {
  const lines: ScopedLine[] = scope.surfaces.map((s) => {
    const prep = s.prep as FloorPrepTier; // needsInfo guarantees prep and sqft before takeoff
    return {
      kind: 'labor',
      lineType: coatingLineType(prep),
      label: `${SURFACE_LABEL[s.type]}: flake coating system, all-in (${prep} prep)`,
      quantity: s.sqft ?? 0,
      unit: 'square-foot',
    };
  });
  if (scope.logo?.size) {
    lines.push({ kind: 'material', lineType: logoLineType(scope.logo.size), label: `Logo/graphic inlay (${scope.logo.size}, flat)`, quantity: 1, unit: 'each' });
  }
  // Unpublished line-by-line items: emitted so the card's missing rate rejects them.
  if (scope.steps) lines.push({ kind: 'labor', lineType: 'labor:steps', label: 'Coat steps', quantity: scope.steps, unit: 'each' });
  if (scope.stemWallLf) {
    lines.push({ kind: 'labor', lineType: 'labor:stem-wall', label: 'Coat stem walls', quantity: scope.stemWallLf, unit: 'linear-foot' });
  }
  if (scope.heavySlabRepair) {
    lines.push({ kind: 'labor', lineType: 'labor:heavy-slab-repair', label: 'Heavy slab repair', quantity: 1, unit: 'each' });
  }
  return lines;
}

const basePack = defineQuotePack<FloorCoatingsScope>({
  id: 'floor-coatings',
  scopeSchema: floorCoatingsScopeSchema,
  rateCard: FLOOR_COATINGS_RATE_CARD,
  // Lanai, patio, pool deck and driveway are outdoor. A garage is covered, but
  // the polyurea/polyaspartic cure is still humidity- and rain-sensitive, so the
  // whole pack schedules as outdoor work.
  workOrderDefaults: { outdoor: true },
  needsInfo,
  bounds,
  takeoff,
});

/**
 * The pack, priced by the shared pricer with zero markup unless the caller
 * passes bps: published consumer prices are already all-in.
 */
export const floorCoatingsPack: QuotePack<FloorCoatingsScope> = {
  ...basePack,
  price: (scope, rateCard, opts) =>
    basePack.price(scope, rateCard, {
      ...opts,
      overheadProfitBps: opts.overheadProfitBps ?? 0,
      contingencyBps: opts.contingencyBps ?? 0,
    }),
};
