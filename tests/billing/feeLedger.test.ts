import { describe, expect, it } from 'vitest';
import {
  reconcileSuiteApplicationFees,
  suiteApplicationFeeCollectionDocId,
  suiteApplicationFeeReversalDocId,
  type SuiteApplicationFeeEntry,
} from '../../src/billing/feeLedger';

describe('suiteApplicationFee doc ids', () => {
  it('keys collections on PaymentIntent id and reversals on Refund id', () => {
    expect(suiteApplicationFeeCollectionDocId('pi_abc')).toBe('pi_abc');
    expect(suiteApplicationFeeReversalDocId('re_xyz')).toBe('re_xyz');
  });
});

describe('reconcileSuiteApplicationFees', () => {
  const entries: SuiteApplicationFeeEntry[] = [
    {
      kind: 'collection',
      orgId: 'org1',
      planId: 'free',
      paymentRateBps: 100,
      chargeAmountMinor: 10_000,
      takeRateMinor: 100,
      processingFeeMinor: 320,
      applicationFeeMinor: 420,
      stripePaymentIntentId: 'pi_1',
      stripeApplicationFeeId: 'fee_1',
      surface: 'clean',
      sourceId: 'pay1',
      sourceType: 'payment',
      recordedAt: '2026-08-01T12:00:00.000Z',
    },
    {
      kind: 'reversal',
      orgId: 'org1',
      collectionDocId: 'pi_1',
      stripeRefundId: 're_1',
      stripePaymentIntentId: 'pi_1',
      refundedChargeMinor: 1_000,
      reversalMinor: 42,
      recordedAt: '2026-08-02T12:00:00.000Z',
    },
  ];

  it('matches ledger net to Stripe report rows in the period', () => {
    const result = reconcileSuiteApplicationFees({
      periodStart: '2026-08-01T00:00:00.000Z',
      periodEnd: '2026-08-03T00:00:00.000Z',
      entries,
      stripeRows: [{ applicationFeeId: 'fee_1', amountMinor: 420, paymentIntentId: 'pi_1' }],
    });
    expect(result.ledgerCollectedMinor).toBe(420);
    expect(result.ledgerReversedMinor).toBe(42);
    expect(result.ledgerNetMinor).toBe(378);
    expect(result.stripeReportMinor).toBe(420);
    expect(result.deltaMinor).toBe(-42);
    expect(result.matched).toBe(false);
  });
});
