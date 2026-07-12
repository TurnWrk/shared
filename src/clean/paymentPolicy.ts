/**
 * Payment-policy resolution (Change Order 1 R1) — pure, no I/O.
 *
 * The resolved policy is snapshotted onto CleanBooking.paymentPolicy and
 * CleanPayment.policy at creation time; settings edits never mutate in-flight
 * money. Absent fields everywhere resolve to the shipped default, so legacy
 * docs need no backfill.
 */
import type { CleanPaymentPolicy } from '../types/clean';

export const DEFAULT_PAYMENT_POLICY: CleanPaymentPolicy = 'card_required_preauth';

export const DEFAULT_INVOICE_TERMS_DAYS = 14;

export interface ResolvePaymentPolicyInput {
  /** Org default (Org.cleanSettings.paymentPolicy). */
  org?: { paymentPolicy?: CleanPaymentPolicy } | null;
  /** Per-service override (CleanService.paymentPolicy). */
  service?: { paymentPolicy?: CleanPaymentPolicy } | null;
  /**
   * Per-customer override — only pass for authenticated/operator paths. The
   * anonymous widget resolves org + service only (a visitor can't claim
   * someone else's negotiated terms).
   */
  customer?: { paymentPolicy?: CleanPaymentPolicy } | null;
}

/** Most-specific wins: customer → service → org → default. */
export function resolvePaymentPolicy(input: ResolvePaymentPolicyInput): CleanPaymentPolicy {
  return (
    input.customer?.paymentPolicy ??
    input.service?.paymentPolicy ??
    input.org?.paymentPolicy ??
    DEFAULT_PAYMENT_POLICY
  );
}

/** Invoice terms in days: customer override → org setting → 14. */
export function resolveTermsDays(
  customer: { termsDays?: number } | null | undefined,
  orgSettings: { invoiceTermsDays?: number } | null | undefined,
): number {
  return customer?.termsDays ?? orgSettings?.invoiceTermsDays ?? DEFAULT_INVOICE_TERMS_DAYS;
}

/** Whether the booking wizard must collect a card under this policy. */
export function policyRequiresCard(policy: CleanPaymentPolicy): boolean {
  return policy === 'card_required_preauth' || policy === 'card_on_file_charge_after';
}

/** Whether the T-48h pre-auth pipeline applies (preauthDueAt is only written here). */
export function policyUsesPreauth(policy: CleanPaymentPolicy): boolean {
  return policy === 'card_required_preauth';
}

/** Plain-words policy statement for the wizard summary sidebar (doc 07 R1). */
export function paymentPolicySummary(policy: CleanPaymentPolicy): string {
  switch (policy) {
    case 'card_required_preauth':
      return "A hold may be placed on your card 48 hours before your service — you won't be charged until the service is completed.";
    case 'card_on_file_charge_after':
      return "Your card is saved now and charged only after the service is completed — no holds beforehand.";
    case 'invoice_terms':
      return 'No payment is needed to book — we’ll send an invoice after the service is completed.';
    case 'offline':
      return 'No payment is collected online — your provider will arrange payment with you directly.';
  }
}
