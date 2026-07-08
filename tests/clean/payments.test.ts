import { describe, it, expect } from 'vitest';
import {
  planPreauthSweep,
  computeAssignmentAllocations,
  formatInvoiceNumber,
  DEFAULT_PREAUTH_SWEEP_CONFIG,
} from '../../src/clean/payments';
import type { CleanPayment } from '../../src/types/clean';

function pay(overrides: Partial<CleanPayment>): CleanPayment {
  return {
    id: 'p',
    orgId: 'o',
    bookingId: 'b',
    customerId: 'c',
    status: 'vaulted',
    amountMinor: 10000,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as CleanPayment;
}
const now = 1_700_000_000_000;

describe('planPreauthSweep', () => {
  it('pre-authorizes a due vaulted payment with a versioned idempotency key', () => {
    const [a] = planPreauthSweep([pay({ status: 'vaulted' })], now);
    expect(a.kind).toBe('preauthorize');
    expect(a.idempotencyKey).toBe('payment:p:preauth:0');
  });

  it('skips a held payment', () => {
    expect(planPreauthSweep([pay({ hold: true })], now)[0]).toMatchObject({ kind: 'skip', reason: 'hold' });
  });

  it('waits for retryAt on a retrying payment, then acts', () => {
    expect(planPreauthSweep([pay({ status: 'retrying', retryCount: 1, retryAt: now + 1000 })], now)[0].kind).toBe('skip');
    expect(planPreauthSweep([pay({ status: 'retrying', retryCount: 1, retryAt: now - 1000 })], now)[0].kind).toBe('preauthorize');
  });

  it('flags risk once retries hit the max', () => {
    expect(planPreauthSweep([pay({ status: 'retrying', retryCount: 3 })], now)[0].kind).toBe('risk');
  });

  it('skips a fresh processing marker but re-picks a stale one', () => {
    expect(planPreauthSweep([pay({ processingAt: now - 1000 })], now)[0].kind).toBe('skip');
    const stale = now - (DEFAULT_PREAUTH_SWEEP_CONFIG.staleMs + 1000);
    expect(planPreauthSweep([pay({ processingAt: stale })], now)[0].kind).toBe('preauthorize');
  });
});

describe('computeAssignmentAllocations', () => {
  it('splits evenly across all-flexible seats', () => {
    const m = computeAssignmentAllocations(480, [{ techId: 'a' }, { techId: 'b' }]);
    expect(m.get('a')).toBe(240);
    expect(m.get('b')).toBe(240);
  });

  it('honors explicit minutes and shares the remainder', () => {
    const m = computeAssignmentAllocations(480, [{ techId: 'a', minutes: 300 }, { techId: 'b' }, { techId: 'c' }]);
    expect(m.get('a')).toBe(300);
    expect(m.get('b')).toBe(90);
    expect(m.get('c')).toBe(90);
  });

  it('always sums to estMinutes (remainder to earliest seats)', () => {
    const m = computeAssignmentAllocations(100, [{ techId: 'a' }, { techId: 'b' }, { techId: 'c' }]);
    expect((m.get('a') ?? 0) + (m.get('b') ?? 0) + (m.get('c') ?? 0)).toBe(100);
    expect(m.get('a')).toBe(34);
  });
});

describe('formatInvoiceNumber', () => {
  it('zero-pads to six digits', () => {
    expect(formatInvoiceNumber(1)).toBe('INV-000001');
    expect(formatInvoiceNumber(42)).toBe('INV-000042');
  });
  it('grows past six digits and is monotonic', () => {
    expect(formatInvoiceNumber(1234567)).toBe('INV-1234567');
    expect(formatInvoiceNumber(2) > formatInvoiceNumber(1)).toBe(true);
  });
});
