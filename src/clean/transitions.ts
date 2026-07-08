/**
 * Turnwrk Clean state machines (spec 02 §11) — pure guard logic.
 *
 * Every entity write MUST go through these guards (via the Admin-SDK server
 * layer, which batches the entity update with a `clean_events` doc). Illegal
 * transitions throw so callers can't silently corrupt lifecycle state.
 */
import type {
  CleanAssignmentStatus,
  CleanBookingStatus,
  CleanLeadStatus,
  CleanPaymentStatus,
} from '../types/clean';
import type { WOStatus } from '../types/workOrder';

export class CleanTransitionError extends Error {
  constructor(readonly entity: string, readonly from: string, readonly to: string) {
    super(`Illegal ${entity} transition: ${from} → ${to}`);
    this.name = 'CleanTransitionError';
  }
}

// ---------------------------------------------------------------------------
// Booking: draft → booked → assigned → in_progress → completed → closed
// on_hold ⇄ (booked|assigned) · canceled from any pre-completed state
// ---------------------------------------------------------------------------

export const BOOKING_TRANSITIONS: Record<CleanBookingStatus, CleanBookingStatus[]> = {
  draft: ['booked', 'canceled'],
  booked: ['assigned', 'on_hold', 'canceled'],
  // assigned → booked covers contractor declines re-flagging Unassigned
  assigned: ['in_progress', 'booked', 'on_hold', 'canceled'],
  in_progress: ['completed', 'canceled'],
  // completed → closed fires when payment is terminal-paid + review window elapsed
  completed: ['closed'],
  closed: [],
  // release restores CleanBooking.heldFromStatus (booked|assigned)
  on_hold: ['booked', 'assigned', 'canceled'],
  canceled: [],
};

export function assertBookingTransition(from: CleanBookingStatus, to: CleanBookingStatus): void {
  if (!BOOKING_TRANSITIONS[from]?.includes(to)) {
    throw new CleanTransitionError('booking', from, to);
  }
}

/**
 * The Kanban column a booking status maps onto (decided mapping, doc 04 §2).
 * `on_hold` returns null — the WO keeps its column and renders a hold badge.
 */
export function woStatusForBookingStatus(status: CleanBookingStatus): WOStatus | null {
  switch (status) {
    case 'draft':
    case 'booked':
      return 'Backlog';
    case 'assigned':
      return 'Scheduled';
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Review';
    case 'closed':
      return 'Completed';
    case 'canceled':
      return 'Cancelled';
    case 'on_hold':
      return null;
  }
}

/**
 * Reverse of `woStatusForBookingStatus` for Kanban → booking sync.
 * Ambiguous WO columns pick the operational booking status (e.g. Backlog → booked).
 */
export function bookingStatusForWoStatus(status: WOStatus): CleanBookingStatus | null {
  switch (status) {
    case 'Backlog':
      return 'booked';
    case 'Scheduled':
      return 'assigned';
    case 'In Progress':
      return 'in_progress';
    case 'Review':
      return 'completed';
    case 'Completed':
      return 'closed';
    case 'Cancelled':
      return 'canceled';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Payment: pending → vaulted → preauthorized → captured (→ refunds)
// "On hold" is the `hold` flag (freezes automation), not a status.
// ---------------------------------------------------------------------------

export const PAYMENT_TRANSITIONS: Record<CleanPaymentStatus, CleanPaymentStatus[]> = {
  // paid_manual covers a cardless booking the operator settled offline.
  pending: ['vaulted', 'paid_manual'],
  // vaulted → captured is the operator "Charge now" path (skips pre-auth)
  vaulted: ['preauthorized', 'captured', 'paid_manual', 'preauth_failed'],
  // void (cancel intent before capture) returns to vaulted; capture completes.
  // paid_manual releases the hold when the customer pays another way.
  preauthorized: ['captured', 'vaulted', 'paid_manual'],
  preauth_failed: ['retrying', 'risk', 'preauthorized', 'paid_manual'],
  retrying: ['preauthorized', 'risk', 'preauth_failed', 'paid_manual'],
  // operator fixed the card / took payment another way
  risk: ['preauthorized', 'captured', 'paid_manual'],
  captured: ['refunded', 'partially_refunded'],
  paid_manual: [],
  partially_refunded: ['refunded', 'partially_refunded'],
  refunded: [],
};

export function assertPaymentTransition(from: CleanPaymentStatus, to: CleanPaymentStatus): void {
  if (!PAYMENT_TRANSITIONS[from]?.includes(to)) {
    throw new CleanTransitionError('payment', from, to);
  }
}

/** Statuses the pre-auth worker may act on (also requires hold !== true). */
export const PREAUTH_ELIGIBLE_STATUSES: CleanPaymentStatus[] = ['vaulted', 'retrying'];

// ---------------------------------------------------------------------------
// Assignment: assigned → notified → accepted → (checked_in/out on the doc);
// declined/removed terminal.
// ---------------------------------------------------------------------------

export const ASSIGNMENT_TRANSITIONS: Record<CleanAssignmentStatus, CleanAssignmentStatus[]> = {
  assigned: ['notified', 'accepted', 'declined', 'removed'],
  notified: ['accepted', 'declined', 'removed'],
  accepted: ['removed'],
  declined: [],
  removed: [],
};

export function assertAssignmentTransition(
  from: CleanAssignmentStatus,
  to: CleanAssignmentStatus,
): void {
  if (!ASSIGNMENT_TRANSITIONS[from]?.includes(to)) {
    throw new CleanTransitionError('assignment', from, to);
  }
}

/** Check-in is allowed while the assignment is live (not declined/removed). */
export function canCheckIn(status: CleanAssignmentStatus): boolean {
  return status === 'assigned' || status === 'notified' || status === 'accepted';
}

// ---------------------------------------------------------------------------
// Lead: open → contacted → converted | dead
// ---------------------------------------------------------------------------

export const LEAD_TRANSITIONS: Record<CleanLeadStatus, CleanLeadStatus[]> = {
  open: ['contacted', 'converted', 'dead'],
  contacted: ['converted', 'dead'],
  converted: [],
  dead: [],
};

export function assertLeadTransition(from: CleanLeadStatus, to: CleanLeadStatus): void {
  if (!LEAD_TRANSITIONS[from]?.includes(to)) {
    throw new CleanTransitionError('lead', from, to);
  }
}
