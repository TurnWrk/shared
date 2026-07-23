/**
 * Pure unit-occupancy helpers shared by hostfix-cmms (public vendor calendar,
 * dispatch scheduling pre-fill) and turnwrk-cortex (AI assignment scheduling).
 * No firebase imports — runs in server components, Express services, and vitest.
 *
 * Date semantics (canonical, matches hostfix `isPropertyOccupiedByBooking`):
 * dates are local-timezone `YYYY-MM-DD` strings and an active booking occupies
 * `checkIn <= day < checkOut` — the checkout day itself is VACANT (turnover
 * cleans are scheduled on checkout day by design).
 *
 * Lifted from hostfix-cmms/lib/publicCalendar.ts (TURNWRK-224); that module
 * re-exports these so the public calendar keeps a single implementation.
 */

export interface OccupiedRange {
  /** First occupied day, YYYY-MM-DD inclusive. */
  start: string;
  /** Checkout day, YYYY-MM-DD exclusive (this day is vacant). */
  end: string;
}

/** Minimal booking shape — cmms_bookings docs and store Booking objects both satisfy it. */
export interface OccupancyBookingLike {
  propertyId?: string;
  checkIn: string;
  checkOut: string;
  status: string;
}

/** Format a Date as YYYY-MM-DD in local timezone (avoids UTC shift at night). */
export function occupancyLocalDateStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDaysStr(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return occupancyLocalDateStr(d);
}

/**
 * Collapse bookings into sorted, merged occupied ranges. Cancelled bookings
 * and malformed date pairs are dropped; overlapping or back-to-back stays
 * (next checkIn <= previous checkOut) merge into one continuous block.
 */
export function bookingsToOccupiedRanges(
  bookings: Array<{ checkIn: string; checkOut: string; status: string }>,
): OccupiedRange[] {
  const active = bookings
    .filter(b => b.status === 'active' && b.checkIn && b.checkOut && b.checkIn < b.checkOut)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  const ranges: OccupiedRange[] = [];
  for (const b of active) {
    const last = ranges[ranges.length - 1];
    if (last && b.checkIn <= last.end) {
      if (b.checkOut > last.end) last.end = b.checkOut;
    } else {
      ranges.push({ start: b.checkIn, end: b.checkOut });
    }
  }
  return ranges;
}

/** A day is occupied when some range has `start <= day < end`. */
export function isOccupiedOn(ranges: OccupiedRange[], dateStr: string): boolean {
  return ranges.some(r => r.start <= dateStr && r.end > dateStr);
}

/** Occupied ranges for one property from a mixed-property booking list. */
export function propertyOccupiedRanges(
  bookings: OccupancyBookingLike[],
  propertyId: string,
): OccupiedRange[] {
  return bookingsToOccupiedRanges(bookings.filter(b => b.propertyId === propertyId));
}

/**
 * Earliest vacant day on or after `fromDateStr`, jumping to each blocking
 * range's checkout day. Ranges must come from `bookingsToOccupiedRanges`
 * (sorted + merged), which guarantees every `end` is a vacant day.
 *
 * `capped: true` means the vacant day is more than `maxLookaheadDays` out —
 * the caller must log loudly and fall back rather than silently booking
 * months ahead.
 */
export function firstVacantDayOnOrAfter(
  ranges: OccupiedRange[],
  fromDateStr: string,
  maxLookaheadDays = 60,
): { dateStr: string; skippedOccupiedDays: boolean; capped: boolean } {
  let current = fromDateStr;
  let skippedOccupiedDays = false;
  for (const r of ranges) {
    if (r.start <= current && r.end > current) {
      current = r.end;
      skippedOccupiedDays = true;
    }
  }
  return {
    dateStr: current,
    skippedOccupiedDays,
    capped: current > addDaysStr(fromDateStr, maxLookaheadDays),
  };
}
