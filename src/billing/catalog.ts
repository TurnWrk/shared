/**
 * Suite SaaS commercial catalog — single source of truth for plan SKUs,
 * list prices, volume tiers, trial length, and monthly minimum.
 *
 * Money is integer USD cents. Stripe Product/Price IDs are env-wired in
 * hostfix (`lib/billing/`); this module never talks to Stripe.
 */

/** Canonical suite plan SKUs (Stripe Price metadata `plan_sku`). */
export type SuitePlanSku =
  | 'dispatch'
  | 'restock'
  | 'bundle'
  | 'clean_addon';

export interface SuitePlanDefinition {
  sku: SuitePlanSku;
  /** Marketing / invoice line label. */
  name: string;
  /** USD cents per billable unit per month (licensed quantity). */
  unitAmountCents: number;
  /**
   * Which `Org.enabledApps` this plan unlocks when active.
   * Bundle unlocks Dispatch + Restock; clean_addon only Clean.
   */
  enablesApps: ReadonlyArray<'hostfixCmms' | 'restock' | 'clean'>;
  /** Short note for docs / Portal. */
  notes?: string;
}

/** List prices ($ / unit / month) — commercial terms 2026-07. */
export const SUITE_PLANS: Readonly<Record<SuitePlanSku, SuitePlanDefinition>> = {
  dispatch: {
    sku: 'dispatch',
    name: 'Dispatch',
    unitAmountCents: 600,
    enablesApps: ['hostfixCmms'],
    notes: 'Maintenance ops / hostfix-cmms — core wedge',
  },
  restock: {
    sku: 'restock',
    name: 'Restock',
    unitAmountCents: 300,
    enablesApps: ['restock'],
    notes: 'Supplies — may be discounted further if affiliate revenue holds',
  },
  bundle: {
    sku: 'bundle',
    name: 'Dispatch + Restock',
    unitAmountCents: 740,
    enablesApps: ['hostfixCmms', 'restock'],
    notes: '~18% off buying Dispatch + Restock separately; headline suite price',
  },
  clean_addon: {
    sku: 'clean_addon',
    name: 'Clean add-on',
    unitAmountCents: 400,
    enablesApps: ['clean'],
    notes: 'Optional operator self-clean SaaS; Clean marketplace Connect is separate',
  },
} as const;

/**
 * Flat volume discount by total billable units on the account (INDEX/MATCH).
 * Applied to the whole subscription subtotal after plan selection.
 */
export interface SuiteVolumeTier {
  /** Inclusive lower bound on unit count. */
  minUnits: number;
  /** Percent off (0–100), e.g. 15 = 15%. */
  discountPct: number;
}

export const SUITE_VOLUME_TIERS: readonly SuiteVolumeTier[] = [
  { minUnits: 1, discountPct: 0 },
  { minUnits: 10, discountPct: 5 },
  { minUnits: 25, discountPct: 10 },
  { minUnits: 50, discountPct: 15 },
  { minUnits: 150, discountPct: 20 },
  { minUnits: 250, discountPct: 25 },
] as const;

/** Account monthly minimum after volume discount (USD cents). */
export const SUITE_MONTHLY_MINIMUM_CENTS = 2700;

/** Free trial length for suite SaaS Checkout / Org.billing.trialEndsAt. */
export const SUITE_TRIAL_DAYS = 45;

/** Stripe Coupon id prefix for volume % tiers (`suite_vol_5` …). */
export const SUITE_VOLUME_COUPON_ID_PREFIX = 'suite_vol_';

/** Invoice item description when topping up to the monthly minimum. */
export const SUITE_MINIMUM_TOPUP_DESCRIPTION = 'Monthly minimum commitment';

export function suiteVolumeCouponId(discountPct: number): string {
  if (discountPct <= 0) return '';
  return `${SUITE_VOLUME_COUPON_ID_PREFIX}${discountPct}`;
}

/**
 * Env var names for live Stripe Price IDs (hostfix suite Billing).
 * Create Prices in Dashboard (or script) then set these secrets.
 */
export const SUITE_STRIPE_PRICE_ENV_KEYS: Readonly<Record<SuitePlanSku, string>> = {
  dispatch: 'STRIPE_PRICE_DISPATCH',
  restock: 'STRIPE_PRICE_RESTOCK',
  bundle: 'STRIPE_PRICE_BUNDLE',
  clean_addon: 'STRIPE_PRICE_CLEAN_ADDON',
};
