import { describe, expect, it } from 'vitest';
import {
  CLEAN_CONNECT_ACCOUNT_DEFAULTS,
  STRIPE_US_CARD_PROCESSING,
  applicationFeeForDirectCharge,
  applicationFeeReversalForRefund,
  assertConnectedAccount,
  estimateStripeCardProcessingFeeCents,
  requireApplicationFeeMinor,
  suitePaymentRateBpsForPlan,
} from '../../src/billing';
import { SUITE_USAGE_MODEL } from '../../src/billing/usageModel';

describe('Connect controller defaults', () => {
  it('locks the interim Express + platform fees/losses + direct configuration', () => {
    // Express requires fees_collector=application AND losses_collector=application
    // (Stripe: account_controller_express_dash_without_application_losses_or_fees).
    // Ratified 2026-08-05 as interim; Full Dashboard + stripe/stripe is the exit.
    expect(CLEAN_CONNECT_ACCOUNT_DEFAULTS.chargePattern).toBe('direct');
    expect(CLEAN_CONNECT_ACCOUNT_DEFAULTS.lossesCollector).toBe('application');
    expect(CLEAN_CONNECT_ACCOUNT_DEFAULTS.feesCollector).toBe('application');
    expect(CLEAN_CONNECT_ACCOUNT_DEFAULTS.dashboard).toBe('express');
  });
});

describe('applicationFeeForDirectCharge', () => {
  it('uses Free / Pro take-rates from SUITE_USAGE_MODEL', () => {
    expect(suitePaymentRateBpsForPlan('pro')).toBe(SUITE_USAGE_MODEL.proPaymentRateBps);
    expect(suitePaymentRateBpsForPlan('free')).toBe(SUITE_USAGE_MODEL.freePaymentRateBps);
    expect(suitePaymentRateBpsForPlan('trial')).toBe(SUITE_USAGE_MODEL.freePaymentRateBps);
    expect(suitePaymentRateBpsForPlan(undefined)).toBe(SUITE_USAGE_MODEL.freePaymentRateBps);
  });

  it('recovers Stripe card processing on top of the take-rate', () => {
    // $100.00 charge on Free (100 bps = $1.00) + 2.9%+$0.30 = $2.90+$0.30
    const fee = applicationFeeForDirectCharge({ amountCents: 10_000, planId: 'free' });
    expect(fee.paymentRateBps).toBe(100);
    expect(fee.takeRateCents).toBe(100);
    expect(fee.processingFeeCents).toBe(
      Math.round((10_000 * STRIPE_US_CARD_PROCESSING.rateBps) / 10_000) +
        STRIPE_US_CARD_PROCESSING.fixedCents,
    );
    expect(fee.processingFeeCents).toBe(320);
    expect(fee.applicationFeeCents).toBe(420);
  });

  it('uses the lower Pro take-rate but still recovers processing', () => {
    // $100.00 on Pro (60 bps = $0.60) + $3.20 processing
    const fee = applicationFeeForDirectCharge({ amountCents: 10_000, planId: 'pro' });
    expect(fee.takeRateCents).toBe(60);
    expect(fee.processingFeeCents).toBe(320);
    expect(fee.applicationFeeCents).toBe(380);
  });

  it('caps the application fee at the charge amount', () => {
    // Tiny charge: fixed $0.30 processing alone exceeds $0.10.
    const fee = applicationFeeForDirectCharge({ amountCents: 10, planId: 'free' });
    expect(fee.processingFeeCents).toBeGreaterThan(10);
    expect(fee.applicationFeeCents).toBe(10);
  });

  it('returns zeros for non-positive amounts', () => {
    expect(applicationFeeForDirectCharge({ amountCents: 0 }).applicationFeeCents).toBe(0);
    expect(estimateStripeCardProcessingFeeCents(-1)).toBe(0);
  });

  it('floors the take-rate in the operator favour', () => {
    // 155¢ × 100 bps = 1.55¢ → floor 1, not round 2
    const fee = applicationFeeForDirectCharge({ amountCents: 155, planId: 'free' });
    expect(fee.takeRateCents).toBe(1);
  });
});

describe('applicationFeeReversalForRefund', () => {
  it('reverses pro-rata with CEIL rounding on partial refunds', () => {
    const original = applicationFeeForDirectCharge({ amountCents: 10_000, planId: 'free' });
    const reversal = applicationFeeReversalForRefund({
      originalChargeCents: 10_000,
      refundedCents: 1,
      originalApplicationFeeCents: original.applicationFeeCents,
      originalTakeRateCents: original.takeRateCents,
      originalPaymentRateBps: original.paymentRateBps,
    });
    expect(reversal.takeRateReversalCents).toBe(1);
    expect(reversal.reversalCents).toBeGreaterThanOrEqual(1);
  });

  it('fully reverses at 100% refund', () => {
    const original = applicationFeeForDirectCharge({ amountCents: 10_000, planId: 'pro' });
    const reversal = applicationFeeReversalForRefund({
      originalChargeCents: 10_000,
      refundedCents: 10_000,
      originalApplicationFeeCents: original.applicationFeeCents,
      originalTakeRateCents: original.takeRateCents,
      originalPaymentRateBps: original.paymentRateBps,
    });
    expect(reversal.reversalCents).toBe(original.applicationFeeCents);
  });
});

describe('requireApplicationFeeMinor', () => {
  it('returns the fee when present', () => {
    expect(requireApplicationFeeMinor(42, 'capture')).toBe(42);
  });

  it('throws when omitted', () => {
    expect(() => requireApplicationFeeMinor(undefined, 'capture')).toThrow(/required on every direct charge/);
  });
});

describe('assertConnectedAccount', () => {
  it('returns the trimmed account id', () => {
    expect(assertConnectedAccount('acct_123', 'preAuthorize')).toBe('acct_123');
    expect(assertConnectedAccount('  acct_123  ', 'preAuthorize')).toBe('acct_123');
  });

  it('throws rather than falling back to the platform account', () => {
    for (const bad of [undefined, null, '', '   ']) {
      expect(() => assertConnectedAccount(bad, 'preAuthorize')).toThrow(
        /missing connected account id/,
      );
    }
  });

  it('rejects an id that is not a connected account', () => {
    expect(() => assertConnectedAccount('cus_123', 'capture')).toThrow(/expected an acct_/);
  });

  it('names the calling context so a throw is diagnosable', () => {
    expect(() => assertConnectedAccount('', 'createSetupIntent')).toThrow(/createSetupIntent/);
  });
});
