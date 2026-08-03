/**
 * Suite commercial model **v2** — "money-moved": the software is free and
 * unlimited, and Turnwrk earns on value that flows through it.
 *
 * Revenue lines:
 * - Payments take-rate on GMV processed through Turnwrk (our markup ABOVE the
 *   card processor's cost — standard ~2.9% + $0.30 stays pass-through and is
 *   NOT Turnwrk revenue).
 * - AI credits beyond the plan's included allotment.
 * - An optional flat **Pro** membership, per business — never per property.
 * - Restock affiliate margin on supplies bought through carts (informational
 *   here; it is never a line on the customer's bill).
 *
 * Relationship to v1 (`./catalog` + `./quote`): retired per-unit subscription
 * scaffolding (TURNWRK-303). Those modules remain for tests and history only.
 * Suite Checkout in dispatch is v2 flat Pro (`/api/billing/checkout` →
 * `lib/billing/suitePro.ts`); no code path may charge per unit or per property.
 *
 * Money is integer USD cents; rates are basis points (100 bps = 1.00%).
 * Pure module — never talks to Stripe.
 */

/** Canonical v2 constants. Every published price must read from here. */
export const SUITE_USAGE_MODEL = {
  /** Turnwrk markup on processed GMV, free plan. 100 bps = 1.00%. */
  freePaymentRateBps: 100,
  /** Turnwrk markup on processed GMV, Pro plan. 60 bps = 0.60%. */
  proPaymentRateBps: 60,
  /** Flat Pro membership per BUSINESS per month. Never multiplied by units. */
  proMonthlyFeeCents: 9_900,
  /** AI credits included per month on the free plan. */
  freeIncludedAiCredits: 15,
  /** AI credits included per month on Pro. */
  proIncludedAiCredits: 75,
  /** Charge per AI credit beyond the included allotment. */
  aiCreditOverageCents: 400,
  /** Affiliate margin on Restock cart purchases — informational, never billed. */
  restockAffiliateRateBps: 300,
  /**
   * Estimator quotes + inspections per $1,000 of GMV. A calculator heuristic
   * for deriving a plausible AI usage default, not a price.
   */
  aiActionsPer1kGmv: 1.2,
} as const;

/** Free trial length applied to **Pro** (the base product is free forever). */
export const SUITE_PRO_TRIAL_DAYS = 45;

export type SuiteUsagePlan = 'free' | 'pro';

export interface SuiteUsageQuoteInput {
  /** Monthly payment volume processed through Turnwrk, in USD cents. */
  gmvCents: number;
  /** Billable AI actions (Estimator quotes, inspections, AI intake) per month. */
  aiActions: number;
}

export interface SuiteUsagePlanBill {
  plan: SuiteUsagePlan;
  /** Flat membership — 0 on the free plan. */
  membershipCents: number;
  /** GMV × the plan's take-rate. */
  paymentCents: number;
  /** max(0, aiActions − included) × overage. */
  aiOverageCents: number;
  /** AI credits included on this plan (for itemized display). */
  includedAiCredits: number;
  /** The plan's take-rate in bps (for itemized display). */
  paymentRateBps: number;
  totalCents: number;
}

export interface SuiteUsageQuote {
  gmvCents: number;
  aiActions: number;
  free: SuiteUsagePlanBill;
  pro: SuiteUsagePlanBill;
  /** The cheaper plan. Ties resolve to `free` — never upsell on a tie. */
  recommended: SuiteUsagePlan;
  recommendedTotalCents: number;
  /** |free.total − pro.total| — what the recommendation saves. */
  savingsCents: number;
  /** recommendedTotal / gmv in bps. 0 when gmv is 0. */
  effectiveRateBps: number;
  /** Payments-only crossover where Pro's lower rate repays its fee. */
  proBreakevenGmvCents: number;
}

function rateOf(amountCents: number, bps: number): number {
  return Math.round((amountCents * bps) / 10_000);
}

/**
 * Plausible monthly AI usage for a given GMV — the calculator's default before
 * the user overrides it.
 */
export function deriveAiActionsFromGmv(gmvCents: number): number {
  if (!Number.isFinite(gmvCents) || gmvCents <= 0) return 0;
  const thousandsOfDollars = gmvCents / 100_000;
  return Math.round(thousandsOfDollars * SUITE_USAGE_MODEL.aiActionsPer1kGmv);
}

/**
 * GMV at which Pro's cheaper take-rate exactly repays its flat fee:
 * fee / (freeRate − proRate). Payments-only — because Pro also includes more
 * AI credits, an AI-heavy account can flip to Pro slightly below this. That is
 * correct, not a bug.
 */
export function suiteProBreakevenGmvCents(): number {
  const { proMonthlyFeeCents, freePaymentRateBps, proPaymentRateBps } =
    SUITE_USAGE_MODEL;
  const spreadBps = freePaymentRateBps - proPaymentRateBps;
  if (spreadBps <= 0) return 0;
  return Math.round((proMonthlyFeeCents * 10_000) / spreadBps);
}

function billFor(
  plan: SuiteUsagePlan,
  gmvCents: number,
  aiActions: number,
): SuiteUsagePlanBill {
  const isPro = plan === 'pro';
  const paymentRateBps = isPro
    ? SUITE_USAGE_MODEL.proPaymentRateBps
    : SUITE_USAGE_MODEL.freePaymentRateBps;
  const includedAiCredits = isPro
    ? SUITE_USAGE_MODEL.proIncludedAiCredits
    : SUITE_USAGE_MODEL.freeIncludedAiCredits;
  const membershipCents = isPro ? SUITE_USAGE_MODEL.proMonthlyFeeCents : 0;

  const paymentCents = rateOf(gmvCents, paymentRateBps);
  const aiOverageCents =
    Math.max(0, aiActions - includedAiCredits) *
    SUITE_USAGE_MODEL.aiCreditOverageCents;

  return {
    plan,
    membershipCents,
    paymentCents,
    aiOverageCents,
    includedAiCredits,
    paymentRateBps,
    totalCents: membershipCents + paymentCents + aiOverageCents,
  };
}

/**
 * Quote both plans for a month's payment volume and AI usage, and recommend
 * the cheaper one. Negative / non-finite inputs clamp to 0 rather than throw —
 * this backs a public estimator where a slider must never produce NaN.
 */
export function quoteSuiteUsage(input: SuiteUsageQuoteInput): SuiteUsageQuote {
  const gmvCents = Number.isFinite(input.gmvCents)
    ? Math.max(0, Math.round(input.gmvCents))
    : 0;
  const aiActions = Number.isFinite(input.aiActions)
    ? Math.max(0, Math.trunc(input.aiActions))
    : 0;

  const free = billFor('free', gmvCents, aiActions);
  const pro = billFor('pro', gmvCents, aiActions);

  const recommended: SuiteUsagePlan =
    pro.totalCents < free.totalCents ? 'pro' : 'free';
  const recommendedTotalCents = Math.min(free.totalCents, pro.totalCents);

  return {
    gmvCents,
    aiActions,
    free,
    pro,
    recommended,
    recommendedTotalCents,
    savingsCents: Math.abs(free.totalCents - pro.totalCents),
    effectiveRateBps:
      gmvCents > 0
        ? Math.round((recommendedTotalCents * 10_000) / gmvCents)
        : 0,
    proBreakevenGmvCents: suiteProBreakevenGmvCents(),
  };
}

/**
 * Convenience for the public calculator: quote from GMV alone, deriving AI
 * usage unless the caller overrides it.
 */
export function quoteSuiteUsageFromGmv(
  gmvCents: number,
  aiActionsOverride?: number,
): SuiteUsageQuote {
  const aiActions =
    aiActionsOverride != null && Number.isFinite(aiActionsOverride)
      ? aiActionsOverride
      : deriveAiActionsFromGmv(gmvCents);
  return quoteSuiteUsage({ gmvCents, aiActions });
}
