/**
 * Pure suite quote engine — product multi-select × 18% bundle × volume %.
 * Callers (Checkout builders, Portal previews, website calculators) use this;
 * Stripe Coupons (bundle + volume) mirror the same math at invoice time.
 * No account monthly minimum (TURNWRK-217).
 */

import {
  SUITE_BUNDLE_DISCOUNT_PCT,
  SUITE_PRODUCTS,
  SUITE_VOLUME_TIERS,
  suiteBundleCouponId,
  suiteVolumeCouponId,
  type SuiteProductSku,
} from './catalog';

export interface SuiteQuoteSelection {
  /** One or more suite products (Dispatch / Restock / Clean). */
  products: readonly SuiteProductSku[];
  /** Billable units (properties) on the account. */
  unitCount: number;
}

export interface SuiteQuoteLine {
  /** Product SKU, or `bundle` when 2+ products collapse for display. */
  sku: SuiteProductSku | 'bundle';
  name: string;
  unitAmountCents: number;
  quantity: number;
  lineSubtotalCents: number;
  /** Set on the display bundle line. */
  bundleDiscountPct?: number;
}

export interface SuiteQuote {
  /** Normalized unique products used for the quote. */
  products: SuiteProductSku[];
  /**
   * Stripe Checkout line items — always list-price rows (one per product).
   * Bundle/volume discounts attach as Coupons, not reduced Prices.
   */
  checkoutLines: SuiteQuoteLine[];
  /**
   * Display lines: single product at list, or one combined bundle line at
   * 18% off when two or more products are selected (matches website).
   */
  lines: SuiteQuoteLine[];
  /** True list subtotal before bundle (sum of product list × units). */
  trueListSubtotalCents: number;
  /** Subtotal after bundle %, before volume (equals lines sum). */
  listSubtotalCents: number;
  unitCount: number;
  bundleApplied: boolean;
  bundleDiscountPct: number;
  /** Stripe Coupon id `suite_bundle_18` when bundleApplied; else empty. */
  bundleCouponId: string;
  bundleDiscountCents: number;
  volumeDiscountPct: number;
  /** Stripe Coupon id to attach when discountPct > 0; empty when none. */
  volumeCouponId: string;
  volumeDiscountCents: number;
  /** listSubtotal − volumeDiscount. */
  discountedSubtotalCents: number;
  /**
   * @deprecated Always 0 — monthly minimum removed (TURNWRK-217).
   */
  minimumTopUpCents: number;
  /** Amount due before tax (post bundle + volume). */
  amountDueCents: number;
  currency: 'usd';
}

function pctOf(amountCents: number, pct: number): number {
  return Math.round((amountCents * pct) / 100);
}

function uniqueProducts(products: readonly SuiteProductSku[]): SuiteProductSku[] {
  const order: SuiteProductSku[] = ['dispatch', 'restock', 'clean'];
  const set = new Set(products);
  return order.filter((sku) => set.has(sku));
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
 * Quote a suite subscription for selected products × `unitCount` properties.
 * Throws if unitCount < 1 or products is empty / contains unknown SKUs.
 */
export function quoteSuiteSubscription(selection: SuiteQuoteSelection): SuiteQuote {
  const unitCount = Math.trunc(selection.unitCount);
  if (!Number.isFinite(unitCount) || unitCount < 1) {
    throw new Error('unitCount must be an integer ≥ 1');
  }

  const products = uniqueProducts(selection.products ?? []);
  if (products.length === 0) {
    throw new Error('products must include at least one of dispatch|restock|clean');
  }
  for (const sku of selection.products) {
    if (!SUITE_PRODUCTS[sku as SuiteProductSku]) {
      throw new Error(`Invalid product sku: ${sku}`);
    }
  }

  const checkoutLines: SuiteQuoteLine[] = products.map((sku) => {
    const product = SUITE_PRODUCTS[sku];
    return {
      sku: product.sku,
      name: product.name,
      unitAmountCents: product.unitAmountCents,
      quantity: unitCount,
      lineSubtotalCents: product.unitAmountCents * unitCount,
    };
  });

  const trueListSubtotalCents = checkoutLines.reduce(
    (sum, l) => sum + l.lineSubtotalCents,
    0,
  );
  const trueListPerUnitCents = products.reduce(
    (sum, sku) => sum + SUITE_PRODUCTS[sku].unitAmountCents,
    0,
  );

  const bundleApplied = products.length >= 2;
  const bundleDiscountPct = bundleApplied ? SUITE_BUNDLE_DISCOUNT_PCT : 0;
  const bundleDiscountCents = pctOf(trueListSubtotalCents, bundleDiscountPct);
  const listSubtotalCents = trueListSubtotalCents - bundleDiscountCents;

  let lines: SuiteQuoteLine[];
  if (bundleApplied) {
    const bundledPerUnitCents = Math.round(
      trueListPerUnitCents * (1 - SUITE_BUNDLE_DISCOUNT_PCT / 100),
    );
    lines = [
      {
        sku: 'bundle',
        name: products.map((sku) => SUITE_PRODUCTS[sku].name).join(' + '),
        unitAmountCents: bundledPerUnitCents,
        quantity: unitCount,
        lineSubtotalCents: listSubtotalCents,
        bundleDiscountPct: SUITE_BUNDLE_DISCOUNT_PCT,
      },
    ];
  } else {
    lines = checkoutLines;
  }

  const volumeDiscountPct = resolveVolumeDiscountPct(unitCount);
  const volumeDiscountCents = pctOf(listSubtotalCents, volumeDiscountPct);
  const discountedSubtotalCents = listSubtotalCents - volumeDiscountCents;

  return {
    products,
    checkoutLines,
    lines,
    trueListSubtotalCents,
    listSubtotalCents,
    unitCount,
    bundleApplied,
    bundleDiscountPct,
    bundleCouponId: suiteBundleCouponId(bundleApplied),
    bundleDiscountCents,
    volumeDiscountPct,
    volumeCouponId: suiteVolumeCouponId(volumeDiscountPct),
    volumeDiscountCents,
    discountedSubtotalCents,
    minimumTopUpCents: 0,
    amountDueCents: discountedSubtotalCents,
    currency: 'usd',
  };
}

/**
 * Convenience: quote from a set of product flags (Checkout / admin UI).
 */
export function quoteSuiteFromFlags(input: {
  unitCount: number;
  dispatch?: boolean;
  restock?: boolean;
  clean?: boolean;
}): SuiteQuote {
  const products: SuiteProductSku[] = [];
  if (input.dispatch) products.push('dispatch');
  if (input.restock) products.push('restock');
  if (input.clean) products.push('clean');
  return quoteSuiteSubscription({ products, unitCount: input.unitCount });
}
