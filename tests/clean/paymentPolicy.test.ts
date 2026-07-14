import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PAYMENT_POLICY,
  resolveSnapshottedPaymentPolicy,
  legacyPaymentPolicyPatch,
} from '../../src/clean/paymentPolicy';

describe('resolveSnapshottedPaymentPolicy dual-read', () => {
  it('prefers booking.paymentPolicy on new docs', () => {
    expect(
      resolveSnapshottedPaymentPolicy({
        booking: { paymentPolicy: 'invoice_terms' },
        payment: { policy: 'card_required_preauth' },
      }),
    ).toBe('invoice_terms');
  });

  it('falls back to payment.policy when booking stamp missing (old doc)', () => {
    expect(
      resolveSnapshottedPaymentPolicy({
        booking: {},
        payment: { policy: 'offline' },
      }),
    ).toBe('offline');
  });

  it('defaults when both absent', () => {
    expect(resolveSnapshottedPaymentPolicy({})).toBe(DEFAULT_PAYMENT_POLICY);
  });
});

describe('legacyPaymentPolicyPatch', () => {
  it('stamps from payment when booking missing policy', () => {
    expect(
      legacyPaymentPolicyPatch({}, { policy: 'card_on_file_charge_after' }),
    ).toEqual({ paymentPolicy: 'card_on_file_charge_after' });
  });

  it('stamps default when neither has policy', () => {
    expect(legacyPaymentPolicyPatch({})).toEqual({
      paymentPolicy: DEFAULT_PAYMENT_POLICY,
    });
  });

  it('skips when booking already stamped unless force', () => {
    expect(
      legacyPaymentPolicyPatch({ paymentPolicy: 'offline' }, { policy: 'invoice_terms' }),
    ).toBeNull();
    expect(
      legacyPaymentPolicyPatch(
        { paymentPolicy: 'offline' },
        { policy: 'invoice_terms' },
        { force: true },
      ),
    ).toEqual({ paymentPolicy: 'offline' });
  });
});
