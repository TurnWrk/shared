import type { CleanInvoice, CleanInvoiceKind } from '../types/clean';

const AR_STATUSES = new Set(['open', 'partially_paid', 'overdue']);

/**
 * Dual-read `CleanInvoice.kind` (TURNWRK-82).
 *
 * New docs set `kind` explicitly. Legacy docs omit it — the type comment says
 * absent = settled `'receipt'`, but early A/R invoices were written without
 * `kind` while carrying `dueAtUtc` / `payToken` / open statuses. Those must
 * resolve as `'invoice'` so dunning + LTV don't skip them.
 */
export function resolveInvoiceKind(
  inv: Pick<
    CleanInvoice,
    'kind' | 'dueAtUtc' | 'payToken' | 'status' | 'termsDays' | 'balanceMinor'
  >,
): CleanInvoiceKind {
  if (inv.kind === 'invoice' || inv.kind === 'receipt') return inv.kind;

  const hasArMarkers =
    inv.dueAtUtc !== undefined ||
    Boolean(inv.payToken?.trim()) ||
    (inv.status !== undefined && AR_STATUSES.has(inv.status)) ||
    inv.termsDays !== undefined ||
    (typeof inv.balanceMinor === 'number' && inv.balanceMinor > 0);

  return hasArMarkers ? 'invoice' : 'receipt';
}

/** True when readers should treat this doc as an A/R invoice. */
export function isArInvoice(
  inv: Pick<
    CleanInvoice,
    'kind' | 'dueAtUtc' | 'payToken' | 'status' | 'termsDays' | 'balanceMinor'
  >,
): boolean {
  return resolveInvoiceKind(inv) === 'invoice';
}

/**
 * Patch shape for backfill: stamp missing `kind` to the dual-read result.
 * Returns null when `kind` is already set (unless `force`).
 */
export function legacyInvoiceKindPatch(
  inv: Pick<
    CleanInvoice,
    'kind' | 'dueAtUtc' | 'payToken' | 'status' | 'termsDays' | 'balanceMinor'
  >,
  opts?: { force?: boolean },
): { kind: CleanInvoiceKind } | null {
  if (inv.kind === 'invoice' || inv.kind === 'receipt') {
    if (!opts?.force) return null;
  }
  return { kind: resolveInvoiceKind(inv) };
}
