/**
 * Stripe Billing shape for Turnwrk suite SaaS (not Clean job payments).
 *
 * Model (Stripe-idiomatic for licensed SaaS + account-wide % + floor):
 *
 * 1. **Products / Prices** — one Product per plan SKU; recurring Price
 *    `unit_amount` = catalog cents, `billing_scheme: per_unit`, monthly.
 *    Quantity on the Subscription Item = billable property count.
 *    Bundle is a single Price (not Dispatch+Restock line items stacked).
 *
 * 2. **Volume discount** — Stripe Coupons with `percent_off` matching
 *    SUITE_VOLUME_TIERS (ids `suite_vol_5` … `suite_vol_25`). When unit
 *    count crosses a tier, update the subscription's discount to the
 *    matching coupon (or clear it at 0%). Avoids Metronome / meters —
 *    quantity is known, not usage-based.
 *
 * 3. **$27 monthly minimum** — on `invoice.created` (draft) for suite
 *    subscriptions, if discounted line total < SUITE_MONTHLY_MINIMUM_CENTS,
 *    add an invoice item for the shortfall
 *    (`SUITE_MINIMUM_TOPUP_DESCRIPTION`). Pure quote math lives in
 *    `quoteSuiteSubscription` so Checkout previews match invoices.
 *
 * 4. **45-day trial** — Checkout `subscription_data.trial_period_days`
 *    = SUITE_TRIAL_DAYS; stamp `Org.billing.trialEndsAt` from the
 *    Subscription trial end webhook.
 *
 * 5. **Customer Portal** — self-serve payment method + cancel; plan/
 *    quantity changes stay app-owned (entitlements + unit sync).
 *
 * Runtime lives in hostfix-cmms (`lib/billing/`, `/api/webhooks/suite-stripe`).
 * Clean Connect is a separate Stripe surface (`clean/…/connect/`).
 */

import {
  SUITE_PLANS,
  SUITE_STRIPE_PRICE_ENV_KEYS,
  SUITE_TRIAL_DAYS,
  SUITE_VOLUME_TIERS,
  suiteVolumeCouponId,
  type SuitePlanSku,
} from './catalog';

/** Metadata keys stamped on Stripe Customer / Subscription / Checkout. */
export const SUITE_STRIPE_METADATA = {
  orgId: 'turnwrk_org_id',
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

export interface SuiteStripePriceSpec {
  sku: SuitePlanSku;
  productName: string;
  unitAmountCents: number;
  envKey: string;
  interval: 'month';
  nickname: string;
}

export function suiteStripePriceSpecs(): SuiteStripePriceSpec[] {
  return (Object.keys(SUITE_PLANS) as SuitePlanSku[]).map((sku) => {
    const plan = SUITE_PLANS[sku];
    return {
      sku,
      productName: `Turnwrk ${plan.name}`,
      unitAmountCents: plan.unitAmountCents,
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
