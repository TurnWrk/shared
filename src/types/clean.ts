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

// ---------------------------------------------------------------------------
// Customers & leads
// ---------------------------------------------------------------------------

export type CleanCustomerSource = 'widget' | 'manual' | 'import';

/**
 * Org-scoped end consumer (homeowner / STR guest-payer). Customers are NEVER
 * platform users — no `Role`, no org membership; they authenticate to the
 * booking portal via magic-link/OTP tokens only.
 */
export interface CleanCustomer {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
  /** E.164 preferred. */
  phone?: string;
  /** Default service location (`properties` doc with kind 'residence'). */
  defaultPropertyId?: string;
  marketingOptIn?: boolean;
  source: CleanCustomerSource;
  stripeCustomerId?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type CleanLeadStatus = 'open' | 'contacted' | 'converted' | 'dead';

/** Captured mid-funnel at the wizard's "Get a Price" gate. */
export interface CleanLead {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status: CleanLeadStatus;
  /** Full quote at capture time — powers the resume link. */
  quoteSnapshot: CleanQuote;
  /** Set when the lead converts (auto-`converted`). */
  bookingId?: string;
  /** Random bearer token embedded in resume links. */
  resumeToken: string;
  followUps?: {
    sent0hAt?: number;
    sent48hAt?: number;
    sent7dAt?: number;
  };
  unsubscribedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Catalog (one embedded doc per org: clean_catalogs/{orgId})
// ---------------------------------------------------------------------------

export type CleanServiceMode = 'residential' | 'str' | 'both';

/** A ± stepper row on the wizard ("Bedrooms", "Full Baths", …). */
export interface CleanPricingParam {
  id: string;
  label: string;
  unitPriceMinor: number;
  unitMinutes: number;
  min: number;
  max: number;
  sort: number;
}

export interface CleanService {
  id: string;
  name: string;
  description?: string;
  basePriceMinor: number;
  baseMinutes: number;
  mode: CleanServiceMode;
  active: boolean;
  /** Optional cmms_pmTemplates doc id — attaches a checklist to jobs. */
  checklistTemplateId?: string;
  params: CleanPricingParam[];
  /** Which org extras are offered for this service. */
  extraIds: string[];
}

export interface CleanExtra {
  id: string;
  label: string;
  priceMinor: number;
  minutes: number;
  /** When true the wizard shows a qty stepper ("Carpets ×3"). */
  qtyEnabled: boolean;
  description?: string;
}

export type CleanFrequencyKey = 'once' | 'weekly' | 'fortnightly' | 'monthly';

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

export interface CleanDiscountCode {
  /** Whole percent off the subtotal. Mutually exclusive with fixedMinor. */
  pct?: number;
  /** Fixed amount off in minor units. */
  fixedMinor?: number;
  active: boolean;
}

/**
 * The org's whole service catalog as ONE doc — a single read serves the
 * booking widget and edits are atomic. Catalogs are small (well under the
 * 1 MiB doc limit). Prices/labels are snapshotted onto bookings, so editing
 * the catalog never mutates history.
 */
export interface CleanCatalog {
  orgId: string;
  services: CleanService[];
  extras: CleanExtra[];
  frequencies: CleanFrequency[];
  /** Keyed by uppercase code. */
  discountCodes?: Record<string, CleanDiscountCode>;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Quotes (shared FE/BE pricing result — see ../clean/pricing.ts)
// ---------------------------------------------------------------------------

export interface CleanQtySelection {
  id: string;
  qty: number;
}

/** What the customer picked; the input to the pure pricing function. */
export interface CleanQuoteSelection {
  serviceId: string;
  frequencyKey: CleanFrequencyKey;
  params: CleanQtySelection[];
  extras: CleanQtySelection[];
  discountCode?: string;
}

export interface CleanParamSnapshot {
  paramId: string;
  label: string;
  qty: number;
  unitPriceMinor: number;
  unitMinutes: number;
  lineTotalMinor: number;
}

export interface CleanExtraSnapshot {
  extraId: string;
  label: string;
  qty: number;
  priceMinor: number;
  minutes: number;
  lineTotalMinor: number;
}

export interface CleanPricing {
  subtotalMinor: number;
  discountMinor: number;
  /** Whole percent applied (org tax). */
  taxPct: number;
  taxMinor: number;
  totalMinor: number;
  /** ISO 4217, e.g. 'USD'. */
  currency: string;
}

/** Server-priced quote: selection + frozen line items + totals. */
export interface CleanQuote {
  selection: CleanQuoteSelection;
  serviceLabel: string;
  paramsSnapshot: CleanParamSnapshot[];
  extrasSnapshot: CleanExtraSnapshot[];
  pricing: CleanPricing;
  estMinutes: number;
}

// ---------------------------------------------------------------------------
// Bookings & series
// ---------------------------------------------------------------------------

/** Arrival window in org-local 24h time ("09:00"–"10:00"). */
export interface CleanArrivalWindow {
  start: string;
  end: string;
}

export type CleanBookingStatus =
  | 'draft'
  | 'booked'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'closed'
  | 'on_hold'
  | 'canceled';

export type CleanBookingSource = 'widget' | 'manual' | 'ai_intake' | 'auto_turnover' | 'series';

/**
 * One booking occurrence. 1:1 with a `cmms_workOrders` doc
 * (`WOType 'Cleaning'`); turnover jobs created from occupancy checkouts have
 * a WO but no booking/payment.
 */
export interface CleanBooking {
  id: string;
  orgId: string;
  customerId: string;
  propertyId: string;
  serviceId: string;
  serviceLabel: string;
  frequencyKey: CleanFrequencyKey;
  status: CleanBookingStatus;
  paramsSnapshot: CleanParamSnapshot[];
  extrasSnapshot: CleanExtraSnapshot[];
  pricing: CleanPricing;
  priceOverridden?: boolean;
  /** Required whenever priceOverridden is set. */
  overrideComment?: string;
  estMinutes: number;
  /** Org-local calendar date. */
  scheduledDate: string;
  arrivalWindow: CleanArrivalWindow;
  /**
   * Epoch ms of the window start, computed ONCE in the org timezone at write
   * time. The T-48h pre-auth worker queries `preauthDueAt` derived from this —
   * never recompute timezone math in workers.
   */
  scheduledStartUtc: number;
  /** Visible to the customer. */
  notesCustomer?: string;
  /** Never customer-visible; visible to contractors. */
  notesStaff?: string;
  parking?: string;
  access?: string;
  discountCode?: string;
  seriesId?: string;
  workOrderId?: string;
  leadId?: string;
  source: CleanBookingSource;
  canceledReason?: string;
  /** Status the booking held before `on_hold`, restored on release. */
  heldFromStatus?: CleanBookingStatus;
  /** Reminder-sent markers (written by the hostfix sendCleanReminders worker). */
  reminder24hAt?: number;
  reminder2hAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type CleanSeriesStatus = 'active' | 'paused' | 'canceled';

/** Recurrence template; a scheduled worker materializes N future bookings. */
export interface CleanBookingSeries {
  id: string;
  orgId: string;
  customerId: string;
  propertyId: string;
  frequencyKey: CleanFrequencyKey;
  selection: CleanQuoteSelection;
  arrivalWindow: CleanArrivalWindow;
  /** First occurrence date (org-local). */
  anchorDate: string;
  /** Last date (inclusive) through which bookings exist. */
  materializedThrough?: string;
  status: CleanSeriesStatus;
  /** Set when a payment failure paused the series. */
  pausedReason?: string;
  /** First occurrence booking (source of the vaulted card for occurrences). */
  anchorBookingId?: string;
  /** Cached vaulted card from the anchor booking, reused to auto-charge occurrences. */
  stripeCustomerId?: string;
  paymentMethodId?: string;
  /** Epoch ms of the last successful materialization run. */
  lastMaterializedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Assignments (assignment + timesheet merged; payroll source of truth)
// ---------------------------------------------------------------------------

export type CleanAssignmentStatus =
  | 'assigned'
  | 'notified'
  | 'accepted'
  | 'declined'
  | 'removed';

export interface CleanGeoStamp {
  lat: number;
  lng: number;
}

/**
 * One contractor on one job. The LEAD assignment mirrors
 * `WorkOrder.assignedTechId` so the existing offer/push pipeline works
 * unmodified; secondary assignees exist only here. Check-in/out is 1:1 per
 * assignment — payroll reads these fields (override wins over actual).
 */
export interface CleanAssignment {
  id: string;
  orgId: string;
  workOrderId: string;
  bookingId?: string;
  /** cmms_technicians doc id. */
  techId: string;
  /** Cross-org vendor identity, when linked. */
  vendorId?: string;
  allocatedMinutes: number;
  /** Org-scoped rate frozen at assignment time (vendorAffiliations.hourlyRateMinor). */
  hourlyRateMinorSnapshot: number;
  status: CleanAssignmentStatus;
  isLead: boolean;
  checkedInAt?: number;
  checkedOutAt?: number;
  /** Derived checkedOutAt − checkedInAt, minutes. */
  actualMinutes?: number;
  overrideMinutes?: number;
  /** Required whenever overrideMinutes is set. */
  overrideReason?: string;
  source: 'app' | 'manual';
  checkInGeo?: CleanGeoStamp;
  checkOutGeo?: CleanGeoStamp;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Payments, invoices, payouts
// ---------------------------------------------------------------------------

export type CleanPaymentStatus =
  | 'pending'
  | 'vaulted'
  | 'preauthorized'
  | 'preauth_failed'
  | 'retrying'
  | 'risk'
  | 'captured'
  | 'paid_manual'
  | 'refunded'
  | 'partially_refunded';

export type CleanManualPaymentMethod = 'cash' | 'bank_transfer' | 'check';

/**
 * Customer-side payment lifecycle for one booking. "On hold" is the `hold`
 * flag, not a status — it freezes automation (pre-auth/capture workers skip
 * held payments) without losing lifecycle position.
 */
export interface CleanPayment {
  id: string;
  orgId: string;
  bookingId: string;
  customerId: string;
  stripeCustomerId?: string;
  /** Vaulted payment method (Stripe pm_…). */
  paymentMethodId?: string;
  setupIntentId?: string;
  /** Manual-capture PaymentIntent once pre-authorized. */
  paymentIntentId?: string;
  status: CleanPaymentStatus;
  amountMinor: number;
  preauthAmountMinor?: number;
  /** Epoch ms when the T-48h pre-auth is due — the worker's query key. */
  preauthDueAt?: number;
  preauthAt?: number;
  capturedAt?: number;
  refundedMinor?: number;
  retryCount?: number;
  /** Next retry instant after a pre-auth failure. */
  retryAt?: number;
  /** In-flight idempotency marker written before each Stripe call. */
  processingAt?: number;
  lastError?: string;
  hold?: boolean;
  manualMethod?: CleanManualPaymentMethod;
  manualPaidAt?: number;
  invoiceId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CleanInvoice {
  id: string;
  orgId: string;
  bookingId: string;
  paymentId: string;
  /** Per-org sequential number ("INV-000042"). */
  number: string;
  /** Firebase Storage path of the rendered PDF. */
  pdfPath?: string;
  emailedAt?: number;
  totalsSnapshot: CleanPricing;
  createdAt: number;
}

export type CleanPayoutLineStatus = 'pending' | 'approved' | 'paid';

export interface CleanPayoutLine {
  techId: string;
  vendorId?: string;
  /** Σ minutes across the period's assignments (override wins). */
  minutes: number;
  rateMinorPerHour: number;
  amountMinor: number;
  status: CleanPayoutLineStatus;
  paidAt?: number;
}

export interface CleanPayoutPeriod {
  id: string;
  orgId: string;
  /** Org-local dates, inclusive. */
  periodStart: string;
  periodEnd: string;
  status: 'open' | 'closed';
  lines: CleanPayoutLine[];
  createdAt: number;
  updatedAt: number;
}

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
  | 'stripe';

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
// Org settings (referenced from Org.cleanSettings)
// ---------------------------------------------------------------------------

export interface CleanLateCancelPolicy {
  /** Cancellations inside this many hours incur the fee. */
  hours: number;
  /** Whole percent of the booking total. */
  pct: number;
}

export interface CleanOrgSettings {
  /** Path slug on the public booking site (book.turnwrk.com/{slug}). */
  bookingSiteSlug?: string;
  /** Bookable arrival windows shown on the wizard Date step. */
  arrivalWindows?: CleanArrivalWindow[];
  /** Max concurrent bookings per window (availability rule v1). */
  maxConcurrentPerWindow?: number;
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
