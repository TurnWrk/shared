/**
 * Clean Stripe Connect groundwork (marketplace / payouts) — separate from
 * suite SaaS Billing on Org.billing.
 *
 * Business shape: Clean operators collect from homeowners on the booking /
 * invoice surfaces and disburse to cleaners. Turnwrk is the platform;
 * each Clean org becomes a connected account.
 *
 * Recommended Accounts v2 configuration (Connect recommend skill):
 * - dashboard: "express" (Stripe Express + embedded onboarding)
 * - fees_collector: "application" (platform sets pricing / application fee)
 * - losses_collector: "application" (required for destination charge reversals)
 * - charge pattern: destination charges (platform Checkout / PaymentIntents
 *   with transfer_data.destination = connected account)
 *
 * Do NOT reuse Clean's existing platform-account PaymentIntents webhook
 * (`POST /api/webhooks/stripe`) for Connect account events — add a Connect
 * endpoint (or Connect-aware branching) when wiring onboarding.
 */

export const CLEAN_CONNECT_SURFACE = 'clean_connect' as const;

/** Accounts v2 controller defaults — document intent for implementers. */
export const CLEAN_CONNECT_ACCOUNT_DEFAULTS = {
  dashboard: 'express',
  feesCollector: 'application',
  lossesCollector: 'application',
  chargePattern: 'destination',
  /** Embedded components to ship with Express. */
  embeddedComponents: [
    'account_onboarding',
    'notification_banner',
    'account_management',
    'payments',
    'payouts',
  ] as const,
} as const;

/** Env keys for Connect (Clean app). Suite SaaS uses STRIPE_SUITE_* in hostfix. */
export const CLEAN_CONNECT_ENV_KEYS = {
  /** Same secret as job payments is OK in test; prefer restricted key in prod. */
  secretKey: 'STRIPE_SECRET_KEY',
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
