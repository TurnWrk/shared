/**
 * Pure money + allowlist helpers for quoting, integer cents throughout
 * (TURNWRK-685; moved from cortex `src/services/tradeEstimator/pricing.ts`).
 *
 * Whole-cent rounding (`roundCents`) and markup (`buildMarkupLines`) are
 * defined here once. The cortex estimator and every quote pack price through
 * them, so the same inputs total the same way everywhere.
 */
import {
  ALLOWED_UNITS,
  type EstimateLineItem,
  type LineUnit,
  type QuoteTotals,
  type RateProvenance,
  type ScopedLine,
  type TradeEstimate,
} from './types';

// --- Allowlist bounds -------------------------------------------------------
// For LLM-scoped lines: wide enough for real trade work, narrow enough to
// reject the absurd ($9,999/hr labor, 10,000 units).

/** Labor unit rate: $20/hr .. $500/hr. */
export const LABOR_CENTS_MIN = 2_000;
export const LABOR_CENTS_MAX = 50_000;
/** Material unit price: $0.01 .. $50,000 per unit. */
export const MATERIAL_CENTS_MIN = 1;
export const MATERIAL_CENTS_MAX = 5_000_000;
/** Per-line quantity ceiling, hours or unit count. */
export const MAX_QUANTITY = 1_000;
/** Cap on scoped lines from one decomposition, to bound a runaway LLM. */
export const MAX_SCOPED_LINES = 40;
/** 100% in basis points. */
export const MAX_PERCENT_BPS = 10_000;

/** Default auto markup: combined overhead+profit, then contingency, on the base. */
export const DEFAULT_OVERHEAD_PROFIT_BPS = 3_500; // 35%
export const DEFAULT_CONTINGENCY_BPS = 1_000; // 10%

const ALLOWED_UNIT_SET = new Set<string>(ALLOWED_UNITS);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** True when `value` is one of the ALLOWED_UNITS. */
export function isAllowedUnit(value: unknown): value is LineUnit {
  return typeof value === 'string' && ALLOWED_UNIT_SET.has(value);
}

// --- Rounding + markup: the one definition ---------------------------------

/** Round to the nearest whole cent (half up). The only rounding rule in quoting. */
export function roundCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value) || 0; // `|| 0` folds -0 into 0
}

/** qty × unit, rounded to a whole cent. */
export function lineTotalCents(quantity: number, unitCents: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitCents)) return 0;
  return roundCents(quantity * unitCents);
}

/** `bps` basis points of `baseCents`, rounded to a whole cent. */
export function percentOfCents(baseCents: number, bps: number): number {
  return roundCents((baseCents * bps) / MAX_PERCENT_BPS);
}

/** Clamp a basis-point markup input to [0, 10000] integer, else a fallback. */
export function sanitizeBps(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const bps = Math.round(n);
  if (bps < 0) return 0;
  if (bps > MAX_PERCENT_BPS) return MAX_PERCENT_BPS;
  return bps;
}

export interface MarkupBps {
  overheadProfitBps: number;
  contingencyBps: number;
}

/**
 * Overhead/profit and contingency rows, each a percent of the labor+materials
 * base, stamped with the caller's `derived` provenance. A zero base or a
 * non-positive bps yields no row.
 */
export function buildMarkupLines(
  baseCents: number,
  markup: MarkupBps,
  provenance: RateProvenance,
): EstimateLineItem[] {
  const rows: EstimateLineItem[] = [];
  const push = (id: string, label: string, bps: number): void => {
    if (bps <= 0 || baseCents <= 0) return;
    const cents = percentOfCents(baseCents, bps);
    if (cents <= 0) return;
    rows.push({ id, kind: 'markup', label, quantity: 1, unitCents: cents, totalCents: cents, percentBps: bps, provenance });
  };
  push('markup_overhead_profit', 'Overhead & profit', markup.overheadProfitBps);
  push('markup_contingency', 'Contingency', markup.contingencyBps);
  return rows;
}

// --- LLM-line allowlist -----------------------------------------------------

/** Normalize a label into a lineType slug component. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Structural allowlist for one LLM-decomposed line. Returns a normalized
 * ScopedLine or null (dropped). Labor is forced to `hour`; the lineType is
 * always `${kind}:${slug}`.
 */
export function sanitizeScopedLine(raw: unknown, index: number): ScopedLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const kind = r.kind === 'labor' || r.kind === 'material' ? r.kind : null;
  if (!kind) return null;

  const label = typeof r.label === 'string' ? r.label.trim() : '';
  if (!label) return null;

  const quantity = typeof r.quantity === 'number' && Number.isFinite(r.quantity) ? r.quantity : NaN;
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) return null;

  let unit: LineUnit;
  if (kind === 'labor') {
    unit = 'hour';
  } else {
    const u = typeof r.unit === 'string' ? r.unit.trim().toLowerCase() : '';
    if (!isAllowedUnit(u)) return null;
    unit = u;
  }

  let slug = typeof r.lineType === 'string' ? slugify(r.lineType.replace(/^(labor|material):/, '')) : '';
  if (!slug || !SLUG_RE.test(slug)) slug = slugify(label);
  if (!slug || !SLUG_RE.test(slug)) slug = `line-${index}`;

  return { kind, lineType: `${kind}:${slug}`, label, quantity, unit };
}

/** Filter a raw decomposed array through the allowlist, capped and de-duped. */
export function sanitizeScopedLines(raw: unknown): ScopedLine[] {
  if (!Array.isArray(raw)) return [];
  const out: ScopedLine[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length && out.length < MAX_SCOPED_LINES; i++) {
    const line = sanitizeScopedLine(raw[i], i);
    if (!line) continue;
    const dedupeKey = `${line.lineType}::${line.label.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(line);
  }
  return out;
}

/**
 * Clamp-or-reject an LLM/override unit rate against the kind's bounds.
 * Returns whole cents or null (the line is then dropped).
 */
export function sanitizeUnitCents(kind: 'labor' | 'material', value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const cents = roundCents(n);
  const min = kind === 'labor' ? LABOR_CENTS_MIN : MATERIAL_CENTS_MIN;
  const max = kind === 'labor' ? LABOR_CENTS_MAX : MATERIAL_CENTS_MAX;
  if (cents < min || cents > max) return null;
  return cents;
}

// --- Assembly ---------------------------------------------------------------

/** A resolved rate for one lineType, ready to price a scoped line. */
export interface ResolvedRate {
  unitCents: number;
  provenance: RateProvenance;
}

export interface AssembleOptions extends MarkupBps {
  region: string;
  generatedAt: number;
}

/**
 * Price scoped lines from a resolved rate map and layer markup on top. Pure:
 * every rate is already looked up and provenance-stamped. A scoped line with
 * no rate is dropped. amountCents = labor + materials + markup, exactly.
 */
export function assembleQuoteLines(
  scopedLines: readonly ScopedLine[],
  rates: ReadonlyMap<string, ResolvedRate>,
  opts: AssembleOptions,
): QuoteTotals {
  const priced: EstimateLineItem[] = [];
  let laborCents = 0;
  let materialsCents = 0;

  scopedLines.forEach((line, index) => {
    const rate = rates.get(line.lineType);
    if (!rate) return;
    const totalCents = lineTotalCents(line.quantity, rate.unitCents);
    priced.push({
      id: `line_${index}`,
      kind: line.kind,
      label: line.label,
      quantity: line.quantity,
      unitCents: rate.unitCents,
      totalCents,
      provenance: rate.provenance,
    });
    if (line.kind === 'labor') laborCents += totalCents;
    else materialsCents += totalCents;
  });

  const baseCents = laborCents + materialsCents;
  const markupRows = buildMarkupLines(baseCents, opts, {
    source: 'derived',
    region: opts.region,
    ratedAt: opts.generatedAt,
  });
  const markupCents = markupRows.reduce((sum, row) => sum + row.totalCents, 0);
  const lineItems = [...priced, ...markupRows];

  return {
    laborCents,
    materialsCents,
    markupCents,
    amountCents: baseCents + markupCents,
    lineItems,
    rateSources: [...new Set(lineItems.map((l) => l.provenance.source))],
  };
}

/** The cortex AI estimator's draft estimate: assembled lines plus a disclaimer. */
export function assembleEstimate(
  scopedLines: readonly ScopedLine[],
  rates: ReadonlyMap<string, ResolvedRate>,
  opts: AssembleOptions,
): TradeEstimate {
  return {
    currency: 'usd',
    region: opts.region,
    ...assembleQuoteLines(scopedLines, rates, opts),
    disclaimer:
      'Draft AI estimate — rates are regional averages, not a firm quote. Review every line before sending.',
    generatedAt: opts.generatedAt,
  };
}
