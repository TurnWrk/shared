/**
 * Stripe Connect contract for the suite — **direct charges**.
 *
 * Business shape: each org connects its own Stripe account and is the merchant
 * of record for its customers' payments. Turnwrk is the platform and earns only
 * an `application_fee_amount` on each charge (rates in `./usageModel`).
 *
 * **Charge pattern: DIRECT.** The charge is created *on* the connected account
 * (`{ stripeAccount }` request option / `Stripe-Account` header). Consequences,
 * all of them deliberate:
 *
 * - **Funds never enter the platform balance.** They land in the operator's
 *   balance and pay out on their schedule, to their bank.
 * - **Dispute and refund liability sits with the connected account**, not with
 *   Turnwrk. This is the reason for the pattern: a 60–100 bps take-rate cannot
 *   carry unbounded chargeback exposure across cleaning, trades and route work.
 * - **Stripe's processing fee bills the operator's account**, which is what the
 *   public pricing page already tells them ("the processor's own fee passes
 *   straight through and is never ours").
 * - **Customers and PaymentMethods are per-connected-account.** A Customer
 *   vaulted on the platform CANNOT be charged on a connected account without
 *   cloning the payment method. Create them on the connected account from the
 *   start — card-on-file, pre-auth and hold→capture all work there.
 * - **Client-side Elements must be initialised with the account**:
 *   `loadStripe(pk, { stripeAccount })`. A direct-charge client secret does not
 *   resolve against the platform.
 * - **Webhook events are delivered to the connected account** and carry an
 *   `account` field. They do NOT arrive on the platform-account endpoint, so a
 *   Connect endpoint is required — do not extend Clean's job-payment webhook
 *   (`POST /api/webhooks/stripe`), and keep `STRIPE_CONNECT_WEBHOOK_SECRET`
 *   distinct from it and from the suite subscription webhook.
 * - **Refunds must set `refund_application_fee` deliberately.** Default: refund
 *   the fee. Keeping a take-rate on money the customer got back is indefensible.
 *
 * Rejected alternative: destination charges (`transfer_data.destination`). Funds
 * pass through the platform balance and the PLATFORM carries dispute liability
 * by default. Decided against 2026-07-28 — see docs/projects/PRICING-AND-PAYMENTS.md.
 *
 * Naming note: the `CLEAN_CONNECT_*` prefix predates the suite-wide migration.
 * This contract governs Clean, Dispatch/Trades and the route verticals alike;
 * the rename rides with the shared foundation build (TURNWRK-300).
 *
 * Constants only — this module never talks to Stripe.
 */

export const CLEAN_CONNECT_SURFACE = 'clean_connect' as const;

/**
 * Accounts v2 controller defaults — document intent for implementers.
 *
 * `losses.payments = 'stripe'` is the whole point: losses settle against the
 * connected account. Pairing it with an Express dashboard is the intended
 * configuration, but Stripe constrains which controller combinations are legal
 * and those constraints move with the API version — **verify against the pinned
 * version before relying on this**, do not assume it from these constants.
 */
export const CLEAN_CONNECT_ACCOUNT_DEFAULTS = {
  dashboard: 'express',
  /** Operator's account pays Stripe's processing fee (direct charges). */
  feesCollector: 'account',
  /** Operator's account carries chargebacks and refund losses. */
  lossesCollector: 'stripe',
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
