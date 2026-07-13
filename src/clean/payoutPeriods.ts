/**
 * Payout period math (Change Order 2) — pure, no I/O. First real consumer of
 * clean_payoutPeriods (previously typed-only): approved bounties append
 * itemized `type:'bounty'` lines (doc 09 §2/§5). Timesheet lines (TURNWRK-15)
 * use the same Monday-start periods with `type:'time'` + `assignmentId`.
 *
 * Periods are Monday-start ISO weeks in org-local dates: the ISO-8601
 * convention, matching weekly crew pay cycles and keeping weekend turnover
 * work inside one period. The deterministic doc id makes find-or-create a
 * transactional point-read — no composite index needed.
 */

/** Monday-start week bounds (inclusive) containing an org-local YYYY-MM-DD. */
export function weekBoundsFor(orgLocalDate: string): { periodStart: string; periodEnd: string } {
  const [y, m, d] = orgLocalDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  // getUTCDay: 0=Sun..6=Sat → days since Monday.
  const sinceMonday = (dt.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) - sinceMonday));
  const end = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) - sinceMonday + 6));
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

/** Deterministic clean_payoutPeriods doc id — one doc per org-week. */
export function payoutPeriodDocId(orgId: string, periodStart: string): string {
  return `${orgId}_${periodStart}`;
}

/** Override wins over actual — payroll source of truth on clean_assignments. */
export function billableMinutes(input: {
  actualMinutes?: number | null;
  overrideMinutes?: number | null;
}): number {
  if (typeof input.overrideMinutes === 'number' && Number.isFinite(input.overrideMinutes)) {
    return Math.max(0, Math.round(input.overrideMinutes));
  }
  if (typeof input.actualMinutes === 'number' && Number.isFinite(input.actualMinutes)) {
    return Math.max(0, Math.round(input.actualMinutes));
  }
  return 0;
}

/** Integer minor units: (minutes / 60) × hourly rate. */
export function timePayoutAmountMinor(minutes: number, rateMinorPerHour: number): number {
  if (minutes <= 0 || rateMinorPerHour <= 0) return 0;
  return Math.round((minutes / 60) * rateMinorPerHour);
}
