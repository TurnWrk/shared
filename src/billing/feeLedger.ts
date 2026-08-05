/**
 * Suite application-fee ledger — auditable record of Turnwrk take-rate
 * collections and pro-rata reversals on refunds.
 *
 * Money is integer minor units; timestamps are ISO-8601 UTC strings.
 * Reconciliation compares ledger sums to Stripe's application-fee report.
 */

/** Doc id for a collection entry — the Stripe PaymentIntent id (`pi_…`). */
export function suiteApplicationFeeCollectionDocId(paymentIntentId: string): string {
  return paymentIntentId;
}

/** Doc id for a reversal — the Stripe Refund id (`re_…`, idempotent on retry). */
export function suiteApplicationFeeReversalDocId(refundId: string): string {
  return refundId;
}

export type SuiteApplicationFeeEntryKind = 'collection' | 'reversal';

export interface SuiteApplicationFeeCollection {
  kind: 'collection';
  orgId: string;
  /** Suite plan at charge time (`free` | `pro` | …). */
  planId: string;
  /** Take-rate bps applied to this charge — frozen at collection time. */
  paymentRateBps: number;
  chargeAmountMinor: number;
  takeRateMinor: number;
  processingFeeMinor: number;
  applicationFeeMinor: number;
  stripePaymentIntentId: string;
  stripeChargeId?: string;
  stripeApplicationFeeId?: string;
  /** Platform Connect account that received the fee (e.g. Practical.Works). */
  platformAccountId?: string;
  /** App surface that originated the charge. */
  surface: 'clean' | 'dispatch';
  /** Domain id — svc_payments doc, cmms invoice, etc. */
  sourceId: string;
  sourceType: 'payment' | 'invoice';
  recordedAt: string;
}

export interface SuiteApplicationFeeReversal {
  kind: 'reversal';
  orgId: string;
  /** Links to the collection doc (`pi_…`). */
  collectionDocId: string;
  stripeRefundId: string;
  stripePaymentIntentId: string;
  refundedChargeMinor: number;
  reversalMinor: number;
  recordedAt: string;
}

export type SuiteApplicationFeeEntry = SuiteApplicationFeeCollection | SuiteApplicationFeeReversal;

export interface StripeApplicationFeeReportRow {
  applicationFeeId: string;
  amountMinor: number;
  paymentIntentId?: string;
}

export interface SuiteApplicationFeeReconciliation {
  periodStart: string;
  periodEnd: string;
  ledgerCollectedMinor: number;
  ledgerReversedMinor: number;
  ledgerNetMinor: number;
  stripeReportMinor: number;
  deltaMinor: number;
  matched: boolean;
  unmatchedStripeRows: StripeApplicationFeeReportRow[];
  unmatchedLedgerIntentIds: string[];
}

/**
 * Compare ledger entries in a period against Stripe's application-fee report.
 * Rows are matched on `stripeApplicationFeeId` when present, else PaymentIntent id.
 */
export function reconcileSuiteApplicationFees(input: {
  periodStart: string;
  periodEnd: string;
  entries: SuiteApplicationFeeEntry[];
  stripeRows: StripeApplicationFeeReportRow[];
}): SuiteApplicationFeeReconciliation {
  const inPeriod = (iso: string) =>
    iso >= input.periodStart && iso < input.periodEnd;

  let ledgerCollectedMinor = 0;
  let ledgerReversedMinor = 0;
  const ledgerByFeeId = new Map<string, number>();
  const ledgerByIntent = new Map<string, number>();

  for (const entry of input.entries) {
    if (!inPeriod(entry.recordedAt)) continue;
    if (entry.kind === 'collection') {
      ledgerCollectedMinor += entry.applicationFeeMinor;
      if (entry.stripeApplicationFeeId) {
        ledgerByFeeId.set(entry.stripeApplicationFeeId, entry.applicationFeeMinor);
      }
      ledgerByIntent.set(entry.stripePaymentIntentId, entry.applicationFeeMinor);
    } else {
      ledgerReversedMinor += entry.reversalMinor;
    }
  }

  let stripeReportMinor = 0;
  const unmatchedStripeRows: StripeApplicationFeeReportRow[] = [];
  const matchedIntentIds = new Set<string>();

  for (const row of input.stripeRows) {
    stripeReportMinor += row.amountMinor;
    const byFee = ledgerByFeeId.get(row.applicationFeeId);
    const byIntent =
      row.paymentIntentId != null ? ledgerByIntent.get(row.paymentIntentId) : undefined;
    if (byFee === row.amountMinor || byIntent === row.amountMinor) {
      if (row.paymentIntentId) matchedIntentIds.add(row.paymentIntentId);
      continue;
    }
    unmatchedStripeRows.push(row);
  }

  const unmatchedLedgerIntentIds = [...ledgerByIntent.keys()].filter(
    (id) => !matchedIntentIds.has(id),
  );

  const ledgerNetMinor = ledgerCollectedMinor - ledgerReversedMinor;
  const deltaMinor = ledgerNetMinor - stripeReportMinor;

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    ledgerCollectedMinor,
    ledgerReversedMinor,
    ledgerNetMinor,
    stripeReportMinor,
    deltaMinor,
    matched: deltaMinor === 0 && unmatchedStripeRows.length === 0,
    unmatchedStripeRows,
    unmatchedLedgerIntentIds,
  };
}
