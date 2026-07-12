/**
 * Org-timezone date math without a TZ library. Used to compute
 * `CleanBooking.scheduledStartUtc` ONCE at write time — workers then compare
 * plain epoch ms and never repeat timezone logic (clock-skew/DST safe).
 */

const DEFAULT_TIMEZONE = 'America/Chicago';

function tzOffsetMs(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - utcMs;
}

/**
 * Epoch ms of `date` (YYYY-MM-DD) at `time` (HH:mm) in `timeZone`.
 * Two-pass offset resolution handles DST edges: guess with the UTC offset at
 * the naive instant, then correct with the offset at the guessed instant.
 */
export function zonedTimeToUtcMs(
  date: string,
  time: string,
  timeZone: string | undefined,
): number {
  const tz = timeZone || DEFAULT_TIMEZONE;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const naiveUtc = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
  const first = naiveUtc - tzOffsetMs(naiveUtc, tz);
  return naiveUtc - tzOffsetMs(first, tz);
}

/** Pre-auth instant: T-48h before the booking's scheduled window start. */
export function preauthDueAtFor(scheduledStartUtc: number): number {
  return scheduledStartUtc - 48 * 60 * 60 * 1000;
}

/** Add whole days to an org-local YYYY-MM-DD (pure calendar math, DST-immune). */
export function addDaysToDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return dt.toISOString().slice(0, 10);
}
