/**
 * Money contracts (Verticals C5 — TURNWRK-324).
 *
 * The suite's one complete money model — quote, invoice, payment, payment
 * policy and payout — extracted from `src/types/clean.ts`. These shapes carry
 * ZERO cleaning logic: pricing is `base + Σ(param.qty × unit) + Σ(extras)`, the
 * A/R and payout lifecycles are trade-agnostic. Clean's owner invoice was the
 * only complete money model in the suite, so it moves to the shared core and
 * Dispatch's property-grouped owner invoice can retire against it (settles
 * TURNWRK-279).
 *
 * Money rules, preserved verbatim from the Clean spec:
 *   - integer minor units in the org currency (never floats);
 *   - timestamps are epoch ms (UTC) in storage — the org timezone is a display
 *     concern applied at render, not a stored offset;
 *   - percentages (`discountPct`, `taxPct`) are whole percents (25 = 25%);
 *   - state transitions are auditable — payment/invoice moves go through
 *     `@turnwrk/shared/booking/transitions` and the append-only event stream.
 *
 * `frequencyKey` still points at `CleanFrequencyKey`, the booking cadence type
 * that stays in `../types/clean` (opened to pack-declared cadences in B2); the
 * money model consumes it but does not own it.
 */
import type { CleanFrequencyKey } from '../types/clean';

// ---------------------------------------------------------------------------
// Quotes (shared FE/BE pricing result — see ../service/pricing.ts)
// ---------------------------------------------------------------------------

export interface QtySelection {
  id: string;
  qty: number;
}

/** What the customer picked; the input to the pure pricing function. */
export interface QuoteSelection {
  serviceId: string;
  frequencyKey: CleanFrequencyKey;
  params: QtySelection[];
  extras: QtySelection[];
  discountCode?: string;
}

export interface ParamSnapshot {
  paramId: string;
  label: string;
  qty: number;
  unitPriceMinor: number;
  unitMinutes: number;
  lineTotalMinor: number;
}

export interface ExtraSnapshot {
  extraId: string;
  label: string;
  qty: number;
  priceMinor: number;
  minutes: number;
  lineTotalMinor: number;
}

export interface Pricing {
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
export interface Quote {
  selection: QuoteSelection;
  serviceLabel: string;
  paramsSnapshot: ParamSnapshot[];
  extrasSnapshot: ExtraSnapshot[];
  pricing: Pricing;
  estMinutes: number;
}

// ---------------------------------------------------------------------------
// Payments, invoices, payouts
// ---------------------------------------------------------------------------

/**
 * How money is collected for a booking (Change Order 1 R1). Resolved
 * customer → service → org → 'card_required_preauth' via
 * ./paymentPolicy and snapshotted onto the booking + payment.
 *
 *  - card_required_preauth:     vault → T-48h pre-auth → capture on completion
 *  - card_on_file_charge_after: vault → charge on completion (no pre-auth)
 *  - invoice_terms:             no card required; invoice on completion, A/R lifecycle
 *  - offline:                   tracked only; operator uses Mark-as-Paid
 */
export type PaymentPolicy =
  | 'card_required_preauth'
  | 'card_on_file_charge_after'
  | 'invoice_terms'
  | 'offline';

export type PaymentStatus =
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

export type ManualPaymentMethod = 'cash' | 'bank_transfer' | 'check';

/**
 * Customer-side payment lifecycle for one booking. "On hold" is the `hold`
 * flag, not a status — it freezes automation (pre-auth/capture workers skip
 * held payments) without losing lifecycle position.
 */
export interface Payment {
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
  status: PaymentStatus;
  amountMinor: number;
  preauthAmountMinor?: number;
  /** Epoch ms when the T-48h pre-auth is due — the worker's query key. */
  preauthDueAt?: number;
  preauthAt?: number;
  /** When the "upcoming hold" customer notice was sent (sweep lookahead, R2). */
  preauthNoticeAt?: number;
  capturedAt?: number;
  refundedMinor?: number;
  /** Application fee collected at capture (TURNWRK-301). */
  collectedApplicationFeeMinor?: number;
  collectedTakeRateMinor?: number;
  collectedProcessingFeeMinor?: number;
  collectedPaymentRateBps?: number;
  stripeApplicationFeeId?: string;
  stripeChargeId?: string;
  retryCount?: number;
  /** Next retry instant after a pre-auth failure. */
  retryAt?: number;
  /** In-flight idempotency marker written before each Stripe call. */
  processingAt?: number;
  lastError?: string;
  hold?: boolean;
  manualMethod?: ManualPaymentMethod;
  manualPaidAt?: number;
  invoiceId?: string;
  /** Policy snapshot from the booking. Absent (legacy) = 'card_required_preauth'. */
  policy?: PaymentPolicy;
  /** Admin push when status entered `risk` (hostfix sendCleanOpsPushes). */
  paymentRiskPushAt?: number;
  createdAt: number;
  updatedAt: number;
}

/** Receipt = record of a settled card/manual payment. Invoice = A/R billable. */
export type InvoiceKind = 'receipt' | 'invoice';

export type InvoiceStatus = 'open' | 'partially_paid' | 'paid' | 'overdue' | 'void';

/** One payment applied against an A/R invoice (partial payments supported). */
export interface InvoicePaymentApplied {
  id: string;
  amountMinor: number;
  /** 'card' = hosted pay-link payment; others recorded by the operator. */
  method: 'card' | ManualPaymentMethod;
  /** Gateway PaymentIntent id when method === 'card'. */
  intentId?: string;
  receivedAt: number;
  /** uid, 'system' (webhook backstop), or 'customer:{customerId}'. */
  actorId: string;
  note?: string;
}

export interface Invoice {
  id: string;
  orgId: string;
  bookingId: string;
  paymentId: string;
  /** Per-org sequential number ("INV-000042"). */
  number: string;
  /** Firebase Storage path of the rendered PDF. */
  pdfPath?: string;
  emailedAt?: number;
  totalsSnapshot: Pricing;
  // --- A/R lifecycle (Change Order 1 R1/A2). Absent kind (legacy docs) = a
  // --- settled 'receipt'; the fields below only apply to kind 'invoice'.
  kind?: InvoiceKind;
  status?: InvoiceStatus;
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
  paymentsApplied?: InvoicePaymentApplied[];
  /** Bearer token for the hosted /pay/{token} page. */
  payToken?: string;
  // --- Trades path (TURNWRK-279) — customer-keyed invoice on the same A/R doc.
  customerId?: string;
  estimateId?: string;
  workOrderId?: string;
  workOrderIds?: string[];
  /** Deposit collected on estimate approval, credited on the invoice. */
  depositAppliedMinor?: number;
  /**
   * Customer-visible line items (markup rolled in per TURNWRK-273). Internal
   * pricing may still carry markup rows on the linked estimate.
   */
  customerLineItems?: Array<{
    id: string;
    kind: 'labor' | 'material';
    label: string;
    quantity: number;
    unitMinor: number;
    totalMinor: number;
  }>;
  /** Number of dunning stages already sent (index into org dunning offsets). */
  dunningStage?: number;
  lastDunningAt?: number;
  updatedAt?: number;
  createdAt: number;
}

export type PayoutLineStatus = 'pending' | 'approved' | 'paid';

export interface PayoutLine {
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
  status: PayoutLineStatus;
  paidAt?: number;
  /** Bounty lines only — idempotency + revocation lookup. */
  bountyId?: string;
  bookingId?: string;
  /** Time lines only — idempotency key for check-out / override upserts. */
  assignmentId?: string;
}

export interface PayoutPeriod {
  id: string;
  orgId: string;
  /** Org-local dates, inclusive. */
  periodStart: string;
  periodEnd: string;
  status: 'open' | 'closed';
  lines: PayoutLine[];
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// A/R dunning schedule (Change Order 1 A2) — drives ./payments planDunning
// ---------------------------------------------------------------------------

/** A/R dunning schedule (Change Order 1 A2). */
export interface DunningSettings {
  /** Default true for orgs using invoice_terms. */
  enabled?: boolean;
  /**
   * Day offsets relative to the due date, ascending (e.g. [-2, 0, 3, 10]).
   * Each offset is one dunning stage; the sweep sends at most one stage per
   * run per invoice and stops structurally once the invoice is paid.
   */
  offsets?: number[];
}
