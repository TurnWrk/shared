/**
 * Suite SaaS commercial catalog — single source of truth for product SKUs,
 * list prices, multi-product bundle %, volume tiers, and trial length.
 *
 * Money is integer USD cents. Stripe Product/Price IDs are env-wired in
 * hostfix (`lib/billing/`); this module never talks to Stripe.
 *
 * Commercial terms (Alan 2026-07-22 / TURNWRK-217):
 * - Three peer products: Dispatch $6, Restock $3, Clean $4 (per unit / mo)
 * - Any two or more → flat 18% off the combined list (not a fixed $7.40 SKU)
 * - Volume % by unit count on the post-bundle subtotal
 * - No account monthly minimum
 */

/** Canonical suite product SKUs (Stripe Price metadata `turnwrk_plan_sku`). */
export type SuiteProductSku = 'dispatch' | 'restock' | 'clean';

/**
 * @deprecated Prefer `SuiteProductSku`. Legacy Checkout used a fixed Bundle
 * Price and Clean-as-addon SKU; new quotes select products multi-select.
 */
export type SuitePlanSku = SuiteProductSku | 'bundle' | 'clean_addon';

export interface SuiteProductDefinition {
  sku: SuiteProductSku;
  /** Marketing / invoice line label. */
  name: string;
  /** USD cents per billable unit per month (licensed quantity). */
  unitAmountCents: number;
  /** Which `Org.enabledApps` this product unlocks when active. */
  enablesApps: ReadonlyArray<'hostfixCmms' | 'restock' | 'clean'>;
  /** Short note for docs / Portal. */
  notes?: string;
}

/** List prices ($ / unit / month) — commercial terms 2026-07-22. */
export const SUITE_PRODUCTS: Readonly<Record<SuiteProductSku, SuiteProductDefinition>> =
  {
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
    clean: {
      sku: 'clean',
      name: 'Clean',
      unitAmountCents: 400,
      enablesApps: ['clean'],
      notes: 'Operator self-clean SaaS; Clean marketplace Connect is separate',
    },
  } as const;

/**
 * @deprecated Alias of SUITE_PRODUCTS for older imports. Does not include the
 * retired fixed `bundle` / `clean_addon` Price SKUs.
 */
export const SUITE_PLANS = SUITE_PRODUCTS;

/** Flat % off combined list when two or more products are selected. */
export const SUITE_BUNDLE_DISCOUNT_PCT = 18;

/** Stripe Coupon id for the multi-product bundle discount. */
export const SUITE_BUNDLE_COUPON_ID = 'suite_bundle_18';

/**
 * Flat volume discount by total billable units on the account (INDEX/MATCH).
 * Applied to the whole subscription subtotal after the bundle discount.
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

/**
 * @deprecated Account monthly minimum removed (TURNWRK-217). Kept as 0 so
 * older minimum top-up helpers no-op instead of throwing.
 */
export const SUITE_MONTHLY_MINIMUM_CENTS = 0;

/** Free trial length for suite SaaS Checkout / Org.billing.trialEndsAt. */
export const SUITE_TRIAL_DAYS = 45;

/** Stripe Coupon id prefix for volume % tiers (`suite_vol_5` …). */
export const SUITE_VOLUME_COUPON_ID_PREFIX = 'suite_vol_';

/**
 * @deprecated Minimum top-up removed; webhook helpers should not create items.
 */
export const SUITE_MINIMUM_TOPUP_DESCRIPTION = 'Monthly minimum commitment';

export function suiteVolumeCouponId(discountPct: number): string {
  if (discountPct <= 0) return '';
  return `${SUITE_VOLUME_COUPON_ID_PREFIX}${discountPct}`;
}

export function suiteBundleCouponId(bundleApplied: boolean): string {
  return bundleApplied ? SUITE_BUNDLE_COUPON_ID : '';
}

/**
 * Env var names for live Stripe Price IDs (hostfix suite Billing).
 * Only the three list-price products — bundle is a Coupon, not a Price.
 */
export const SUITE_STRIPE_PRICE_ENV_KEYS: Readonly<
  Record<SuiteProductSku, string>
> = {
  dispatch: 'STRIPE_PRICE_DISPATCH',
  restock: 'STRIPE_PRICE_RESTOCK',
  clean: 'STRIPE_PRICE_CLEAN',
};

/**
 * Legacy env keys still present in some App Hosting configs.
 * Prefer `SUITE_STRIPE_PRICE_ENV_KEYS`; map Clean via either name.
 */
export const SUITE_STRIPE_PRICE_ENV_KEYS_LEGACY = {
  /** Fixed Dispatch+Restock Price — retired; do not use for new Checkout. */
  bundle: 'STRIPE_PRICE_BUNDLE',
  /** Renamed to STRIPE_PRICE_CLEAN; either env name resolves Clean. */
  clean_addon: 'STRIPE_PRICE_CLEAN_ADDON',
} as const;
