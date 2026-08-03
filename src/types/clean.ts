/**
 * Turnwrk Clean — shared contracts for the cleaning-operations product.
 *
 * Collections use the `clean_` prefix (see ../collections.ts). Timestamps are
 * epoch ms (UTC); calendar dates are `YYYY-MM-DD` strings in the org timezone;
 * money is integer minor units in the org currency. Percentages (`discountPct`,
 * `taxPct`) are whole percents (25 = 25%), not fractions.
 *
 * Spec: docs/projects/cleaning-app/02-ENGINEERING-SPEC.md §4 (domain model)
 * and §11 (state machines). State transitions are enforced in
 * @turnwrk/shared/clean/transitions.ts — writers must go through that layer.
 */

import type { ChecklistItemStatus } from './checklist';
// Money types live in `@turnwrk/shared/money` (Verticals C5, TURNWRK-324); the
// settings blocks below still reference them, so import the canonical shapes.
import type { PaymentPolicy, DunningSettings } from '../money/types';

// ---------------------------------------------------------------------------
// Customers & leads
// ---------------------------------------------------------------------------

/**
 * @deprecated Verticals C3 (TURNWRK-322) moved these to `@turnwrk/shared/crm`.
 * Re-exported here for one release so vendored copies and app imports keep
 * compiling; import from the new subpath in new code. `CleanCustomer` is now
 * `Customer`, `CleanLead` is now `Lead`. The new `ServiceAddress` gives a trade
 * customer many sites (one customer, many sites).
 */
export type {
  CustomerSource,
  CustomerSource as CleanCustomerSource,
  Customer,
  Customer as CleanCustomer,
  ServiceAddress,
  LeadStatus,
  LeadStatus as CleanLeadStatus,
  Lead,
  Lead as CleanLead,
} from '../crm/types';

// ---------------------------------------------------------------------------
// Catalog (one embedded doc per org: clean_catalogs/{orgId})
// ---------------------------------------------------------------------------

/**
 * @deprecated Verticals C2 (TURNWRK-321) moved the catalog types to
 * `@turnwrk/shared/service`. Re-exported here for one release so vendored
 * copies and app imports keep compiling.
 */
export type {
  ServiceMode,
  ServiceMode as CleanServiceMode,
  PricingParam,
  PricingParam as CleanPricingParam,
  ServiceOffering,
  ServiceOffering as CleanService,
  ServiceExtra,
  ServiceExtra as CleanExtra,
  ServiceDiscountCode,
  ServiceDiscountCode as CleanDiscountCode,
  ServiceCatalog,
  ServiceCatalog as CleanCatalog,
} from '../service/types';

/**
 * A booking cadence key.
 *
 * Was a closed four-value enum; opened in Verticals B2 (TURNWRK-318) so a
 * vertical can declare its own cycles — a pool route wants 10-day and seasonal,
 * which the enum could not express. The four literals stay listed for editor
 * autocomplete and because the `cleaning` pack still declares exactly them;
 * `(string & {})` is what keeps that autocomplete while admitting any
 * pack-declared key.
 *
 * The type is deliberately NOT the validation boundary — `priceCleanQuote`
 * already rejects a key absent from `catalog.frequencies` with
 * `unknown_frequency`, so the org catalog (seeded from `VerticalPack.cadences`,
 * labels and discounts editable per org) remains the runtime source of truth.
 */
export type CleanFrequencyKey =
  | 'once'
  | 'weekly'
  | 'fortnightly'
  | 'monthly'
  | (string & {});

export interface CleanFrequency {
  key: CleanFrequencyKey;
  /** Label shown in the widget ("Weekly −25%"). */
  widgetLabel: string;
  /** Whole percent, e.g. 25. */
  discountPct: number;
}

export const DEFAULT_CLEAN_FREQUENCIES: CleanFrequency[] = [
  { key: 'once', widgetLabel: 'One-time', discountPct: 0 },
  { key: 'weekly', widgetLabel: 'Weekly', discountPct: 25 },
  { key: 'fortnightly', widgetLabel: 'Fortnightly', discountPct: 20 },
  { key: 'monthly', widgetLabel: 'Monthly', discountPct: 10 },
];


// ---------------------------------------------------------------------------
// Quotes (shared FE/BE pricing result — see ../service/pricing.ts)
// ---------------------------------------------------------------------------

/**
 * @deprecated Verticals C5 (TURNWRK-324) moved the quote shape to
 * `@turnwrk/shared/money`. Re-exported here for one release so vendored copies
 * and app imports keep compiling; import from the new subpath in new code.
 * `CleanQuote` is now `Quote`, `CleanPricing` is now `Pricing`, etc.
 */
export type {
  QtySelection,
  QtySelection as CleanQtySelection,
  QuoteSelection,
  QuoteSelection as CleanQuoteSelection,
  ParamSnapshot,
  ParamSnapshot as CleanParamSnapshot,
  ExtraSnapshot,
  ExtraSnapshot as CleanExtraSnapshot,
  Pricing,
  Pricing as CleanPricing,
  Quote,
  Quote as CleanQuote,
} from '../money/types';

// ---------------------------------------------------------------------------
// Bookings & series
// ---------------------------------------------------------------------------

/** Arrival window in org-local 24h time ("09:00"–"10:00"). */
export interface CleanArrivalWindow {
  start: string;
  end: string;
}

import type { CleanGeoStamp } from '../booking/types';
export type { CleanGeoStamp };

/**
 * @deprecated Verticals C4 (TURNWRK-323) moved these to
 * `@turnwrk/shared/booking`. Re-exported for one release so vendored copies and
 * app imports keep compiling.
 */
export type {
  BookingStatus,
  BookingStatus as CleanBookingStatus,
  ServiceBookingSource,
  ServiceBookingSource as CleanBookingSource,
  ServiceBooking,
  ServiceBooking as CleanBooking,
  BookingSeries,
  BookingSeries as CleanBookingSeries,
  SeriesStatus,
  SeriesStatus as CleanSeriesStatus,
  Assignment,
  Assignment as CleanAssignment,
  AssignmentStatus,
  AssignmentStatus as CleanAssignmentStatus,
} from '../booking/types';


// ---------------------------------------------------------------------------
// Payments, invoices, payouts
// ---------------------------------------------------------------------------

/**
 * @deprecated Verticals C5 (TURNWRK-324) moved the money model —
 * payment, invoice, payment policy and payout — to `@turnwrk/shared/money`.
 * Re-exported here for one release so vendored copies and app imports keep
 * compiling; import from the new subpath in new code. The `Clean*` prefix is
 * dropped: `CleanInvoice` is now `Invoice`, `CleanPayment` is now `Payment`,
 * `CleanPaymentPolicy` is now `PaymentPolicy`, and so on.
 */
export type {
  PaymentPolicy,
  PaymentPolicy as CleanPaymentPolicy,
  PaymentStatus,
  PaymentStatus as CleanPaymentStatus,
  ManualPaymentMethod,
  ManualPaymentMethod as CleanManualPaymentMethod,
  Payment,
  Payment as CleanPayment,
  InvoiceKind,
  InvoiceKind as CleanInvoiceKind,
  InvoiceStatus,
  InvoiceStatus as CleanInvoiceStatus,
  InvoicePaymentApplied,
  InvoicePaymentApplied as CleanInvoicePaymentApplied,
  Invoice,
  Invoice as CleanInvoice,
  PayoutLineStatus,
  PayoutLineStatus as CleanPayoutLineStatus,
  PayoutLine,
  PayoutLine as CleanPayoutLine,
  PayoutPeriod,
  PayoutPeriod as CleanPayoutPeriod,
} from '../money/types';

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export type CleanReviewRouted = 'public_prompt' | 'private_alert';

/**
 * Customer review request/response for one booking. Distinct from the
 * existing `cmms_reviews` collection (property/guest review store).
 */
export interface CleanReview {
  id: string;
  orgId: string;
  bookingId: string;
  customerId: string;
  /** Bearer token for the 1-tap review page. */
  token: string;
  rating?: number;
  comment?: string;
  routed?: CleanReviewRouted;
  publicReviewClickedAt?: number;
  /** Admin push when routed === private_alert (hostfix sendCleanOpsPushes). */
  reviewLowPushAt?: number;
  requestedAt: number;
  respondedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Events (append-only audit stream)
// ---------------------------------------------------------------------------

export type CleanEventEntity =
  | 'booking'
  | 'payment'
  | 'assignment'
  | 'lead'
  | 'series'
  | 'review'
  | 'stripe'
  | 'invoice'
  | 'timeoff'
  | 'availability'
  | 'incident'
  | 'notification'
  | 'bounty'
  | 'payoutPeriod';

/**
 * Immutable transition/audit record. Stripe webhook events are stored here
 * with doc id = Stripe event id (create-only ⇒ natural dedupe).
 */
export interface CleanEvent {
  id: string;
  orgId: string;
  /** e.g. 'booking.assigned', 'payment.preauthorized'. */
  eventType: string;
  entity: CleanEventEntity;
  entityId: string;
  /** uid, 'system', or 'customer:{customerId}'. */
  actorId: string;
  payload?: Record<string, unknown>;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Notifications (Change Order 1 R2 — template engine + SMS channel)
// ---------------------------------------------------------------------------

/**
 * @deprecated Verticals C6 (TURNWRK-325) moved these to
 * `@turnwrk/shared/notifications`. Re-exported here for one release so
 * vendored copies and app imports keep compiling.
 */
export type {
  CleanNotificationChannel,
  CleanNotificationAudience,
  CleanNotificationEventKey,
  CanonicalCleanNotificationEventKey,
  CleanNotificationTemplate,
  CleanNotificationSendStatus,
  CleanNotificationSend,
} from '../notifications/types';


// ---------------------------------------------------------------------------
// Proof-of-service visit report (Verticals V2 — TURNWRK-291)
// ---------------------------------------------------------------------------

/**
 * @deprecated Verticals C1 (TURNWRK-319) moved these to `@turnwrk/shared/proof`.
 * Re-exported here for one release so vendored copies keep compiling; import
 * from the new subpath in new code. `CleanVisitReport` is now
 * `VisitReportRecord`.
 */
export type {
  VisitReportPhotoKind,
  VisitReportPhoto,
  VisitReportChecklistItem,
  VisitReportChecklistSection,
  VisitReportPhotoCounts,
  VisitReport,
  VisitReportRecord,
  VisitReportRecord as CleanVisitReport,
} from '../proof/types';

// ---------------------------------------------------------------------------
// Contractor availability & time off (Change Order 1 R3)
// ---------------------------------------------------------------------------

/** One weekly recurring working-hours range, org-local 24h time. */
export interface CleanWeeklyHours {
  /** 0 = Sunday … 6 = Saturday. */
  dow: number;
  start: string;
  end: string;
}

/**
 * Weekly working hours, one doc per (org, tech). ABSENT DOC (or active:false)
 * = always available — shipped orgs behave identically until configured.
 * An explicit empty `weekly` array means never available.
 */
export interface CleanContractorAvailability {
  id: string;
  orgId: string;
  /** cmms_technicians doc id. */
  techId: string;
  weekly: CleanWeeklyHours[];
  active: boolean;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
}

export type CleanTimeOffType = 'pto' | 'sick' | 'unavailable';

export type CleanTimeOffStatus = 'requested' | 'approved' | 'denied' | 'canceled';

/** A time-off range (org-local dates, inclusive). Only `approved` affects scheduling. */
export interface CleanTimeOff {
  id: string;
  orgId: string;
  techId: string;
  type: CleanTimeOffType;
  status: CleanTimeOffStatus;
  startDate: string;
  endDate: string;
  note?: string;
  /** uid or 'tech:{techId}' (field-app self-request). */
  requestedBy: string;
  approvedBy?: string;
  decidedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Incidents (Change Order 1 A4 — SOS)
// ---------------------------------------------------------------------------

export type CleanIncidentStatus = 'open' | 'acknowledged' | 'resolved' | 'false_alarm';

/**
 * Field-safety incident. The cancel window is client-side (hold-to-activate +
 * countdown before the API fires); the server dispatches operator alerts
 * immediately on receipt. Location is a one-time fix — no tracking.
 */
export interface CleanIncident {
  id: string;
  orgId: string;
  type: 'sos';
  status: CleanIncidentStatus;
  techId: string;
  assignmentId?: string;
  bookingId?: string;
  workOrderId?: string;
  geo?: CleanGeoStamp;
  triggeredAt: number;
  /** Field-app idempotency token — duplicate triggers dedupe on (orgId, clientEventId). */
  clientEventId?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  resolvedBy?: string;
  resolvedAt?: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Bounty photo rewards (Change Order 2 — doc 09)
// ---------------------------------------------------------------------------

export type CleanBountySpotCategory =
  | 'kitchen'
  | 'bath'
  | 'bedroom'
  | 'living'
  | 'utility'
  | 'supply'
  | 'exterior'
  | 'other';

/** One preset photo challenge. Lives embedded on the org's program doc. */
export interface CleanBountySpot {
  /** Stable per-org id — referenced by CleanBounty.spotId + last-N exclusion. */
  id: string;
  /** "Under the kitchen sink" */
  label: string;
  instructionText: string;
  category: CleanBountySpotCategory;
  /**
   * Normalized token matched against the booking's paramsSnapshot labels/ids
   * (e.g. 'bath', 'game room'). A spot with this set is never drawn for a
   * location whose matching param has qty 0 (doc §3.3 / B7).
   */
  requiresParameter?: string;
  /** Approved photos of this spot double as restock stock evidence (doc §1.3). */
  supplyRelevant?: boolean;
  active: boolean;
  /** bountyDefaults seed this was copied from; absent = operator-created. */
  seedKey?: string;
}

export type CleanBountyRevealMode = 'on_check_in' | 'on_assignment';
export type CleanBountyApprovalMode = 'manual' | 'auto_with_audit';
export type CleanBountyAmountType = 'fixed' | 'pct_of_job';

/**
 * Org bounty program config, one doc per org (doc id == orgId, catalog
 * pattern — spots embedded so the draw is a single point-read). Server-write
 * only; the clean_bounties plan-flag gate is enforced in the API layer.
 */
export interface CleanBountyProgram {
  orgId: string;
  enabled: boolean;
  /** Catalog service ids eligible for draws; empty/absent = all cleaning jobs. */
  serviceIds?: string[];
  amountType: CleanBountyAmountType;
  /** Minor units when 'fixed'; whole percent of the booking total when 'pct_of_job'. */
  amountValue: number;
  /** 0–1; 1.0 = every eligible job draws. */
  triggerProbability: number;
  /** Default 'on_check_in' — preserves the random-audit property (doc §3.2). */
  reveal: CleanBountyRevealMode;
  approval: CleanBountyApprovalMode;
  /** 0–100; auto_with_audit only. */
  auditSamplePct?: number;
  monthlyBudgetCapMinor?: number;
  perCleanerDailyCapMinor?: number;
  /** Meters; absent = BOUNTY_DEFAULT_GEOFENCE_M (150). */
  geofenceRadiusM?: number;
  spots: CleanBountySpot[];
  createdAt: number;
  updatedAt: number;
}

export type CleanBountyStatus =
  | 'offered'
  | 'revealed'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'missed'
  | 'expired'
  | 'revoked'
  | 'cancelled';

/**
 * One bounty per job (booking). Spot + amount are snapshotted at draw — spot
 * edits and program changes never mutate live bounties. A cap-skipped draw
 * writes NO bounty row, only a `bounty.draw_cancelled` event (B6/B9).
 */
export interface CleanBounty {
  id: string;
  orgId: string;
  bookingId: string;
  workOrderId: string;
  /** Last-N spot exclusion + property-scoped photo dedupe joins. */
  propertyId: string;
  spotId: string;
  spotLabel: string;
  spotInstruction: string;
  spotSupplyRelevant?: boolean;
  /** Snapshotted at draw (operator-funded; never touches the customer total). */
  amountMinor: number;
  currency: string;
  status: CleanBountyStatus;
  revealMode: CleanBountyRevealMode;
  approvalMode: CleanBountyApprovalMode;
  /** Live assignee techIds at draw (refreshed on re-assign) — cap queries + push fan-out. */
  techIds: string[];
  offeredAt: number;
  /** Org-local 'YYYY-MM' of the draw — monthly-cap sums without range indexes. */
  drawnMonth: string;
  /** Org-local 'YYYY-MM-DD' of the draw — per-cleaner daily-cap sums. */
  drawnDate: string;
  revealedAt?: number;
  expiredAt?: number;
  /** First approved submission wins (B5). */
  winnerSubmissionId?: string;
  winnerTechId?: string;
  approvedAt?: number;
  /** clean_payoutPeriods doc holding this bounty's payout line. */
  payoutPeriodId?: string;
  /** auto_with_audit sample flagged for retroactive review. */
  auditFlagged?: boolean;
  auditResolved?: boolean;
  auditResolvedBy?: string;
  auditResolvedAt?: number;
  revokedReason?: string;
  /** Revocation landed after the payout period closed — operator fixes payroll manually. */
  revokeNeedsPayrollFix?: boolean;
  cancelledReason?: 'booking_canceled';
  createdAt: number;
  updatedAt: number;
}

export type CleanBountySubmissionDecision = 'pending' | 'approved' | 'rejected' | 'moot';

/** Distinct server/reviewer rejection codes (B3 requires distinguishable reasons). */
export type CleanBountyRejectionCode =
  | 'outside_checkin_window'
  | 'sync_too_late'
  | 'outside_geofence'
  | 'duplicate_photo_property'
  | 'duplicate_photo_cleaner'
  | 'wrong_spot'
  | 'poor_quality'
  | 'other';

/** Which geofence-ladder rung applied. 'unverified' = accepted but flagged for the reviewer. */
export type CleanBountyGeoBasis = 'property' | 'check_in' | 'unverified';

/**
 * One photo submission, including server auto-rejected attempts (kept for
 * audit — cleaners will dispute). capturedAt is the client capture time and
 * is what the check-in window validates (offline sync arrives later).
 */
export interface CleanBountySubmission {
  id: string;
  orgId: string;
  bountyId: string;
  bookingId: string;
  propertyId: string;
  assignmentId: string;
  techId: string;
  /** Token download URL (set once the photo is stored; absent on early rejects). */
  photoUrl?: string;
  storagePath?: string;
  capturedAt: number;
  /** Server receipt time — bounded by the offline sync grace window. */
  receivedAt: number;
  geo?: CleanGeoStamp;
  geoBasis: CleanBountyGeoBasis;
  geoDistanceM?: number;
  /** 16-hex-char dHash; absent on rejects that failed before hashing. */
  phash?: string;
  /** Stored for audit, never trusted (strippable — doc §3.4). */
  exifMeta?: Record<string, unknown>;
  decision: CleanBountySubmissionDecision;
  /** uid or 'system' (server auto-reject / auto-approve / moot fan-out). */
  decidedBy?: string;
  decidedAt?: number;
  rejectionCode?: CleanBountyRejectionCode;
  rejectionReason?: string;
  /** Prior reviewer-rejected submission this retries (B4 one-resubmission link). */
  resubmissionOf?: string;
  /** Field-app idempotency key — offline drainer retries dedupe on (orgId, this). */
  clientSubmissionId?: string;
  /** Quick Work Order opened from this photo by a reviewer (B8). */
  openedWorkOrderId?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Tech-facing projection for the field app. While sealed (on_check_in mode,
 * pre-check-in) the spot fields are withheld — the server never sends them.
 */
export interface CleanBountyTechView {
  bountyId: string;
  status: CleanBountyStatus;
  sealed: boolean;
  amountMinor: number;
  currency: string;
  spotLabel?: string;
  spotInstruction?: string;
  revealMode: CleanBountyRevealMode;
  mySubmissions: Array<
    Pick<
      CleanBountySubmission,
      'id' | 'decision' | 'rejectionCode' | 'rejectionReason' | 'capturedAt' | 'resubmissionOf'
    >
  >;
  /** Set when this tech won: the itemized job-card earning (B2). */
  earnedMinor?: number;
  canResubmit: boolean;
}

// ---------------------------------------------------------------------------
// Short links (Change Order 1 A9)
// ---------------------------------------------------------------------------

/** Booking-site short link; doc id == the short code (/s/{code}). */
export interface CleanShortLink {
  id: string;
  orgId: string;
  /** Booking-site slug the code resolves to. */
  slug: string;
  target: 'book';
  hits?: number;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Org settings (referenced from Org.cleanSettings)
// ---------------------------------------------------------------------------

export interface CleanLateCancelPolicy {
  /** Cancellations inside this many hours incur the fee. */
  hours: number;
  /** Whole percent of the booking total. */
  pct: number;
}

/** Org-level communications config (Change Order 1 R2/A1/A4). */
export interface CleanCommunicationsSettings {
  /** Master switch for outbound SMS (default false until a sender is provisioned). */
  smsEnabled?: boolean;
  /** Per-org sender (E.164 or provider phone id). Falls back to the app-level SURGE_FROM_NUMBER. */
  smsFromNumber?: string;
  /** Where operator-audience notifications go (default org branding contactEmail). */
  operatorAlertEmail?: string;
  /** E.164; used by payment_risk / sos_triggered SMS alerts. */
  operatorAlertPhone?: string;
  /** A1 on-my-way customer notification (default true). */
  enRouteEnabled?: boolean;
  /**
   * Verticals V2 proof-of-service report on visit completion (default FALSE —
   * owner decision 2026-07-29). Auto-reports are opt-in per org so no existing
   * customer receives an unrequested proof-of-service text; the design-partner
   * accounts turn it on deliberately. Org-level master switch; a per-customer
   * opt-out can still override it on (see CleanCustomer.visitReportOptOut).
   */
  visitReportEnabled?: boolean;
}

/**
 * @deprecated Verticals C5 (TURNWRK-324) moved the A/R dunning schedule to
 * `@turnwrk/shared/money` (`CleanDunningSettings` is now `DunningSettings`).
 * Re-exported here for one release.
 */
export type { DunningSettings, DunningSettings as CleanDunningSettings } from '../money/types';

export interface CleanOrgSettings {
  /** Path slug on the public booking site (book.turnwrk.com/{slug}). */
  bookingSiteSlug?: string;
  /** Bookable arrival windows shown on the wizard Date step. */
  arrivalWindows?: CleanArrivalWindow[];
  /** Max concurrent bookings per window (availability rule v1). */
  maxConcurrentPerWindow?: number;
  /** Org-default payment policy. Absent = 'card_required_preauth'. */
  paymentPolicy?: PaymentPolicy;
  /** Org-default invoice terms in days (invoice_terms policy). Absent = 14. */
  invoiceTermsDays?: number;
  communications?: CleanCommunicationsSettings;
  dunning?: DunningSettings;
  /** When true, assignments require contractor accept before confirmed. */
  requireAcceptance?: boolean;
  /** Ratings >= threshold get the public-review prompt (default 4). */
  reviewThresholdRating?: number;
  /** Public review destinations (Google/Yelp URLs). */
  reviewLinks?: { google?: string; yelp?: string };
  /** Hours after capture before the review request sends (default 4). */
  reviewDelayHours?: number;
  lateCancel?: CleanLateCancelPolicy;
  /** Require before/after photos to complete a clean (org default). */
  photoCloseoutRequired?: boolean;
  /** Auto-turnover automation (WOType 'Turnover' from occupancy checkouts). */
  turnover?: CleanTurnoverSettings;
  /**
   * Stripe Connect — the org's OWN account, and the merchant of record for its
   * customers' payments. Charges execute on it directly, so funds never enter
   * the platform balance and disputes settle against the org (see
   * `billing/connect.ts`). Field names are mirrored in `CLEAN_CONNECT_ORG_FIELDS`.
   */
  stripeConnectAccountId?: string;
  /** Stripe has enabled card acceptance. No charges until true. */
  stripeConnectChargesEnabled?: boolean;
  /** Stripe has enabled payouts to the org's bank. */
  stripeConnectPayoutsEnabled?: boolean;
  /** Express onboarding finished (KYC satisfied at the time it was recorded). */
  stripeConnectOnboardingComplete?: boolean;
}

export interface CleanTurnoverSettings {
  enabled: boolean;
  /** cmms_technicians / vendor profile id auto-assigned to turnover WOs. */
  defaultCleanerId?: string;
  /** Catalog service used for the turnover job snapshot. */
  serviceId?: string;
  /** Create the WO this many days before checkout (default 30). */
  leadDays?: number;
}
