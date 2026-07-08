/**
 * Pure decision helpers for the Clean payments engine — no I/O, unit-tested.
 * The Admin-SDK server layer (clean/src/lib/clean/paymentsServer.ts) executes
 * the actions these return; keeping the logic here makes it deterministic and
 * shared by the operator UI (allocation preview) and the pre-auth worker.
 *
 * Spec: docs/projects/clean/02-ENGINEERING-SPEC.md §M4 (payments lifecycle).
 */
import type { CleanPayment } from '../types/clean';
import { splitAllocatedMinutes } from './pricing';

// ---------------------------------------------------------------------------
// Pre-auth sweep planning (T-48h worker)
// ---------------------------------------------------------------------------

export interface PreauthSweepConfig {
  /** Attempts before a payment is flagged `risk`. Default 3. */
  maxRetries: number;
  /** Spacing between retries, ms. Default 6h. */
  retrySpacingMs: number;
  /** A `processingAt` newer than this (ms) means another worker holds it. Default 10min. */
  staleMs: number;
}

export const DEFAULT_PREAUTH_SWEEP_CONFIG: PreauthSweepConfig = {
  maxRetries: 3,
  retrySpacingMs: 6 * 60 * 60 * 1000,
  staleMs: 10 * 60 * 1000,
};

export type PreauthSweepActionKind = 'preauthorize' | 'risk' | 'skip';

export interface PreauthSweepAction {
  paymentId: string;
  kind: PreauthSweepActionKind;
  /** Gateway idempotency key (kind === 'preauthorize'). */
  idempotencyKey?: string;
  /** Why skipped/risked — for logging. */
  reason?: string;
}

/**
 * Decide what to do with each pre-auth-eligible payment. Pure: the caller
 * passes the queried docs + `now`, then executes the returned actions. Never
 * mutates input.
 *
 * Rules (mirror PREAUTH_ELIGIBLE_STATUSES + the hold/processingAt guards):
 *   - `hold` or a fresh `processingAt`      → skip
 *   - `retryCount >= maxRetries`            → risk
 *   - `retrying` before `retryAt`           → skip (not due)
 *   - `vaulted` / due `retrying`            → preauthorize
 *   - anything else                         → skip
 */
export function planPreauthSweep(
  payments: CleanPayment[],
  now: number,
  config: PreauthSweepConfig = DEFAULT_PREAUTH_SWEEP_CONFIG,
): PreauthSweepAction[] {
  return payments.map((p): PreauthSweepAction => {
    if (p.hold) return { paymentId: p.id, kind: 'skip', reason: 'hold' };
    if (p.processingAt && now - p.processingAt < config.staleMs) {
      return { paymentId: p.id, kind: 'skip', reason: 'processing' };
    }
    const retryCount = p.retryCount ?? 0;
    if (retryCount >= config.maxRetries) {
      return { paymentId: p.id, kind: 'risk', reason: 'max_retries' };
    }
    if (p.status === 'retrying' && p.retryAt !== undefined && now < p.retryAt) {
      return { paymentId: p.id, kind: 'skip', reason: 'retry_not_due' };
    }
    if (p.status === 'vaulted' || p.status === 'retrying') {
      return {
        paymentId: p.id,
        kind: 'preauthorize',
        idempotencyKey: `payment:${p.id}:preauth:${retryCount}`,
      };
    }
    return { paymentId: p.id, kind: 'skip', reason: `status:${p.status}` };
  });
}

/** Next retry instant after a failed pre-auth attempt. */
export function nextRetryAt(
  now: number,
  config: PreauthSweepConfig = DEFAULT_PREAUTH_SWEEP_CONFIG,
): number {
  return now + config.retrySpacingMs;
}

// ---------------------------------------------------------------------------
// Assignment allocation (operator auto-split preview == server math)
// ---------------------------------------------------------------------------

export interface AssigneeAllocationInput {
  techId: string;
  /** Explicit allocation; omitted assignees share the remaining minutes evenly. */
  minutes?: number;
}

/**
 * Split a job's estMinutes across assignees: explicit allocations are honored,
 * the remainder is shared evenly via `splitAllocatedMinutes`. This is the exact
 * math `assignCleanBooking` uses, so the operator UI previews the real result.
 */
export function computeAssignmentAllocations(
  estMinutes: number,
  assignees: AssigneeAllocationInput[],
): Map<string, number> {
  const explicit = assignees.filter((a) => a.minutes !== undefined);
  const flexible = assignees.filter((a) => a.minutes === undefined);
  const remaining = Math.max(
    0,
    Math.trunc(estMinutes) - explicit.reduce((sum, a) => sum + (a.minutes ?? 0), 0),
  );
  const flexShares = splitAllocatedMinutes(remaining, flexible.length);
  const out = new Map<string, number>();
  explicit.forEach((a) => out.set(a.techId, a.minutes as number));
  flexible.forEach((a, i) => out.set(a.techId, flexShares[i]));
  return out;
}

// ---------------------------------------------------------------------------
// Invoice numbering
// ---------------------------------------------------------------------------

/** Per-org invoice number, 6-digit zero-padded sequence: `INV-000042`. */
export function formatInvoiceNumber(seq: number): string {
  return `INV-${String(Math.max(0, Math.trunc(seq))).padStart(6, '0')}`;
}
