/**
 * Operator Connect onboarding disclosure + affirmative consent (TURNWRK-311).
 *
 * Canonical copy for the hard checkbox before Stripe Account Links and for
 * durable terms on the website. Entity name is a placeholder until
 * TURNWRK-447 lands — version + textHash pin exactly what the operator saw.
 *
 * Framing: "your account, your schedule" — direct settlement to the operator's
 * own Stripe balance on their payout schedule; refunds and disputes settle
 * against that balance. No holds/reserves claims.
 */

/** Bump when disclosure copy changes; stored on every acceptance record. */
export const CONNECT_OPERATOR_TERMS_VERSION = '2026-08-placeholder-v1';

/**
 * Replace with the confirmed legal entity from TURNWRK-447 before publish.
 * Included in the canonical text hash so acceptance evidence pins the name shown.
 */
export const CONNECT_OPERATOR_PLATFORM_ENTITY_PLACEHOLDER = '[PLATFORM_ENTITY]';

export const CONNECT_OPERATOR_DISCLOSURE_HEADLINE = 'Your account, your schedule';

export const CONNECT_OPERATOR_DISCLOSURE_BULLETS: readonly string[] = [
  'Customer payments settle to your Stripe balance and pay out to your bank on the schedule you control.',
  `${CONNECT_OPERATOR_PLATFORM_ENTITY_PLACEHOLDER} never holds your funds — direct settlement to your own Stripe account.`,
  "Card processing fees and Turnwrk's platform take-rate are deducted from each charge.",
  'Customer refunds and payment disputes settle against your Stripe balance — you handle them in Stripe Express.',
];

/** Checkbox label — must match what the operator affirms before onboarding. */
export const CONNECT_OPERATOR_ACCEPTANCE_LABEL =
  'I understand customer payments settle to my Stripe account on my payout schedule, Turnwrk never holds my funds, and customer refunds and disputes settle against my Stripe balance.';

/**
 * Stable string hashed for acceptance evidence. Callers compare against
 * {@link CONNECT_OPERATOR_TERMS_TEXT_HASH} — do not invent a separate hash.
 */
export function connectOperatorTermsCanonicalText(): string {
  return [
    CONNECT_OPERATOR_TERMS_VERSION,
    CONNECT_OPERATOR_PLATFORM_ENTITY_PLACEHOLDER,
    CONNECT_OPERATOR_DISCLOSURE_HEADLINE,
    ...CONNECT_OPERATOR_DISCLOSURE_BULLETS,
    CONNECT_OPERATOR_ACCEPTANCE_LABEL,
  ].join('\n');
}

/**
 * SHA-256 hex of {@link connectOperatorTermsCanonicalText}. Locked by
 * `tests/billing/connectOperatorTerms.test.ts`.
 */
export const CONNECT_OPERATOR_TERMS_TEXT_HASH =
  'c8f61fb9f7beeaf621b2276d52fbb55eafee5ceedc58e67a870dfa7388de9255';

/** Firestore shape for an affirmative Connect disclosure acceptance. */
export interface ConnectOperatorTermsAcceptance {
  orgId: string;
  userId: string;
  termsVersion: string;
  textHash: string;
  /** ISO-8601 UTC instant (Soul: UTC in storage). */
  acceptedAt: string;
  /** Connect surface tag — dispatch_connect | clean_connect. */
  surface: string;
}

/** Doc id: one acceptance row per org per terms version. */
export function connectOperatorTermsAcceptanceDocId(orgId: string, termsVersion: string): string {
  const org = orgId.trim();
  const version = termsVersion.trim();
  if (!org || !version) {
    throw new Error('[connectOperatorTerms] orgId and termsVersion are required for doc id.');
  }
  return `${org}_${version}`;
}
