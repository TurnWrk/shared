/**
 * Shapes for the quote engine (TURNWRK-685; moved from cortex
 * `src/services/tradeEstimator/types.ts`, TURNWRK-274).
 *
 * A priced line is field-compatible with dispatch `ProposalLineItem`
 * (id/kind/label/quantity/unitCents/totalCents/percentBps, integer USD cents)
 * so a quote drops straight onto an Estimate. It adds `provenance`: every
 * priced line records where its rate came from (Alan's DECISION 2026-08-01),
 * so a historical quote can be re-priced and audited to the cent.
 */

/**
 * Where one line's unit rate came from.
 *   - 'llm-regional' — LLM-estimated regional average (the cortex v1 source).
 *   - 'override'     — a rate the trade supplied for this line type.
 *   - 'derived'      — a markup row we computed (overhead/profit, contingency).
 *   - 'internal-db'  — RESERVED for the TurnWrk-built cost database.
 *   - 'rate-card'    — one of our own business rate cards, priced by a quote pack.
 */
export type RateProvenanceSource = 'llm-regional' | 'override' | 'derived' | 'internal-db' | 'rate-card';

export type EstimateLineKind = 'labor' | 'material' | 'markup';

/**
 * Units a scoped line may be measured in. A hallucinated unit ('per soul',
 * 'fortnight') fails the allowlist and its line is never priced.
 */
export const ALLOWED_UNITS = [
  'hour',
  'each',
  'linear-foot',
  'square-foot',
  'cubic-yard',
  'gallon',
  'day',
] as const;
export type LineUnit = (typeof ALLOWED_UNITS)[number];

/** A scoped-but-unpriced line: what work, how much, never what it costs. */
export interface ScopedLine {
  kind: 'labor' | 'material';
  /**
   * Normalized rate key `${kind}:${slug}` (e.g. `labor:plumbing`). Overrides,
   * rate-card entries and price-book rows all key on it, so the same job
   * re-prices deterministically.
   */
  lineType: string;
  label: string;
  quantity: number;
  unit: LineUnit;
}

/** A trade-supplied rate for one lineType, applied ahead of any other source. */
export interface RateOverride {
  lineType: string;
  unitCents: number;
}

/** Provenance stamped on every priced line. */
export interface RateProvenance {
  source: RateProvenanceSource;
  /** Region the rate was resolved for (e.g. 'US-FL-Tampa', or 'default'). */
  region: string;
  /** ms epoch the rate was resolved. */
  ratedAt: number;
}

/**
 * One priced line. Field-compatible with dispatch `ProposalLineItem` plus
 * `provenance`; integer minor units (USD cents) throughout.
 */
export interface EstimateLineItem {
  id: string;
  kind: EstimateLineKind;
  label: string;
  quantity: number;
  unitCents: number;
  totalCents: number;
  /** Basis points behind a percent-derived markup row (2500 = 25%). */
  percentBps?: number;
  provenance: RateProvenance;
}

/** Labor/material/markup totals plus the lines they sum. */
export interface QuoteTotals {
  laborCents: number;
  materialsCents: number;
  /** Overhead/profit + contingency markup rows, summed. */
  markupCents: number;
  /** labor + materials + markup, always exactly. */
  amountCents: number;
  lineItems: EstimateLineItem[];
  /** Distinct rate provenances present, for audit/telemetry. */
  rateSources: RateProvenanceSource[];
}

/** A fully assembled draft estimate from the cortex AI estimator. */
export interface TradeEstimate extends QuoteTotals {
  currency: 'usd';
  region: string;
  /** This is a draft AI estimate; the UI must show it AS an estimate. */
  disclaimer: string;
  generatedAt: number;
}
