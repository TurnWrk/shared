import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PAYMENT_POLICY,
  resolvePaymentPolicy,
  resolveSnapshottedPaymentPolicy,
  legacyPaymentPolicyPatch,
  resolveTermsDays,
  policyRequiresCard,
  policyUsesPreauth,
} from '../../src/clean/paymentPolicy';

describe('resolvePaymentPolicy cascade (TURNWRK-100)', () => {
  it('most-specific wins: customer → service → org → default', () => {
    expect(
      resolvePaymentPolicy({
        org: { paymentPolicy: 'offline' },
        service: { paymentPolicy: 'invoice_terms' },
        customer: { paymentPolicy: 'card_on_file_charge_after' },
      }),
    ).toBe('card_on_file_charge_after');
    expect(
      resolvePaymentPolicy({
        org: { paymentPolicy: 'offline' },
        service: { paymentPolicy: 'invoice_terms' },
      }),
    ).toBe('invoice_terms');
    expect(resolvePaymentPolicy({ org: { paymentPolicy: 'offline' } })).toBe('offline');
    expect(resolvePaymentPolicy({})).toBe(DEFAULT_PAYMENT_POLICY);
  });
});

describe('resolveSnapshottedPaymentPolicy dual-read (TURNWRK-100)', () => {
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

  it('defaults when both absent or unknown strings', () => {
    expect(resolveSnapshottedPaymentPolicy({})).toBe(DEFAULT_PAYMENT_POLICY);
    expect(
      resolveSnapshottedPaymentPolicy({
        booking: { paymentPolicy: 'not-a-policy' as never },
      }),
    ).toBe(DEFAULT_PAYMENT_POLICY);
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

describe('terms + card/preauth helpers', () => {
  it('resolveTermsDays: customer → org → 14', () => {
    expect(resolveTermsDays({ termsDays: 7 }, { invoiceTermsDays: 30 })).toBe(7);
    expect(resolveTermsDays(null, { invoiceTermsDays: 30 })).toBe(30);
    expect(resolveTermsDays(null, null)).toBe(14);
  });

  it('policyRequiresCard / policyUsesPreauth', () => {
    expect(policyRequiresCard('card_required_preauth')).toBe(true);
    expect(policyRequiresCard('card_on_file_charge_after')).toBe(true);
    expect(policyRequiresCard('invoice_terms')).toBe(false);
    expect(policyUsesPreauth('card_required_preauth')).toBe(true);
    expect(policyUsesPreauth('card_on_file_charge_after')).toBe(false);
  });
});
