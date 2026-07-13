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
  /** Per-customer payment-policy override (negotiated commercial accounts). */
  paymentPolicy?: CleanPaymentPolicy;
  /** Per-customer invoice terms override (days). Falls back to org invoiceTermsDays. */
  termsDays?: number;
  /** Set when the customer texts STOP; cleared on START. Blocks all SMS sends. */
  smsOptOutAt?: number;
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
  /** Per-service payment-policy override (e.g. commercial services on terms). */
  paymentPolicy?: CleanPaymentPolicy;
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
  /**
   * Payment policy resolved (customer → service → org → default) and
   * snapshotted at creation — settings edits never mutate in-flight money.
   * Absent (legacy docs) = 'card_required_preauth'.
   */
  paymentPolicy?: CleanPaymentPolicy;
  /** The job's bounty, when drawn (CO2) — zero-read gate for the cancel hook. */
  bountyId?: string;
  /** Status the booking held before `on_hold`, restored on release. */
  heldFromStatus?: CleanBookingStatus;
  /** Contractor-push reminder markers (written by the hostfix sendCleanReminders worker). */
  reminder24hAt?: number;
  reminder2hAt?: number;
  /** Customer reminder markers (written by clean/'s notifications sweep — R2). */
  customerReminder24hAt?: number;
  customerReminder2hAt?: number;
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
  /** Horizontal accuracy in meters, when the device reports it. */
  accuracy?: number;
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
  /** Set by the "On my way" tap (A1); one-shot, cleared never. */
  enRouteAt?: number;
  /**
   * The job's bounty, when drawn (CO2) — zero-read gate for the check-in/out
   * hooks and the field app's sealed-chip signal.
   */
  bountyId?: string;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Payments, invoices, payouts
// ---------------------------------------------------------------------------

/**
 * How money is collected for a booking (Change Order 1 R1). Resolved
 * customer → service → org → 'card_required_preauth' via
 * clean/paymentPolicy.ts and snapshotted onto the booking + payment.
 *
 *  - card_required_preauth:     vault → T-48h pre-auth → capture on completion
 *  - card_on_file_charge_after: vault → charge on completion (no pre-auth)
 *  - invoice_terms:             no card required; invoice on completion, A/R lifecycle
 *  - offline:                   tracked only; operator uses Mark-as-Paid
 */
export type CleanPaymentPolicy =
  | 'card_required_preauth'
  | 'card_on_file_charge_after'
  | 'invoice_terms'
  | 'offline';

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
  | 'partially_refunded'
  // A/R lifecycle (invoice_terms policy only):
  | 'invoiced_unpaid'
  | 'partially_paid'
  | 'paid'
  | 'overdue';

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
  /** When the "upcoming hold" customer notice was sent (sweep lookahead, R2). */
  preauthNoticeAt?: number;
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
  /** Policy snapshot from the booking. Absent (legacy) = 'card_required_preauth'. */
  policy?: CleanPaymentPolicy;
  createdAt: number;
  updatedAt: number;
}

/** Receipt = record of a settled card/manual payment. Invoice = A/R billable. */
export type CleanInvoiceKind = 'receipt' | 'invoice';

export type CleanInvoiceStatus = 'open' | 'partially_paid' | 'paid' | 'overdue' | 'void';

/** One payment applied against an A/R invoice (partial payments supported). */
export interface CleanInvoicePaymentApplied {
  id: string;
  amountMinor: number;
  /** 'card' = hosted pay-link payment; others recorded by the operator. */
  method: 'card' | CleanManualPaymentMethod;
  /** Gateway PaymentIntent id when method === 'card'. */
  intentId?: string;
  receivedAt: number;
  /** uid, 'system' (webhook backstop), or 'customer:{customerId}'. */
  actorId: string;
  note?: string;
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
  // --- A/R lifecycle (Change Order 1 R1/A2). Absent kind (legacy docs) = a
  // --- settled 'receipt'; the fields below only apply to kind 'invoice'.
  kind?: CleanInvoiceKind;
  status?: CleanInvoiceStatus;
  issuedAt?: number;
  /** Due date, org-local calendar date. */
  dueDate?: string;
  /**
   * Epoch ms of end-of-day dueDate, computed ONCE in the org timezone at issue
   * time — the dunning worker's query key (scheduledStartUtc discipline).
   */
  dueAtUtc?: number;
  /** Terms applied at issue (customer override → org invoiceTermsDays → 14). */
  termsDays?: number;
  totalMinor?: number;
  paidMinor?: number;
  balanceMinor?: number;
  paymentsApplied?: CleanInvoicePaymentApplied[];
  /** Bearer token for the hosted /pay/{token} page. */
  payToken?: string;
  /** Number of dunning stages already sent (index into org dunning offsets). */
  dunningStage?: number;
  lastDunningAt?: number;
  updatedAt?: number;
  createdAt: number;
}

export type CleanPayoutLineStatus = 'pending' | 'approved' | 'paid';

export interface CleanPayoutLine {
  techId: string;
  vendorId?: string;
  /**
   * Line kind. Absent = 'time' (back-compat with the original typed-only
   * shape). 'bounty' lines are itemized bonuses (CO2) — never merged into
   * hourly math, clearly typed for downstream payroll/overtime handling
   * (doc 09 §5 compliance flag F3).
   */
  type?: 'time' | 'bounty';
  /** Σ minutes across the period's assignments (override wins). 0 for bounty lines. */
  minutes: number;
  /** 0 for bounty lines. */
  rateMinorPerHour: number;
  amountMinor: number;
  status: CleanPayoutLineStatus;
  paidAt?: number;
  /** Bounty lines only — idempotency + revocation lookup. */
  bountyId?: string;
  bookingId?: string;
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
  | 'stripe'
  | 'invoice'
  | 'timeoff'
  | 'availability'
  | 'incident'
  | 'notification'
  | 'bounty';

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

export type CleanNotificationChannel = 'email' | 'sms' | 'push';

export type CleanNotificationAudience = 'customer' | 'contractor' | 'operator';

/**
 * Every templated send in the product. The ENG §12 matrix + Change Order 1
 * additions. Default copy per (eventKey, channel) lives in
 * clean/notificationDefaults.ts; org overrides in clean_notificationTemplates.
 */
export type CleanNotificationEventKey =
  | 'booking_confirmed'
  | 'booking_assigned'
  | 'booking_changed'
  | 'booking_canceled'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'preauth_upcoming_hold'
  | 'payment_risk'
  | 'receipt'
  | 'review_request'
  | 'lead_recovery'
  // Change Order 1:
  | 'cleaner_en_route' // A1
  | 'invoice_issued' // R1/A2
  | 'invoice_reminder' // A2 (dunning stage is a template variable, not N keys)
  | 'invoice_overdue' // A2
  | 'sos_triggered' // A4 — exempt from plan gating (safety is not a tier)
  | 'bounty_submitted'; // CO2 — operator review-queue nudge (manual approval mode)

/**
 * Org-edited template override for one (eventKey, channel, audience). Only
 * materialized when an operator edits — the merged view is defaults ∪ these.
 * Body/subject use {{dotted.variable}} tokens; rendering fails safe (falls
 * back to the code default, never sends raw placeholders).
 */
export interface CleanNotificationTemplate {
  id: string;
  orgId: string;
  eventKey: CleanNotificationEventKey;
  channel: CleanNotificationChannel;
  audience: CleanNotificationAudience;
  /** Email only. */
  subject?: string;
  /** Maps to the clean-notification email template's heading slot. */
  heading?: string;
  body: string;
  ctaLabel?: string;
  footnote?: string;
  enabled: boolean;
  /** False once operator-edited; true rows mirror the code default. */
  isDefault: boolean;
  updatedBy?: string;
  createdAt: number;
  updatedAt: number;
}

export type CleanNotificationSendStatus =
  | 'sent'
  | 'simulated'
  | 'skipped_optout'
  | 'skipped_disabled'
  | 'skipped_duplicate'
  | 'render_failed'
  | 'error';

/**
 * One channel attempt by the notification engine — the metering/audit record
 * (SMS usage billing derives from these; doc 07 F2 prerequisite).
 */
export interface CleanNotificationSend {
  id: string;
  orgId: string;
  eventKey: CleanNotificationEventKey;
  channel: CleanNotificationChannel;
  audience: CleanNotificationAudience;
  entity?: CleanEventEntity;
  entityId?: string;
  /** Email address or E.164 number (org-scoped PII). */
  to: string;
  status: CleanNotificationSendStatus;
  /** Provider message id (Surge/Resend), when sent. */
  providerId?: string;
  /** SMS segment count, for metered billing. */
  segments?: number;
  error?: string;
  idempotencyKey?: string;
  createdAt: number;
}

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
}

/** A/R dunning schedule (Change Order 1 A2). */
export interface CleanDunningSettings {
  /** Default true for orgs using invoice_terms. */
  enabled?: boolean;
  /**
   * Day offsets relative to the due date, ascending (e.g. [-2, 0, 3, 10]).
   * Each offset is one dunning stage; the sweep sends at most one stage per
   * run per invoice and stops structurally once the invoice is paid.
   */
  offsets?: number[];
}

export interface CleanOrgSettings {
  /** Path slug on the public booking site (book.turnwrk.com/{slug}). */
  bookingSiteSlug?: string;
  /** Bookable arrival windows shown on the wizard Date step. */
  arrivalWindows?: CleanArrivalWindow[];
  /** Max concurrent bookings per window (availability rule v1). */
  maxConcurrentPerWindow?: number;
  /** Org-default payment policy. Absent = 'card_required_preauth'. */
  paymentPolicy?: CleanPaymentPolicy;
  /** Org-default invoice terms in days (invoice_terms policy). Absent = 14. */
  invoiceTermsDays?: number;
  communications?: CleanCommunicationsSettings;
  dunning?: CleanDunningSettings;
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
