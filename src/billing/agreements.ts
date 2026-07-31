/**
 * Customer-agreement billing models — per-visit, flat monthly, seasonal prepay
 * (TURNWRK-293, Route & Recurring Verticals). This is the **operator → their
 * customer** money axis: how a landscaper or pool operator bills the homeowner
 * for recurring work. Do not confuse it with `./usageModel` + `./quote`, which
 * are the **Turnwrk → operator** axis (our take-rate on GMV, Pro membership).
 * Both are "billing"; they never touch the same numbers.
 *
 * The card is suite-sized — it also wants Firestore-persisted agreements, an
 * operator+customer balance UI, and ACH offered per the operator's own Stripe
 * Connect configuration (`./connect`, still Alan-gated scaffolding that has
 * never called Stripe). This file is the pure, reversible foundation those
 * layers sit on: the mode shapes, the drawdown math, the proration math, and
 * the shape of an auditable transition. It persists nothing and talks to no
 * SDK — every function is deterministic and total.
 *
 * Money rules (Soul: strictest of all for money):
 * - Every amount is an **integer in minor units** (US cents). Callers pass
 *   integers; the guards here reject anything else rather than silently
 *   `Math.round`-ing a caller's bug into a real charge.
 * - Splits are computed by subtraction so the parts always re-sum to the whole
 *   — a customer is never double-charged nor short-credited by a rounding gap.
 * - Every plan change is expressed as an `AgreementTransition`, so the ledger
 *   can reconstruct why a balance moved.
 */

// ---------------------------------------------------------------------------
// Modes and terms
// ---------------------------------------------------------------------------

/**
 * How a customer agreement bills. A pack switches these on by declaring the
 * `seasonal_billing` extension (src/verticals/types.ts); code branches on the
 * mode here, never on the vertical key.
 */
export type AgreementBillingMode = 'per_visit' | 'flat_monthly' | 'seasonal_prepay';

export const AGREEMENT_BILLING_MODES: readonly AgreementBillingMode[] = [
  'per_visit',
  'flat_monthly',
  'seasonal_prepay',
] as const;

/** Bill a fixed amount each time a visit is completed. No recurring commitment. */
export interface PerVisitTerms {
  mode: 'per_visit';
  /** Charged when a visit completes, integer minor units. */
  amountPerVisitMinor: number;
}

/**
 * Bill a fixed amount every month regardless of how many visits fall in it —
 * the customer pays for the relationship, not the visit count. Visits
 * themselves trigger no charge.
 */
export interface FlatMonthlyTerms {
  mode: 'flat_monthly';
  /** Charged once per billing month, integer minor units. */
  amountPerMonthMinor: number;
}

/**
 * Take a season's payment up front and draw each visit against the balance.
 * Pulls the season's cash flow forward; the remaining balance is what the
 * operator and customer both watch.
 */
export interface SeasonalPrepayTerms {
  mode: 'seasonal_prepay';
  /** Collected up front — the starting drawdown balance, integer minor units. */
  prepaidTotalMinor: number;
  /** Drawn from the balance per completed visit, integer minor units. */
  drawPerVisitMinor: number;
}

export type AgreementTerms = PerVisitTerms | FlatMonthlyTerms | SeasonalPrepayTerms;

// ---------------------------------------------------------------------------
// Guards — all external input is hostile (Soul)
// ---------------------------------------------------------------------------

/**
 * Assert an amount is a non-negative integer in minor units. Throws rather than
 * coercing: a fractional or negative "cents" value is a caller bug, and money
 * is the one place we refuse to paper over it.
 */
export function assertMinorAmount(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `[agreements] ${field} must be a non-negative integer in minor units, got ${value}.`,
    );
  }
  return value;
}

/**
 * Validate a terms object end to end. Returns the same object so it can guard a
 * boundary inline (`persist(validateTerms(input))`); throws on any bad amount or
 * an unknown mode.
 */
export function validateTerms(terms: AgreementTerms): AgreementTerms {
  switch (terms.mode) {
    case 'per_visit':
      assertMinorAmount(terms.amountPerVisitMinor, 'amountPerVisitMinor');
      return terms;
    case 'flat_monthly':
      assertMinorAmount(terms.amountPerMonthMinor, 'amountPerMonthMinor');
      return terms;
    case 'seasonal_prepay':
      assertMinorAmount(terms.prepaidTotalMinor, 'prepaidTotalMinor');
      assertMinorAmount(terms.drawPerVisitMinor, 'drawPerVisitMinor');
      return terms;
    default:
      // Exhaustiveness: a new mode must extend this switch, not slip through.
      throw new Error(
        `[agreements] unknown billing mode: ${(terms as { mode?: string }).mode}`,
      );
  }
}

// ---------------------------------------------------------------------------
// Per-visit billing
// ---------------------------------------------------------------------------

/** What a single completed visit does to the bill under some terms. */
export interface VisitBilling {
  /**
   * Charged to the customer now, integer minor units. Zero for flat-monthly
   * (billed on the monthly cycle) and seasonal-prepay (drawn from the balance,
   * already collected).
   */
  chargeNowMinor: number;
  /** Drawn from the prepay balance, integer minor units. Zero unless prepay. */
  drawFromBalanceMinor: number;
}

/**
 * Resolve a completed visit against terms. This is the single place that knows
 * a per-visit visit charges, a flat-monthly visit is free at the door, and a
 * prepay visit draws rather than charges — callers stay mode-agnostic.
 */
export function visitBilling(terms: AgreementTerms): VisitBilling {
  switch (terms.mode) {
    case 'per_visit':
      return { chargeNowMinor: terms.amountPerVisitMinor, drawFromBalanceMinor: 0 };
    case 'flat_monthly':
      return { chargeNowMinor: 0, drawFromBalanceMinor: 0 };
    case 'seasonal_prepay':
      return { chargeNowMinor: 0, drawFromBalanceMinor: terms.drawPerVisitMinor };
    default:
      throw new Error(
        `[agreements] unknown billing mode: ${(terms as { mode?: string }).mode}`,
      );
  }
}

// ---------------------------------------------------------------------------
// Prepay drawdown
// ---------------------------------------------------------------------------

/** Outcome of drawing one visit against a seasonal-prepay balance. */
export interface DrawdownResult {
  /**
   * Minor units actually taken from the balance — never more than what remains,
   * so the balance cannot go negative on the operator's books.
   */
  drawnMinor: number;
  /** Balance left after this visit, integer minor units, never below zero. */
  remainingMinor: number;
  /**
   * Cost the balance could not cover, integer minor units. Non-zero means the
   * season is exhausted mid-visit; the caller decides whether to bill it
   * separately or refuse the visit. Surfaced rather than swallowed.
   */
  shortfallMinor: number;
}

/**
 * Draw one visit's cost against a running prepay balance. Pure: the caller owns
 * the balance and persists the result; this only does the arithmetic, clamped
 * so a balance never goes negative and any shortfall is reported, not hidden.
 */
export function applyPrepayDrawdown(
  remainingBalanceMinor: number,
  visitCostMinor: number,
): DrawdownResult {
  assertMinorAmount(remainingBalanceMinor, 'remainingBalanceMinor');
  assertMinorAmount(visitCostMinor, 'visitCostMinor');
  const drawnMinor = Math.min(remainingBalanceMinor, visitCostMinor);
  return {
    drawnMinor,
    remainingMinor: remainingBalanceMinor - drawnMinor,
    shortfallMinor: visitCostMinor - drawnMinor,
  };
}

/** A summary of a prepay season's balance — what operator and customer both see. */
export interface PrepayBalanceSummary {
  /** The season's up-front total, integer minor units. */
  prepaidTotalMinor: number;
  /** Sum drawn by visits so far, integer minor units. */
  consumedMinor: number;
  /** Prepaid minus consumed, integer minor units, never below zero. */
  remainingMinor: number;
  /** Whole percent of the season consumed, 0–100, for a progress meter. */
  consumedPct: number;
}

/**
 * Build the operator/customer-facing balance summary from the prepaid total and
 * the amounts already drawn. `consumedMinor` is clamped to the total so an
 * over-draw (should never happen given `applyPrepayDrawdown`, but ledgers get
 * hand-edited) reads as a fully-spent season rather than a negative remainder.
 */
export function prepayBalanceSummary(
  prepaidTotalMinor: number,
  drawnAmountsMinor: readonly number[],
): PrepayBalanceSummary {
  assertMinorAmount(prepaidTotalMinor, 'prepaidTotalMinor');
  let consumed = 0;
  for (const amount of drawnAmountsMinor) {
    consumed += assertMinorAmount(amount, 'drawnAmountsMinor[]');
  }
  const consumedMinor = Math.min(consumed, prepaidTotalMinor);
  const remainingMinor = prepaidTotalMinor - consumedMinor;
  const consumedPct =
    prepaidTotalMinor === 0 ? 100 : Math.round((consumedMinor / prepaidTotalMinor) * 100);
  return { prepaidTotalMinor, consumedMinor, remainingMinor, consumedPct };
}

// ---------------------------------------------------------------------------
// Proration
// ---------------------------------------------------------------------------

/** Inputs for prorating a fixed-period charge at a mid-period plan change. */
export interface ProrationInput {
  /** The full-period amount under the terms in effect, integer minor units. */
  periodAmountMinor: number;
  /** Whole days in the billing period (> 0). */
  periodDays: number;
  /** Whole days already elapsed when the change takes effect; clamped to the period. */
  elapsedDays: number;
}

/** How a fixed-period amount splits across a mid-period change. */
export interface ProrationResult {
  /** Amount earned for the elapsed portion — already owed, integer minor units. */
  earnedMinor: number;
  /**
   * Unearned remainder for the unused portion, integer minor units. Derived by
   * subtraction so `earned + unearned === periodAmount` exactly — this is what
   * keeps a mid-season switch from double-charging or losing a cent.
   */
  unearnedMinor: number;
}

/**
 * Split a fixed-period charge (a flat month, or a prepaid season treated as one
 * period) into the part already earned and the part still owed to the customer
 * when the plan changes partway through. `elapsedDays` is clamped to
 * `[0, periodDays]`; `earned` is rounded and `unearned` is the exact remainder,
 * so the two always re-sum to `periodAmountMinor`.
 */
export function proratePeriod(input: ProrationInput): ProrationResult {
  assertMinorAmount(input.periodAmountMinor, 'periodAmountMinor');
  if (!Number.isInteger(input.periodDays) || input.periodDays <= 0) {
    throw new Error(`[agreements] periodDays must be a positive integer, got ${input.periodDays}.`);
  }
  if (!Number.isInteger(input.elapsedDays) || input.elapsedDays < 0) {
    throw new Error(
      `[agreements] elapsedDays must be a non-negative integer, got ${input.elapsedDays}.`,
    );
  }
  const elapsed = Math.min(input.elapsedDays, input.periodDays);
  const earnedMinor = Math.round((input.periodAmountMinor * elapsed) / input.periodDays);
  return { earnedMinor, unearnedMinor: input.periodAmountMinor - earnedMinor };
}

// ---------------------------------------------------------------------------
// Auditable transitions
// ---------------------------------------------------------------------------

/**
 * One entry in an agreement's change ledger. `from === null` is the initial
 * enrolment. `netAdjustmentMinor` is signed: positive means the customer was
 * charged (an upgrade owing the elapsed remainder), negative means credited (a
 * downgrade returning unearned prepay). Persisting these is a later card; the
 * shape is fixed here so the drawdown/proration output has somewhere to land.
 */
export interface AgreementTransition {
  /** ISO-8601 UTC instant of the change (Soul: UTC in storage). */
  at: string;
  /** Terms before the change, or null for the initial enrolment. */
  from: AgreementTerms | null;
  /** Terms after the change. */
  to: AgreementTerms;
  /** Operator-visible reason ("mid-season switch to flat monthly"). */
  reason: string;
  /** Signed net money moved by the change, integer minor units (+charge / −credit). */
  netAdjustmentMinor: number;
}

/**
 * Build a validated transition record. Validates both terms, requires a UTC
 * ISO-8601 instant and a non-empty reason, and requires the net adjustment to
 * be an integer (it may be negative — a credit — so `assertMinorAmount` is too
 * strict here). Returns a plain object with no `undefined` fields, ready for a
 * Firestore write (Soul: no undefined in payloads).
 */
export function buildAgreementTransition(params: {
  at: string;
  from: AgreementTerms | null;
  to: AgreementTerms;
  reason: string;
  netAdjustmentMinor: number;
}): AgreementTransition {
  if (!ISO_UTC_INSTANT.test(params.at)) {
    throw new Error(`[agreements] at must be a UTC ISO-8601 instant, got "${params.at}".`);
  }
  const reason = params.reason.trim();
  if (!reason) {
    throw new Error('[agreements] a transition requires a non-empty reason.');
  }
  if (!Number.isInteger(params.netAdjustmentMinor)) {
    throw new Error(
      `[agreements] netAdjustmentMinor must be an integer in minor units, got ${params.netAdjustmentMinor}.`,
    );
  }
  return {
    at: params.at,
    from: params.from === null ? null : validateTerms(params.from),
    to: validateTerms(params.to),
    reason,
    netAdjustmentMinor: params.netAdjustmentMinor,
  };
}

/** UTC ISO-8601 with a trailing `Z` — the only instant shape stored suite-wide. */
const ISO_UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
