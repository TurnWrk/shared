/**
 * Quote packs (TURNWRK-685): deterministic pricing for one service line
 * (floor coatings, painting, handyman, co-hosting...).
 *
 * The LLM only extracts scope. A pack validates that scope with its zod
 * schema, reports the required fields still missing (needs-info, never
 * guessed), turns the scope into quantities (`takeoff`), and prices those
 * quantities from a rate card through the shared assembler, so every pack
 * rounds and marks up the same way, to the cent, with provenance per line.
 */
import type { z } from 'zod';
import {
  DEFAULT_CONTINGENCY_BPS,
  DEFAULT_OVERHEAD_PROFIT_BPS,
  assembleQuoteLines,
  isAllowedUnit,
  sanitizeBps,
  type ResolvedRate,
} from './pricing';
import type { LineUnit, QuoteTotals, RateOverride, ScopedLine } from './types';

/** One rate on a business rate card, keyed by lineType on the card. */
export interface RateCardEntry {
  kind: 'labor' | 'material';
  unit: LineUnit;
  /** Whole USD cents per unit. */
  unitCents: number;
}

/** A versioned rate card: our own reviewed rates for one region. */
export interface RateCard {
  id: string;
  version: string;
  currency: 'usd';
  region: string;
  /** ms epoch the card's rates were set; stamped on every line priced from it. */
  ratedAt: number;
  rates: Readonly<Record<string, RateCardEntry>>;
}

/** A required field the scope does not answer yet. */
export interface MissingInfo {
  field: string;
  /** What to ask the customer to get it. */
  question: string;
}

export interface QuotePriceOptions {
  /** ms epoch stamped on the quote and its derived rows. Passed in, never read from a clock. */
  generatedAt: number;
  /** Default DEFAULT_OVERHEAD_PROFIT_BPS. */
  overheadProfitBps?: number;
  /** Default DEFAULT_CONTINGENCY_BPS. */
  contingencyBps?: number;
  /** Trade-supplied rates; win over the card for their lineType. */
  overrides?: readonly RateOverride[];
}

export interface Quote extends QuoteTotals {
  packId: string;
  rateCardId: string;
  rateCardVersion: string;
  currency: 'usd';
  region: string;
  generatedAt: number;
}

export type QuoteResult =
  | { status: 'priced'; quote: Quote }
  /** Scope failed the pack's schema. */
  | { status: 'invalid-scope'; issues: string[] }
  /** Required fields missing: ask, do not guess. */
  | { status: 'needs-info'; missing: MissingInfo[] }
  /** Scope is outside the pack's sanity bounds, or the card cannot price a line. */
  | { status: 'rejected'; reasons: string[] };

export interface QuotePack<Scope> {
  id: string;
  scopeSchema: z.ZodType<Scope>;
  rateCard: RateCard;
  /** Required fields still missing; [] when the scope can be priced. */
  needsInfo(scope: Scope): MissingInfo[];
  /** Sanity checks; each returned string is a reason the scope cannot be quoted. */
  bounds?(scope: Scope): string[];
  /**
   * Pure and deterministic. `scope` is untrusted (LLM output) and is parsed
   * with `scopeSchema` first; pricing refuses a scope with missing info.
   */
  price(scope: unknown, rateCard: RateCard, opts: QuotePriceOptions): QuoteResult;
}

/** What a pack author writes; `price` is supplied by the framework. */
export interface QuotePackDefinition<Scope> extends Omit<QuotePack<Scope>, 'price'> {
  /** Quantities only. Units must be ALLOWED_UNITS; rates come from the card. */
  takeoff(scope: Scope): ScopedLine[];
}

/** Build a QuotePack whose `price` is the shared pricer. */
export function defineQuotePack<Scope>(def: QuotePackDefinition<Scope>): QuotePack<Scope> {
  return { ...def, price: (scope, rateCard, opts) => priceScope(def, scope, rateCard, opts) };
}

function resolveRate(
  line: ScopedLine,
  card: RateCard,
  overrides: ReadonlyMap<string, number>,
): ResolvedRate | string {
  const override = overrides.get(line.lineType);
  if (override !== undefined) {
    if (!Number.isInteger(override) || override < 0) {
      return `override for ${line.lineType} is not a whole non-negative cent amount`;
    }
    return { unitCents: override, provenance: { source: 'override', region: card.region, ratedAt: card.ratedAt } };
  }
  const entry = card.rates[line.lineType];
  if (!entry) return `rate card ${card.id}@${card.version} has no rate for ${line.lineType}`;
  if (entry.kind !== line.kind || entry.unit !== line.unit) {
    return `rate card ${card.id}@${card.version} prices ${line.lineType} as ${entry.kind}/${entry.unit}, takeoff has ${line.kind}/${line.unit}`;
  }
  if (!Number.isInteger(entry.unitCents) || entry.unitCents < 0) {
    return `rate card ${card.id}@${card.version} rate for ${line.lineType} is not a whole non-negative cent amount`;
  }
  return { unitCents: entry.unitCents, provenance: { source: 'rate-card', region: card.region, ratedAt: card.ratedAt } };
}

/**
 * The single pack pricer: parse → needs-info → bounds → takeoff → rate → assemble.
 * Zero-quantity takeoff lines are omitted; negative or non-finite ones reject.
 */
export function priceScope<Scope>(
  def: QuotePackDefinition<Scope>,
  rawScope: unknown,
  rateCard: RateCard,
  opts: QuotePriceOptions,
): QuoteResult {
  const parsed = def.scopeSchema.safeParse(rawScope);
  if (!parsed.success) {
    return {
      status: 'invalid-scope',
      issues: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  const scope = parsed.data;

  const missing = def.needsInfo(scope);
  if (missing.length > 0) return { status: 'needs-info', missing };

  const reasons = def.bounds?.(scope) ?? [];
  if (reasons.length > 0) return { status: 'rejected', reasons };

  const overrides = new Map((opts.overrides ?? []).map((o) => [o.lineType, o.unitCents]));
  const lines: ScopedLine[] = [];
  const rates = new Map<string, ResolvedRate>();
  for (const line of def.takeoff(scope)) {
    if (!Number.isFinite(line.quantity) || line.quantity < 0) {
      reasons.push(`${line.lineType} has quantity ${line.quantity}`);
      continue;
    }
    if (!isAllowedUnit(line.unit)) {
      reasons.push(`${line.lineType} has unit ${String(line.unit)}, not an allowed unit`);
      continue;
    }
    if (line.quantity === 0) continue;
    const rate = resolveRate(line, rateCard, overrides);
    if (typeof rate === 'string') {
      reasons.push(rate);
      continue;
    }
    rates.set(line.lineType, rate);
    lines.push(line);
  }
  if (reasons.length > 0) return { status: 'rejected', reasons };

  const totals = assembleQuoteLines(lines, rates, {
    region: rateCard.region,
    generatedAt: opts.generatedAt,
    overheadProfitBps: sanitizeBps(opts.overheadProfitBps, DEFAULT_OVERHEAD_PROFIT_BPS),
    contingencyBps: sanitizeBps(opts.contingencyBps, DEFAULT_CONTINGENCY_BPS),
  });
  return {
    status: 'priced',
    quote: {
      packId: def.id,
      rateCardId: rateCard.id,
      rateCardVersion: rateCard.version,
      currency: 'usd',
      region: rateCard.region,
      generatedAt: opts.generatedAt,
      ...totals,
    },
  };
}
