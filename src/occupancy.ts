/**
 * Pure unit-occupancy helpers shared by dispatch (public vendor calendar,
 * dispatch scheduling pre-fill) and turnwrk-cortex (AI assignment scheduling).
 * No firebase imports — runs in server components, Express services, and vitest.
 *
 * Date semantics (canonical, matches hostfix `isPropertyOccupiedByBooking`):
 * dates are local-timezone `YYYY-MM-DD` strings and an active booking occupies
 * `checkIn <= day < checkOut` — the checkout day itself is VACANT (turnover
 * cleans are scheduled on checkout day by design).
 *
 * Two layers live here and answer DIFFERENT questions — pick deliberately:
 *   - Ranges (`bookingsToOccupiedRanges` / `isOccupiedOn`): "is a guest in the
 *     unit at some point on this day?" Right for an occupancy badge.
 *   - Day kinds (`buildOccupancyIndex` / `OccupancyKind`): "what does this day
 *     look like to a vendor?" Right for the public calendar and for scheduling,
 *     because it keeps the seam between back-to-back stays that merging erases.
 *
 * Lifted from dispatch/lib/publicCalendar.ts (TURNWRK-224); that module
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

/* ------------------------------------------------------------------------- *
 * Boundary days and guest-free windows
 *
 * The range primitives above answer one question — "is a guest in the unit at
 * some point on this day". That is the right answer for an occupancy badge and
 * the wrong one for a vendor deciding whether to show up: on a turnover day a
 * guest checks out at 10:00 and the next checks in at 16:00, leaving a real
 * ~6h window. Ranges cannot express that, because merging back-to-back stays
 * erases the seam between them.
 *
 * `OccupancyKind` classifies each DAY instead, from the unmerged bookings, so
 * the seam survives. Times stay out of the classifier deliberately (see
 * `resolveOccupancyWindow`).
 * ------------------------------------------------------------------------- */

/**
 * What a single calendar day looks like for a vendor.
 * - `occupied` — a guest is mid-stay: no window, do not disturb.
 * - `checkout` — a stay ends here; free after checkout time.
 * - `turnover` — one stay ends and another begins; free between the two times.
 * - `checkin`  — a stay begins here; free until check-in time.
 * - `vacant`   — nobody in the unit at all.
 */
export type OccupancyKind = 'vacant' | 'checkout' | 'turnover' | 'checkin' | 'occupied';

type BookingDates = { checkIn: string; checkOut: string; status: string };

/** Same active-booking filter `bookingsToOccupiedRanges` uses, so both agree on which rows count. */
function activeBookings<T extends BookingDates>(bookings: T[]): T[] {
  return bookings.filter(
    b => b.status === 'active' && b.checkIn && b.checkOut && b.checkIn < b.checkOut,
  );
}

/**
 * Fold the three day-flags into a kind. `mid` wins over everything: when a
 * second, overlapping stay straddles the day, a checkout or check-in on it
 * frees nothing, so it must not be advertised as a window.
 */
function foldOccupancyKind(mid: boolean, out: boolean, cin: boolean): OccupancyKind {
  if (mid) return 'occupied';
  if (out && cin) return 'turnover';
  if (out) return 'checkout';
  if (cin) return 'checkin';
  return 'vacant';
}

/**
 * Classify one date. O(bookings) — for a whole grid use `buildOccupancyIndex`,
 * which is O(bookings + days) instead of O(bookings × days).
 */
export function classifyDay(bookings: BookingDates[], dateStr: string): OccupancyKind {
  if (!dateStr) return 'vacant';
  const active = activeBookings(bookings);
  const mid = active.some(b => b.checkIn < dateStr && dateStr < b.checkOut);
  const out = active.some(b => b.checkOut === dateStr);
  const cin = active.some(b => b.checkIn === dateStr);
  return foldOccupancyKind(mid, out, cin);
}

/**
 * `dateStr -> OccupancyKind` for every non-vacant day the bookings imply.
 * Absent keys mean `vacant`, so read it through `occupancyKindOn`.
 *
 * `fromDateStr` / `toDateStr` (both inclusive) clamp the map for properties
 * with years of history. Clamping never changes a day's kind — a stay
 * straddling the window still marks its in-window days `occupied`.
 */
export function buildOccupancyIndex(
  bookings: BookingDates[],
  opts: { fromDateStr?: string; toDateStr?: string } = {},
): Map<string, OccupancyKind> {
  const { fromDateStr, toDateStr } = opts;
  const inWindow = (d: string) =>
    (!fromDateStr || d >= fromDateStr) && (!toDateStr || d <= toDateStr);

  const mids = new Set<string>();
  const outs = new Set<string>();
  const cins = new Set<string>();

  for (const b of activeBookings(bookings)) {
    if (inWindow(b.checkOut)) outs.add(b.checkOut);
    if (inWindow(b.checkIn)) cins.add(b.checkIn);
    // Days strictly between checkIn and checkOut, clamped to the window so a
    // multi-year block doesn't walk day by day across the whole stay.
    let cursor = addDaysStr(b.checkIn, 1);
    if (fromDateStr && cursor < fromDateStr) cursor = fromDateStr;
    const stop = toDateStr && toDateStr < b.checkOut ? addDaysStr(toDateStr, 1) : b.checkOut;
    for (; cursor < stop; cursor = addDaysStr(cursor, 1)) {
      mids.add(cursor);
    }
  }

  const index = new Map<string, OccupancyKind>();
  for (const dateStr of new Set([...mids, ...outs, ...cins])) {
    const kind = foldOccupancyKind(mids.has(dateStr), outs.has(dateStr), cins.has(dateStr));
    if (kind !== 'vacant') index.set(dateStr, kind);
  }
  return index;
}

/** Per-day occupancy index for one property from a mixed-property booking list. */
export function propertyOccupancyIndex(
  bookings: OccupancyBookingLike[],
  propertyId: string,
  opts: { fromDateStr?: string; toDateStr?: string } = {},
): Map<string, OccupancyKind> {
  return buildOccupancyIndex(bookings.filter(b => b.propertyId === propertyId), opts);
}

/** Read a day out of an index; absent means vacant. */
export function occupancyKindOn(
  index: Map<string, OccupancyKind>,
  dateStr: string,
): OccupancyKind {
  return index.get(dateStr) ?? 'vacant';
}

/**
 * True only when the unit is held the WHOLE day. Boundary days are not
 * blocked — that is the entire point of classifying them separately.
 */
export function isDayBlocked(kind: OccupancyKind): boolean {
  return kind === 'occupied';
}

/**
 * Earliest day on/after `fromDateStr` that is not fully occupied.
 *
 * Unlike `firstVacantDayOnOrAfter`, which walks MERGED ranges and jumps to each
 * range's final `end`, this walks the per-day index and therefore stops at an
 * intermediate turnover day between back-to-back stays.
 *
 * `capped: true` means the day is more than `maxLookaheadDays` out — the caller
 * must log loudly and fall back rather than silently booking months ahead.
 */
export function firstSchedulableDayOnOrAfter(
  index: Map<string, OccupancyKind>,
  fromDateStr: string,
  maxLookaheadDays = 60,
): { dateStr: string; skippedOccupiedDays: boolean; capped: boolean } {
  const limit = addDaysStr(fromDateStr, maxLookaheadDays);
  let current = fromDateStr;
  let skippedOccupiedDays = false;
  while (isDayBlocked(occupancyKindOn(index, current))) {
    current = addDaysStr(current, 1);
    skippedOccupiedDays = true;
    // Nothing in the index is blocked past the last booking, so this terminates;
    // the guard only bounds pathological indexes (decades of contiguous stays).
    if (current > limit) break;
  }
  return { dateStr: current, skippedOccupiedDays, capped: current > limit };
}

/** Fallback check-in time when a property has none set. */
export const DEFAULT_CHECK_IN_TIME = '16:00';
/** Fallback checkout time when a property has none set. */
export const DEFAULT_CHECK_OUT_TIME = '10:00';

/**
 * Coerce a stored time to `HH:MM` 24h, falling back when it isn't one.
 * `PropertyMaintenance.checkInTime` is a free-form `string?` written by several
 * code paths (and legacy flat CMMS-era docs), so `'3pm'` / `'15:00:00'` /
 * `'25:00'` are all reachable in production and must not reach a UI label.
 */
export function normalizeTimeOfDay(raw: string | undefined, fallback: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec((raw ?? '').trim());
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return `${match[1]}:${match[2]}`;
}

/** The guest-free part of a day. `from`/`to` are `HH:MM`, with `24:00` meaning end-of-day. */
export interface OccupancyWindow {
  kind: OccupancyKind;
  from: string;
  to: string;
  /** False when there is no guest-free time at all — render as occupied. */
  hasWindow: boolean;
}

/**
 * Layer property check-in/checkout times onto a day kind.
 *
 * Times live here rather than in the classifier on purpose: scheduling callers
 * only ever ask "is this day blocked" and have no property doc in scope, and if
 * per-booking times ever arrive (ICS feeds that publish them) only this
 * function changes shape.
 */
export function resolveOccupancyWindow(
  kind: OccupancyKind,
  times: { checkInTime?: string; checkOutTime?: string } = {},
): OccupancyWindow {
  const checkIn = normalizeTimeOfDay(times.checkInTime, DEFAULT_CHECK_IN_TIME);
  const checkOut = normalizeTimeOfDay(times.checkOutTime, DEFAULT_CHECK_OUT_TIME);

  switch (kind) {
    case 'vacant':
      return { kind, from: '00:00', to: '24:00', hasWindow: true };
    case 'checkout':
      return { kind, from: checkOut, to: '24:00', hasWindow: true };
    case 'checkin':
      return { kind, from: '00:00', to: checkIn, hasWindow: true };
    case 'turnover':
      // Same-day or inverted times mean the incoming guest arrives before the
      // outgoing one leaves — no window, however the property is configured.
      return { kind, from: checkOut, to: checkIn, hasWindow: checkOut < checkIn };
    case 'occupied':
    default:
      return { kind: 'occupied', from: '', to: '', hasWindow: false };
  }
}
