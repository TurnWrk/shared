/**
 * Customer review request/response types (Verticals — TURNWRK-340).
 *
 * Extracted from the Clean-only review flow (`clean_reviews` +
 * `CleanReview`, src/types/clean.ts) into a vertical-agnostic core so Dispatch
 * (TURNWRK-283) and referrals (TURNWRK-288) can reuse it rather than fork it.
 *
 * The pivot: a review is keyed on a {@link ReviewJobRef} (a neutral pointer to
 * the completed job — a clean booking, a trade work order, anything) plus a
 * {@link ReviewParty} (who is being asked), NOT on a `clean_bookings` doc. The
 * legacy `bookingId` / `customerId` fields are retained as an optional
 * dual-read so existing `clean_reviews` docs keep resolving unchanged.
 *
 * Nothing here touches Firestore — the app server owns persistence, tokens,
 * events and email; this module owns the shape and the pure decisions.
 */
import type { OrgAppKey } from '../types/org';

export type ReviewRouted = 'public_prompt' | 'private_alert';

/**
 * A neutral pointer to the job a review is about. `app` + `collection` + `id`
 * locates it in whichever app owns it (clean bookings, dispatch work orders,
 * …) without this module knowing that app's model.
 */
export interface ReviewJobRef {
  app: OrgAppKey;
  /** The Firestore collection the job lives in (e.g. `svc_bookings`, `cmms_workOrders`). */
  collection: string;
  id: string;
}

/**
 * Who the review is being requested from. Every field is optional so
 * attribution degrades honestly: until a shared Customer lands (TURNWRK-270) a
 * review can attach to a job with only a name, an email, or nothing at all.
 * `customerId` points at the owning app's customer record when one exists.
 */
export interface ReviewParty {
  customerId?: string;
  name?: string;
  email?: string;
  phone?: string;
}

/**
 * A customer review request/response. One per job. Persisted by the app that
 * owns the flow (currently `clean_reviews`; `svc_reviews` after the F2 key
 * rename). Distinct from the `cmms_reviews` property/guest store.
 */
export interface Review {
  id: string;
  orgId: string;
  /** The job being reviewed. Absent on legacy docs — read {@link ReviewJobRef} via `bookingId`. */
  jobRef?: ReviewJobRef;
  /** Who is being asked. Absent on legacy docs — synthesize from `customerId`. */
  party?: ReviewParty;
  /** @deprecated legacy key — dual-read only, for existing `clean_reviews` docs. */
  bookingId?: string;
  /** @deprecated legacy party — dual-read only, for existing `clean_reviews` docs. */
  customerId?: string;
  /** Bearer token for the 1-tap review page. */
  token: string;
  rating?: number;
  comment?: string;
  routed?: ReviewRouted;
  publicReviewClickedAt?: number;
  /** Admin push when routed === private_alert. */
  reviewLowPushAt?: number;
  requestedAt: number;
  respondedAt?: number;
  createdAt: number;
  updatedAt: number;
}
