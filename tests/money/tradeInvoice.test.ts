import { describe, it, expect } from 'vitest';
import {
  normalizeTradeLineItem,
  sumTradeLineItems,
  customerFacingLineItems,
  computeTaxMinor,
  computeTradeInvoiceTotals,
  buildTradeInvoiceFromEstimate,
  resolveTradeInvoiceStatus,
  tradeStatusToInvoiceStatus,
  invoiceStatusToTradeStatus,
  tradeInvoicePayPath,
  planTradeInvoiceCharge,
} from '../../src/money/tradeInvoice';

describe('normalizeTradeLineItem', () => {
  it('normalizes a labor row', () => {
    const row = normalizeTradeLineItem(
      { kind: 'labor', label: 'Install faucet', quantity: 2, unitMinor: 5000 },
      0,
    );
    expect(row).toMatchObject({
      kind: 'labor',
      label: 'Install faucet',
      quantity: 2,
      unitMinor: 5000,
      totalMinor: 10000,
    });
  });

  it('drops markup without label and carries percentBps', () => {
    expect(
      normalizeTradeLineItem({ kind: 'markup', label: '  ', quantity: 1, unitMinor: 100 }, 0),
    ).toBeNull();
    const row = normalizeTradeLineItem(
      { kind: 'markup', label: 'Overhead', quantity: 1, unitMinor: 2000, percentBps: 1000 },
      1,
    );
    expect(row?.percentBps).toBe(1000);
  });
});

describe('customerFacingLineItems (TURNWRK-273)', () => {
  const lines = [
    normalizeTradeLineItem(
      { id: 'l1', kind: 'labor', label: 'Labor', quantity: 1, unitMinor: 20000 },
      0,
    )!,
    normalizeTradeLineItem(
      { id: 'm1', kind: 'material', label: 'Parts', quantity: 1, unitMinor: 10000 },
      1,
    )!,
    normalizeTradeLineItem(
      { id: 'x1', kind: 'markup', label: 'Overhead', quantity: 1, unitMinor: 3000, percentBps: 1000 },
      2,
    )!,
  ];

  it('omits markup rows from customer view', () => {
    const customer = customerFacingLineItems(lines);
    expect(customer.every((row) => row.kind !== 'markup')).toBe(true);
    expect(customer).toHaveLength(2);
  });

  it('rolls markup into visible line totals', () => {
    const customer = customerFacingLineItems(lines);
    const subtotal = customer.reduce((sum, row) => sum + row.totalMinor, 0);
    expect(subtotal).toBe(33000);
  });
});

describe('computeTradeInvoiceTotals', () => {
  it('applies tax, deposit, and balance in integer minor units', () => {
    const lines = [
      normalizeTradeLineItem({ kind: 'labor', label: 'Work', quantity: 1, unitMinor: 10000 }, 0)!,
    ];
    const totals = computeTradeInvoiceTotals({
      lineItems: lines,
      taxPct: 10,
      depositPaidMinor: 2500,
    });
    expect(totals).toMatchObject({
      subtotalMinor: 10000,
      taxMinor: 1000,
      totalMinor: 11000,
      depositAppliedMinor: 2500,
      paidMinor: 2500,
      balanceMinor: 8500,
    });
  });
});

describe('computeTaxMinor', () => {
  it('rounds whole-percent tax', () => {
    expect(computeTaxMinor(10000, 8.25)).toBe(825);
    expect(computeTaxMinor(10000, 0)).toBe(0);
  });
});

describe('buildTradeInvoiceFromEstimate', () => {
  const estimate = {
    id: 'est_1',
    orgId: 'org_1',
    customerId: 'cust_1',
    workOrderId: 'wo_1',
    amountCents: 33000,
    laborCents: 20000,
    materialsCents: 10000,
    lineItems: [
      { id: 'l1', kind: 'labor' as const, label: 'Labor', quantity: 1, unitCents: 20000, totalCents: 20000 },
      { id: 'm1', kind: 'material' as const, label: 'Parts', quantity: 1, unitCents: 10000, totalCents: 10000 },
      {
        id: 'x1',
        kind: 'markup' as const,
        label: 'Overhead',
        quantity: 1,
        unitCents: 3000,
        totalCents: 3000,
        percentBps: 1000,
      },
    ],
    depositPaidCents: 5000,
    title: 'Bathroom repair',
  };

  it('derives totals, deposit credit, and customer lines from an estimate', () => {
    const draft = buildTradeInvoiceFromEstimate({
      estimate,
      taxPct: 0,
      invoiceNumber: 'INV-000101',
      issuedAt: 1_700_000_000_000,
      payToken: 'tok_abc',
    });
    expect(draft).toMatchObject({
      orgId: 'org_1',
      customerId: 'cust_1',
      estimateId: 'est_1',
      number: 'INV-000101',
      totalMinor: 33000,
      depositAppliedMinor: 5000,
      paidMinor: 5000,
      balanceMinor: 28000,
      tradeStatus: 'partially_paid',
      status: 'partially_paid',
      payToken: 'tok_abc',
    });
    expect(draft?.customerLineItems).toHaveLength(2);
    expect(draft?.customerLineItems?.every((row) => row.kind !== 'markup')).toBe(true);
  });

  it('returns null without customer or line items', () => {
    expect(
      buildTradeInvoiceFromEstimate({
        estimate: { ...estimate, customerId: '', lineItems: [] },
      }),
    ).toBeNull();
  });
});

describe('resolveTradeInvoiceStatus', () => {
  const now = 1_700_000_000_000;

  it('covers draft / sent / partial / paid / overdue', () => {
    expect(resolveTradeInvoiceStatus({})).toBe('draft');
    expect(
      resolveTradeInvoiceStatus({
        issuedAt: now,
        totalMinor: 10000,
        paidMinor: 0,
        balanceMinor: 10000,
        now,
      }),
    ).toBe('sent');
    expect(
      resolveTradeInvoiceStatus({
        issuedAt: now,
        totalMinor: 10000,
        paidMinor: 3000,
        balanceMinor: 7000,
        now,
      }),
    ).toBe('partially_paid');
    expect(
      resolveTradeInvoiceStatus({
        issuedAt: now,
        totalMinor: 10000,
        paidMinor: 10000,
        balanceMinor: 0,
        now,
      }),
    ).toBe('paid');
    expect(
      resolveTradeInvoiceStatus({
        issuedAt: now,
        totalMinor: 10000,
        paidMinor: 2000,
        balanceMinor: 8000,
        dueAtUtc: now - 1,
        now,
      }),
    ).toBe('overdue');
  });
});

describe('status mapping', () => {
  it('maps trade vocabulary to persisted Invoice.status', () => {
    expect(tradeStatusToInvoiceStatus('sent')).toBe('open');
    expect(tradeStatusToInvoiceStatus('partially_paid')).toBe('partially_paid');
    expect(invoiceStatusToTradeStatus('open', 1)).toBe('sent');
    expect(invoiceStatusToTradeStatus(undefined, undefined)).toBe('draft');
  });
});

describe('tradeInvoicePayPath', () => {
  it('builds the hosted pay link path', () => {
    expect(tradeInvoicePayPath('abc123')).toBe('/invoice/abc123');
    expect(tradeInvoicePayPath('')).toBe('/invoice');
  });
});

describe('planTradeInvoiceCharge', () => {
  it('plans a Connect direct charge with application fee', () => {
    const plan = planTradeInvoiceCharge({ balanceMinor: 10000, planId: 'free' });
    expect(plan).not.toBeNull();
    expect(plan!.amountMinor).toBe(10000);
    expect(plan!.applicationFeeMinor).toBeGreaterThan(plan!.takeRateMinor);
    expect(plan!.takeRateMinor).toBe(100);
    expect(plan!.paymentRateBps).toBe(100);
  });

  it('returns null for zero balance', () => {
    expect(planTradeInvoiceCharge({ balanceMinor: 0, planId: 'free' })).toBeNull();
  });
});

describe('sumTradeLineItems', () => {
  it('sums by kind', () => {
    const lines = [
      normalizeTradeLineItem({ kind: 'labor', label: 'A', quantity: 1, unitMinor: 100 }, 0)!,
      normalizeTradeLineItem({ kind: 'material', label: 'B', quantity: 1, unitMinor: 200 }, 1)!,
      normalizeTradeLineItem({ kind: 'markup', label: 'C', quantity: 1, unitMinor: 30 }, 2)!,
    ];
    expect(sumTradeLineItems(lines)).toEqual({
      laborMinor: 100,
      materialsMinor: 200,
      markupMinor: 30,
      subtotalMinor: 330,
    });
  });
});
