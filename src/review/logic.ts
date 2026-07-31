/**
 * Pure review decisions and doc-shaping (Verticals — TURNWRK-340).
 *
 * No IO: the app server generates the token, reads for idempotency, commits the
 * batch, appends the event and sends the email. This module decides threshold
 * routing, resolves the party (dual-reading legacy `customerId`), and shapes
 * the request doc — the parts that must NOT drift between Clean and Dispatch.
 */
import type { Review, ReviewJobRef, ReviewParty, ReviewRouted } from './types';

/** Ratings at or above this route to a public prompt; below, a private alert. */
export const DEFAULT_REVIEW_THRESHOLD = 4;
/** Hours to wait after job completion before the request is due to send. */
export const DEFAULT_REVIEW_DELAY_HOURS = 4;

const HOUR_MS = 3_600_000;

/** Strip undefined values — Firestore rejects them. */
function pruned<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

/** Public prompt when the rating clears the threshold, otherwise a private alert. */
export function routeReview(rating: number, threshold = DEFAULT_REVIEW_THRESHOLD): ReviewRouted {
  return rating >= threshold ? 'public_prompt' : 'private_alert';
}

/**
 * Round and bound a submitted rating to 1..5. Throws on out-of-range input so
 * the caller never persists a nonsense score.
 */
export function validateRating(input: number): number {
  const rating = Math.round(input);
  if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5');
  return rating;
}

/** When the request becomes due to send. */
export function reviewRequestedAt(now: number, delayHours = DEFAULT_REVIEW_DELAY_HOURS): number {
  return now + delayHours * HOUR_MS;
}

/**
 * Resolve who a review is for, dual-reading legacy docs: prefer the new
 * {@link ReviewParty}, else synthesize one from the legacy `customerId`. Returns
 * an empty party (honest attribution gap) when neither is present.
 */
export function resolveReviewParty(review: Pick<Review, 'party' | 'customerId'>): ReviewParty {
  if (review.party) return review.party;
  if (review.customerId) return { customerId: review.customerId };
  return {};
}

/**
 * The event/audit actor for a review response. `customer:<id>` when a customer
 * is known (new party or legacy field), else `party:anonymous` — the flow no
 * longer assumes a customer record exists.
 */
export function reviewActorId(review: Pick<Review, 'party' | 'customerId'>): string {
  const customerId = review.party?.customerId ?? review.customerId;
  return customerId ? `customer:${customerId}` : 'party:anonymous';
}

export interface BuildReviewRequestInput {
  orgId: string;
  token: string;
  /** now epoch ms — passed in so this stays pure/deterministic. */
  now: number;
  delayHours?: number;
  /** The job under review (new key). */
  jobRef?: ReviewJobRef;
  /** Who is being asked (degrades honestly). */
  party?: ReviewParty;
  /** @deprecated legacy path — set only when requesting a review for an existing clean booking. */
  bookingId?: string;
  /** @deprecated legacy path — the booking's customer, when known. */
  customerId?: string;
}

/**
 * Shape a new review request doc (minus its id). Keyed on `jobRef` + `party`,
 * carrying `bookingId` / `customerId` only when a legacy caller supplies them.
 * Undefined fields are pruned so nothing invalid reaches Firestore.
 */
export function buildReviewRequest(input: BuildReviewRequestInput): Omit<Review, 'id'> {
  const now = input.now;
  const party = input.party ? pruned({ ...input.party }) : undefined;
  return pruned({
    orgId: input.orgId,
    jobRef: input.jobRef,
    party: party && Object.keys(party).length > 0 ? (party as ReviewParty) : undefined,
    bookingId: input.bookingId,
    customerId: input.customerId,
    token: input.token,
    requestedAt: reviewRequestedAt(now, input.delayHours),
    createdAt: now,
    updatedAt: now,
  }) as Omit<Review, 'id'>;
}
