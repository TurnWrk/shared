/**
 * Stripe Connect contract for the suite — **direct charges**.
 *
 * Business shape: each org connects its own Stripe account and is the merchant
 * of record for its customers' payments. Turnwrk is the platform and earns an
 * `application_fee_amount` on each charge (rates in `./usageModel`).
 *
 * **Charge pattern: DIRECT.** The charge is created *on* the connected account
 * (`{ stripeAccount }` request option / `Stripe-Account` header). Consequences,
 * all of them deliberate:
 *
 * - **Funds never enter the platform balance.** They land in the operator's
 *   balance and pay out on their schedule, to their bank.
 * - **Customers and PaymentMethods are per-connected-account.** Create them on
 *   the connected account from the start.
 * - **Client-side Elements must be initialised with the account**:
 *   `loadStripe(pk, { stripeAccount })`.
 * - **Webhook events for connected-account activity** carry an `account` field
 *   and require a separate Connect endpoint (`STRIPE_CONNECT_WEBHOOK_SECRET`).
 * - **Refunds must set `refund_application_fee` deliberately.** Default: refund
 *   the fee.
 *
 * ## Controller (ratified 2026-08-05, interim)
 *
 * Express dashboard requires `fees_collector=application` AND
 * `losses_collector=application` (Stripe API error
 * `account_controller_express_dash_without_application_losses_or_fees`). So for
 * now Practical Works **owns negative-balance liability** and fee pricing.
 *
 * Because the platform pays Stripe's card processing fees under
 * `fees_collector=application`, every charge MUST recover them inside
 * `application_fee_amount` (= take-rate + estimated processing). Otherwise a
 * 60–100 bps take-rate is wiped by ~2.9% + $0.30. See
 * {@link applicationFeeForDirectCharge}.
 *
 * Long-term exit (chargeback-safe SaaS path): Full Dashboard +
 * `fees_collector=stripe` + `losses_collector=stripe` + direct. Dashboard type
 * is immutable per account — new accounts only.
 *
 * Naming note: the `CLEAN_CONNECT_*` prefix predates the suite-wide migration.
 * This contract governs Clean, Dispatch/Trades and the route verticals alike.
 *
 * Constants + pure fee math — this module never talks to Stripe.
 */

import { SUITE_USAGE_MODEL } from './usageModel';

export const CLEAN_CONNECT_SURFACE = 'clean_connect' as const;

/**
 * Accounts v2 controller defaults — Express + platform fees/losses (interim).
 * Locked by `tests/billing/connect.test.ts`.
 */
export const CLEAN_CONNECT_ACCOUNT_DEFAULTS = {
  dashboard: 'express',
  /**
   * Platform owns pricing / Stripe bills the platform for processing.
   * Recover processing inside `application_fee_amount` — see fee helpers.
   */
  feesCollector: 'application',
  /** Platform owns negative-balance liability (Express requirement). */
  lossesCollector: 'application',
  /** Charge created ON the connected account; funds never touch the platform. */
  chargePattern: 'direct',
  /** Embedded components to ship with Express. */
  embeddedComponents: [
    'account_onboarding',
    'notification_banner',
    'account_management',
    'payments',
    'payouts',
  ] as const,
} as const;

/**
 * US card processing estimate used to recover Stripe fees when the platform is
 * the fee payer. Not a quote of Stripe's exact invoice line — close enough that
 * the take-rate survives. Revisit per-region when we expand.
 */
export const STRIPE_US_CARD_PROCESSING = {
  rateBps: 290,
  fixedCents: 30,
} as const;

/** Env keys for Connect. Suite Pro subscription uses STRIPE_SUITE_* in dispatch. */
export const CLEAN_CONNECT_ENV_KEYS = {
  /** Platform secret key. Direct charges scope per call, not per key. */
  secretKey: 'STRIPE_SECRET_KEY',
  /** MUST differ from the platform-account job webhook secret. */
  webhookSecret: 'STRIPE_CONNECT_WEBHOOK_SECRET',
  publishableKey: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  /** Optional platform profile / Connect settings. */
  clientId: 'STRIPE_CONNECT_CLIENT_ID',
} as const;

/** Firestore field names to stamp on Org.cleanSettings when Connect lands. */
export const CLEAN_CONNECT_ORG_FIELDS = {
  stripeConnectAccountId: 'stripeConnectAccountId',
  stripeConnectChargesEnabled: 'stripeConnectChargesEnabled',
  stripeConnectPayoutsEnabled: 'stripeConnectPayoutsEnabled',
  stripeConnectOnboardingComplete: 'stripeConnectOnboardingComplete',
} as const;

/** A Stripe connected-account id (`acct_…`). */
export type ConnectedAccountRef = string;

/**
 * Take-rate bps for an org's suite plan. Only `pro` gets the Pro rate; trial /
 * comp / free / unknown all use the Free take-rate (never invent a discount).
 */
export function suitePaymentRateBpsForPlan(planId: string | null | undefined): number {
  return planId === 'pro'
    ? SUITE_USAGE_MODEL.proPaymentRateBps
    : SUITE_USAGE_MODEL.freePaymentRateBps;
}

/** Estimated Stripe card processing fee for a charge amount (integer cents). */
export function estimateStripeCardProcessingFeeCents(amountCents: number): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  const amount = Math.floor(amountCents);
  return (
    Math.round((amount * STRIPE_US_CARD_PROCESSING.rateBps) / 10_000) +
    STRIPE_US_CARD_PROCESSING.fixedCents
  );
}

export interface ApplicationFeeBreakdown {
  /** Turnwrk take-rate (bps × amount). */
  takeRateCents: number;
  /** Estimated Stripe processing recovered because platform is fee payer. */
  processingFeeCents: number;
  /** Sum, capped at the charge amount (Stripe rejects a fee ≥ charge). */
  applicationFeeCents: number;
  paymentRateBps: number;
}

/**
 * `application_fee_amount` for a direct charge under the interim Express
 * controller: take-rate + estimated card processing.
 *
 * When `fees_collector=application`, Stripe bills Practical Works for
 * processing. Without recovering that inside the application fee, a 60–100 bps
 * take-rate is negative on every card charge.
 */
export function applicationFeeForDirectCharge(input: {
  amountCents: number;
  planId?: string | null;
}): ApplicationFeeBreakdown {
  const amountCents =
    Number.isFinite(input.amountCents) && input.amountCents > 0
      ? Math.floor(input.amountCents)
      : 0;
  const paymentRateBps = suitePaymentRateBpsForPlan(input.planId);
  const takeRateCents = Math.round((amountCents * paymentRateBps) / 10_000);
  const processingFeeCents = estimateStripeCardProcessingFeeCents(amountCents);
  const applicationFeeCents = Math.min(amountCents, takeRateCents + processingFeeCents);
  return {
    takeRateCents,
    processingFeeCents,
    applicationFeeCents,
    paymentRateBps,
  };
}

/**
 * Guard every operator-money Stripe call. Throws rather than returning a
 * fallback: without an account id a direct charge silently becomes a PLATFORM
 * charge, which puts the operator's money in our balance and their chargebacks
 * on our books — the exact failure this whole pattern exists to prevent.
 * Fail loud, at the call site, always.
 */
export function assertConnectedAccount(
  accountRef: string | null | undefined,
  context: string,
): ConnectedAccountRef {
  const ref = accountRef?.trim();
  if (!ref) {
    throw new Error(
      `[connect] ${context}: missing connected account id. Refusing to fall back ` +
        `to the platform account — a direct charge without stripeAccount charges ` +
        `Turnwrk instead of the operator.`,
    );
  }
  if (!ref.startsWith('acct_')) {
    throw new Error(`[connect] ${context}: expected an acct_… id, got "${ref}".`);
  }
  return ref;
}
