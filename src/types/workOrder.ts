import type { CleanArrivalWindow, CleanExtraSnapshot, CleanParamSnapshot } from './clean';

export type WOStatus =
  | 'Pending Approval'
  | 'Backlog'
  | 'Scheduled'
  | 'In Progress'
  | 'Review'
  | 'Completed'
  | 'Cancelled';

export type WOPriority = 'High' | 'Medium' | 'Low';

export type WOType =
  | 'Repair'
  | 'Onboarding'
  | 'GuestExperience'
  | 'Resupply'
  | 'PreventativeMaintenance'
  /** Turnwrk Clean job types. 'Cleaning' is 1:1 with a clean_bookings doc. */
  | 'Cleaning'
  /** Auto-created from occupancy checkouts (no booking/payment). */
  | 'Turnover';

/**
 * Cleaning-specific snapshot carried on `WOType 'Cleaning' | 'Turnover'` work
 * orders — what the cleaner needs at the door, frozen from the booking so the
 * card renders offline without a clean_bookings read.
 */
export interface CleaningJobDetails {
  serviceLabel: string;
  paramsSnapshot: CleanParamSnapshot[];
  extrasSnapshot: CleanExtraSnapshot[];
  arrivalWindow: CleanArrivalWindow;
  estMinutes: number;
  customerNotes?: string;
  parking?: string;
  access?: string;
  /** Residential mode: whether the customer expects to be home. */
  customerHome?: boolean;
}
