/**
 * Stripe Billing shape for Turnwrk suite SaaS (not Clean job payments).
 *
 * Model (Alan 2026-07-22 / TURNWRK-217 — matches website calculator):
 *
 * 1. **Products / Prices** — one Product per peer product (Dispatch, Restock,
 *    Clean); recurring Price `unit_amount` = catalog cents, `billing_scheme:
 *    per_unit`, monthly. Quantity on each Subscription Item = billable
 *    property count. There is **no** fixed Bundle Price for new Checkout.
 *
 * 2. **Multi-product bundle (18%)** — Stripe Coupon `suite_bundle_18`
 *    (`percent_off: 18`, forever) when two or more products are on the
 *    subscription. Attach alongside volume coupons via Checkout/Subscription
 *    `discounts: [{ coupon }, …]` (compound percent).
 *
 * 3. **Volume discount** — Coupons `suite_vol_5` … `suite_vol_25` matching
 *    SUITE_VOLUME_TIERS. When unit count crosses a tier, swap the volume
 *    coupon (keep or clear bundle coupon independently).
 *
 * 4. **No monthly minimum** — account floor removed; do not add invoice
 *    top-up items for suite SaaS.
 *
 * 5. **45-day trial** — Checkout `subscription_data.trial_period_days`
 *    = SUITE_TRIAL_DAYS; stamp `Org.billing.trialEndsAt` from the
 *    Subscription trial end webhook.
 *
 * 6. **Customer Portal** — self-serve payment method + cancel; product/
 *    quantity changes stay app-owned (entitlements + unit sync).
 *
 * Legacy on the shared Stripe account (leave alone — other flows / history):
 * - Fixed "Turnwrk Suite — Dispatch + Restock" Product/Price ($7.40) — retired
 * - Clean product may still be labeled "Clean add-on" in Dashboard; list
 *   Price amount is correct at $4/unit.
 *
 * Runtime lives in hostfix-cmms (`lib/billing/`, `/api/webhooks/suite-stripe`).
 * Clean Connect is a separate Stripe surface (`clean/…/connect/`).
 */

import {
  SUITE_BUNDLE_COUPON_ID,
  SUITE_BUNDLE_DISCOUNT_PCT,
  SUITE_PRODUCTS,
  SUITE_STRIPE_PRICE_ENV_KEYS,
  SUITE_TRIAL_DAYS,
  SUITE_VOLUME_TIERS,
  suiteVolumeCouponId,
  type SuiteProductSku,
} from './catalog';

/** Metadata keys stamped on Stripe Customer / Subscription / Checkout. */
export const SUITE_STRIPE_METADATA = {
  orgId: 'turnwrk_org_id',
  /** Comma-separated SuiteProductSku list, e.g. `dispatch,restock,clean`. */
  products: 'turnwrk_products',
  /** @deprecated Prefer `products`. Single primary SKU from the old model. */
  planSku: 'turnwrk_plan_sku',
  unitCount: 'turnwrk_unit_count',
  /** Discriminator so Clean job webhooks never process suite events. */
  billingSurface: 'turnwrk_billing_surface',
} as const;

export const SUITE_BILLING_SURFACE = 'suite_saas' as const;

export interface SuiteStripeCouponSpec {
  id: string;
  percentOff: number;
  name: string;
  duration: 'forever';
}

/** Specs to create once in Stripe (Dashboard or setup script). */
export function suiteVolumeCouponSpecs(): SuiteStripeCouponSpec[] {
  return SUITE_VOLUME_TIERS.filter((t) => t.discountPct > 0).map((t) => ({
    id: suiteVolumeCouponId(t.discountPct),
    percentOff: t.discountPct,
    name: `Suite volume ${t.discountPct}% (≥${t.minUnits} units)`,
    duration: 'forever' as const,
  }));
}

export function suiteBundleCouponSpec(): SuiteStripeCouponSpec {
  return {
    id: SUITE_BUNDLE_COUPON_ID,
    percentOff: SUITE_BUNDLE_DISCOUNT_PCT,
    name: `Suite bundle ${SUITE_BUNDLE_DISCOUNT_PCT}% (any 2+ products)`,
    duration: 'forever',
  };
}

/** Bundle + volume coupon specs for one-shot Stripe provisioning. */
export function suiteCouponSpecs(): SuiteStripeCouponSpec[] {
  return [suiteBundleCouponSpec(), ...suiteVolumeCouponSpecs()];
}

export interface SuiteStripePriceSpec {
  sku: SuiteProductSku;
  productName: string;
  unitAmountCents: number;
  envKey: string;
  interval: 'month';
  nickname: string;
}

export function suiteStripePriceSpecs(): SuiteStripePriceSpec[] {
  return (Object.keys(SUITE_PRODUCTS) as SuiteProductSku[]).map((sku) => {
    const product = SUITE_PRODUCTS[sku];
    return {
      sku,
      productName: `Turnwrk Suite — ${product.name}`,
      unitAmountCents: product.unitAmountCents,
      envKey: SUITE_STRIPE_PRICE_ENV_KEYS[sku],
      interval: 'month' as const,
      nickname: `${sku}_monthly`,
    };
  });
}

/** Checkout subscription_data defaults for suite SaaS. */
export function suiteCheckoutSubscriptionDefaults(): {
  trial_period_days: number;
  metadata: { turnwrk_billing_surface: typeof SUITE_BILLING_SURFACE };
} {
  return {
    trial_period_days: SUITE_TRIAL_DAYS,
    metadata: { turnwrk_billing_surface: SUITE_BILLING_SURFACE },
  };
}
