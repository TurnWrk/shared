/**
 * Pure suite quote engine — licensed per-unit list × volume % × $27 minimum.
 * Callers (Checkout builders, Portal previews, website calculators) use this;
 * Stripe Coupons + invoice top-ups mirror the same math at invoice time.
 */

import {
  SUITE_MONTHLY_MINIMUM_CENTS,
  SUITE_PLANS,
  SUITE_VOLUME_TIERS,
  suiteVolumeCouponId,
  type SuitePlanSku,
} from './catalog';

export interface SuiteQuoteSelection {
  /** Primary suite plan (dispatch | restock | bundle). */
  planSku: Exclude<SuitePlanSku, 'clean_addon'>;
  /** Billable units (properties) on the account. */
  unitCount: number;
  /** Optional Clean SaaS add-on at the same unit count. */
  includeCleanAddon?: boolean;
}

export interface SuiteQuoteLine {
  sku: SuitePlanSku;
  name: string;
  unitAmountCents: number;
  quantity: number;
  lineSubtotalCents: number;
}

export interface SuiteQuote {
  lines: SuiteQuoteLine[];
  /** Sum of line subtotals before volume discount. */
  listSubtotalCents: number;
  unitCount: number;
  volumeDiscountPct: number;
  /** Stripe Coupon id to attach when discountPct > 0; empty when none. */
  volumeCouponId: string;
  volumeDiscountCents: number;
  /** listSubtotal − volumeDiscount. */
  discountedSubtotalCents: number;
  /**
   * Extra invoice item amount so the customer pays at least the monthly
   * minimum. Zero when discounted subtotal already meets the floor.
   */
  minimumTopUpCents: number;
  /** Amount due before tax (discounted + minimum top-up). */
  amountDueCents: number;
  currency: 'usd';
}

function pctOf(amountCents: number, pct: number): number {
  return Math.round((amountCents * pct) / 100);
}

/**
 * INDEX/MATCH volume discount: highest tier whose minUnits ≤ unitCount.
 */
export function resolveVolumeDiscountPct(unitCount: number): number {
  const units = Math.max(0, Math.trunc(unitCount));
  let pct = 0;
  for (const tier of SUITE_VOLUME_TIERS) {
    if (units >= tier.minUnits) pct = tier.discountPct;
  }
  return pct;
}

/**
 * Quote a suite subscription for `unitCount` properties.
 * Throws if unitCount < 1 or planSku is invalid.
 */
export function quoteSuiteSubscription(selection: SuiteQuoteSelection): SuiteQuote {
  const unitCount = Math.trunc(selection.unitCount);
  if (!Number.isFinite(unitCount) || unitCount < 1) {
    throw new Error('unitCount must be an integer ≥ 1');
  }

  const plan = SUITE_PLANS[selection.planSku];
  if (!plan) {
    throw new Error(`Invalid primary planSku: ${selection.planSku}`);
  }

  const lines: SuiteQuoteLine[] = [
    {
      sku: plan.sku,
      name: plan.name,
      unitAmountCents: plan.unitAmountCents,
      quantity: unitCount,
      lineSubtotalCents: plan.unitAmountCents * unitCount,
    },
  ];

  if (selection.includeCleanAddon) {
    const addon = SUITE_PLANS.clean_addon;
    lines.push({
      sku: addon.sku,
      name: addon.name,
      unitAmountCents: addon.unitAmountCents,
      quantity: unitCount,
      lineSubtotalCents: addon.unitAmountCents * unitCount,
    });
  }

  const listSubtotalCents = lines.reduce((sum, l) => sum + l.lineSubtotalCents, 0);
  const volumeDiscountPct = resolveVolumeDiscountPct(unitCount);
  const volumeDiscountCents = pctOf(listSubtotalCents, volumeDiscountPct);
  const discountedSubtotalCents = listSubtotalCents - volumeDiscountCents;
  const minimumTopUpCents = Math.max(
    0,
    SUITE_MONTHLY_MINIMUM_CENTS - discountedSubtotalCents,
  );
  const amountDueCents = discountedSubtotalCents + minimumTopUpCents;

  return {
    lines,
    listSubtotalCents,
    unitCount,
    volumeDiscountPct,
    volumeCouponId: suiteVolumeCouponId(volumeDiscountPct),
    volumeDiscountCents,
    discountedSubtotalCents,
    minimumTopUpCents,
    amountDueCents,
    currency: 'usd',
  };
}
