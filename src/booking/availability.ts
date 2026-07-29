/**
 * Contractor availability math (Change Order 1 R3) — pure, no I/O.
 *
 * Degrades gracefully: a tech with NO availability doc (or active:false) is
 * always available, and slot capacity only tightens when the org has any
 * availability data at all — shipped orgs behave exactly as before until an
 * operator configures hours or approves time off.
 */
import type {
  CleanArrivalWindow,
  CleanContractorAvailability,
  CleanTimeOff,
} from '../types/clean';

/**
 * Day-of-week (0 = Sunday … 6 = Saturday) of an org-local calendar date.
 * Pure calendar math — an org-local YYYY-MM-DD has one weekday regardless of
 * timezone, so no TZ conversion is involved.
 */
export function dowForDate(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay();
}

/** "09:30" → 570. Malformed input returns NaN (comparisons then fail closed). */
export function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(':').map(Number);
  return hh * 60 + (mm || 0);
}

/**
 * Does this tech's weekly schedule cover the whole arrival window on `dow`?
 * Absent/inactive doc = yes (always available). Empty weekly array = never.
 */
export function techAvailableForWindow(
  availability: CleanContractorAvailability | undefined,
  window: CleanArrivalWindow,
  dow: number,
): boolean {
  if (!availability || !availability.active) return true;
  const winStart = timeToMinutes(window.start);
  const winEnd = timeToMinutes(window.end);
  return availability.weekly.some(
    (range) =>
      range.dow === dow &&
      timeToMinutes(range.start) <= winStart &&
      timeToMinutes(range.end) >= winEnd,
  );
}

/** Does an APPROVED time-off range cover the org-local date? (inclusive bounds) */
export function timeOffCovers(timeOff: CleanTimeOff, date: string): boolean {
  return timeOff.status === 'approved' && timeOff.startDate <= date && date <= timeOff.endDate;
}

export interface SlotAvailabilityInput {
  /** Active roster tech ids for the org. */
  techIds: string[];
  /** Availability docs keyed by techId (absent = always available). */
  availabilityByTech: Record<string, CleanContractorAvailability | undefined>;
  /** Approved time-off rows overlapping the queried range (any tech). */
  approvedTimeOff: CleanTimeOff[];
  /** Org-local calendar date of the slot. */
  date: string;
  window: CleanArrivalWindow;
}

/** How many roster techs could work this (date, window) slot. */
export function availableTechCountForSlot(input: SlotAvailabilityInput): number {
  const dow = dowForDate(input.date);
  return input.techIds.filter((techId) => {
    if (
      input.approvedTimeOff.some((t) => t.techId === techId && timeOffCovers(t, input.date))
    ) {
      return false;
    }
    return techAvailableForWindow(input.availabilityByTech[techId], input.window, dow);
  }).length;
}

/**
 * Whether contractor data should constrain capacity at all: at least one
 * active availability doc or any approved time off. When false, slots use the
 * org-level rule alone (shipped v1 behavior).
 */
export function hasContractorAvailabilityData(
  availabilityDocs: CleanContractorAvailability[],
  approvedTimeOff: CleanTimeOff[],
): boolean {
  return availabilityDocs.some((a) => a.active) || approvedTimeOff.length > 0;
}

/** Slot capacity: org windows ∩ available-contractor capacity (doc 07 R3). */
export function effectiveSlotCapacity(
  orgCapacity: number,
  availableTechCount: number,
  hasAvailabilityData: boolean,
): number {
  return hasAvailabilityData ? Math.min(orgCapacity, availableTechCount) : orgCapacity;
}
