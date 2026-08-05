/**
 * Referral attribution (TURNWRK-288) — types only; mint/redeem IO lives in apps.
 *
 * A positive review mints a shareable token scoped to org + referrer customer.
 * Redeeming creates a Customer with `source: 'referral'` and
 * `referredByCustomerId`. No third-party lead marketplace.
 */

/** Firestore doc shape for `svc_referralLinks` (doc id === token). */
export interface ReferralLink {
  /** Bearer token; also the document id. */
  id: string;
  orgId: string;
  /** Customer who shared the link (the reviewer). */
  referrerCustomerId: string;
  /** Review that triggered the ask, when minted from a rating. */
  reviewId?: string;
  createdAt: number;
  /** How many attributed customers redeemed this token. */
  redeemedCount: number;
}

export const REFERRAL_PATH_PREFIX = '/r';

/** Public path for a referral token on the Clean (or booking) host. */
export function referralPublicPath(token: string): string {
  const t = token.trim();
  if (!t) throw new Error('referral token required');
  return `${REFERRAL_PATH_PREFIX}/${encodeURIComponent(t)}`;
}
