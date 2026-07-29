/**
 * Booking, series and assignment contracts (Verticals C4 — TURNWRK-323).
 *
 * Extracted from src/types/clean.ts. None of this carried cleaning assumptions —
 * it is the general booking platform wearing a Clean name.
 *
 * NAMING: `CleanBooking` becomes `ServiceBooking`, not `Booking`, because
 * Dispatch already owns `Booking` for guest stays (dispatch/types.ts:791) — the
 * collision rule in docs/projects/VERTICAL-MODULES.md. `ServiceBookingSource`
 * keeps its prefix for the same reason — `BookingSource` is already the STR
 * channel enum in types/integration.ts. The rest drop the prefix outright.
 */
import type { ChecklistItemStatus } from '../types/checklist';
import type {
  CleanArrivalWindow,
  CleanExtraSnapshot,
  CleanFrequencyKey,
  CleanParamSnapshot,
  CleanPaymentPolicy,
  CleanPricing,
  CleanQuote,
  CleanQuoteSelection,
} from '../types/clean';

export type BookingStatus =
  | 'draft'
  | 'booked'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'closed'
  | 'on_hold'
  | 'canceled';

export type ServiceBookingSource = 'widget' | 'manual' | 'ai_intake' | 'auto_turnover' | 'series';

/**
 * One booking occurrence. 1:1 with a `cmms_workOrders` doc
 * (`WOType 'Cleaning'`); turnover jobs created from occupancy checkouts have
 * a WO but no booking/payment.
 */
export interface ServiceBooking {
  id: string;
  orgId: string;
  customerId: string;
  propertyId: string;
  serviceId: string;
  serviceLabel: string;
  frequencyKey: CleanFrequencyKey;
  status: BookingStatus;
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
  source: ServiceBookingSource;
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
  heldFromStatus?: BookingStatus;
  /** Contractor-push reminder markers (written by the hostfix sendCleanReminders worker). */
  reminder24hAt?: number;
  reminder2hAt?: number;
  /** Contractor unreported nudge (hostfix sendCleanOpsPushes — past start, no check-in). */
  unreportedPushAt?: number;
  /** Customer reminder markers (written by clean/'s notifications sweep — R2). */
  customerReminder24hAt?: number;
  customerReminder2hAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type SeriesStatus = 'active' | 'paused' | 'canceled';

/** Recurrence template; a scheduled worker materializes N future bookings. */
export interface BookingSeries {
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
  status: SeriesStatus;
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

export type AssignmentStatus =
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
export interface Assignment {
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
  status: AssignmentStatus;
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
