import { describe, it, expect } from 'vitest';
import {
  resolveInvoiceKind,
  isArInvoice,
  legacyInvoiceKindPatch,
} from '../../src/clean/invoiceKind';

describe('resolveInvoiceKind dual-read (TURNWRK-100)', () => {
  it('honors explicit kind on new docs', () => {
    expect(resolveInvoiceKind({ kind: 'receipt' })).toBe('receipt');
    expect(resolveInvoiceKind({ kind: 'invoice', dueAtUtc: 1 })).toBe('invoice');
  });

  it('treats bare legacy docs (no kind, no A/R markers) as receipt (old settled)', () => {
    expect(resolveInvoiceKind({})).toBe('receipt');
    expect(resolveInvoiceKind({ status: 'paid' })).toBe('receipt');
  });

  it('infers invoice from A/R markers on old docs missing kind', () => {
    expect(resolveInvoiceKind({ dueAtUtc: 1_700_000_000_000 })).toBe('invoice');
    expect(resolveInvoiceKind({ payToken: 'tok_abc' })).toBe('invoice');
    expect(resolveInvoiceKind({ status: 'open' })).toBe('invoice');
    expect(resolveInvoiceKind({ status: 'overdue' })).toBe('invoice');
    expect(resolveInvoiceKind({ termsDays: 14 })).toBe('invoice');
    expect(resolveInvoiceKind({ balanceMinor: 500 })).toBe('invoice');
  });

  it('legacyInvoiceKindPatch writes inferred kind only when missing', () => {
    expect(legacyInvoiceKindPatch({ dueAtUtc: 1 })).toEqual({ kind: 'invoice' });
    expect(legacyInvoiceKindPatch({})).toEqual({ kind: 'receipt' });
    expect(legacyInvoiceKindPatch({ kind: 'receipt' })).toBeNull();
    expect(legacyInvoiceKindPatch({ kind: 'receipt' }, { force: true })).toEqual({
      kind: 'receipt',
    });
  });

  it('isArInvoice mirrors resolve', () => {
    expect(isArInvoice({ kind: 'invoice' })).toBe(true);
    expect(isArInvoice({ dueAtUtc: 1 })).toBe(true);
    expect(isArInvoice({})).toBe(false);
  });
});
