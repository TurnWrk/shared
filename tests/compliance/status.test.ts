import { describe, expect, it } from 'vitest';
import { complianceDueDate, complianceStatus } from '../../src/compliance';

const blank = { leadDays: 30, documents: [] };

describe('complianceDueDate', () => {
  it('takes the earlier of expiry and next due date', () => {
    expect(complianceDueDate({ expiresOn: '2026-12-31', nextDueDate: '2026-11-01' })).toBe('2026-11-01');
    expect(complianceDueDate({ expiresOn: '2026-10-01', nextDueDate: '2026-11-01' })).toBe('2026-10-01');
    expect(complianceDueDate({ expiresOn: '2026-10-01' })).toBe('2026-10-01');
    expect(complianceDueDate({})).toBeUndefined();
  });
});

describe('complianceStatus', () => {
  it('is missing with no due date and nothing on file', () => {
    expect(complianceStatus(blank, '2026-10-06')).toBe('missing');
  });

  it('is current for a one-time item on file with no due date', () => {
    expect(complianceStatus({ ...blank, identifier: '12-3456789' }, '2026-10-06')).toBe('current');
    expect(complianceStatus({ ...blank, issuedOn: '2025-01-01' }, '2026-10-06')).toBe('current');
    expect(complianceStatus({ ...blank, lastCompletedAt: 0 }, '2026-10-06')).toBe('current');
    expect(
      complianceStatus(
        { ...blank, documents: [{ storagePath: 'p', name: 'n', kind: 'receipt', uploadedAt: 1 }] },
        '2026-10-06',
      ),
    ).toBe('current');
  });

  it('flips at the leadDays boundary, inclusive', () => {
    const item = { ...blank, expiresOn: '2026-11-30' };
    expect(complianceStatus(item, '2026-10-30')).toBe('current');
    expect(complianceStatus(item, '2026-10-31')).toBe('due_soon');
    expect(complianceStatus(item, '2026-11-30')).toBe('due_soon');
    expect(complianceStatus(item, '2026-12-01')).toBe('overdue');
  });

  it('treats leadDays 0 as due_soon on the due date only', () => {
    const item = { leadDays: 0, documents: [], nextDueDate: '2026-10-06' };
    expect(complianceStatus(item, '2026-10-05')).toBe('current');
    expect(complianceStatus(item, '2026-10-06')).toBe('due_soon');
    expect(complianceStatus(item, '2026-10-07')).toBe('overdue');
  });

  it('clamps negative leadDays to 0', () => {
    const item = { leadDays: -5, documents: [], nextDueDate: '2026-10-06' };
    expect(complianceStatus(item, '2026-10-05')).toBe('current');
  });

  it('crosses month and year ends', () => {
    const item = { leadDays: 3, documents: [], nextDueDate: '2027-01-02' };
    expect(complianceStatus(item, '2026-12-29')).toBe('current');
    expect(complianceStatus(item, '2026-12-30')).toBe('due_soon');
  });

  it('reads the FL monthly filing as due from the 1st and late after the 20th', () => {
    const item = { leadDays: 19, documents: [], nextDueDate: '2026-11-20' };
    expect(complianceStatus(item, '2026-10-31')).toBe('current');
    expect(complianceStatus(item, '2026-11-01')).toBe('due_soon');
    expect(complianceStatus(item, '2026-11-20')).toBe('due_soon');
    expect(complianceStatus(item, '2026-11-21')).toBe('overdue');
  });

  it('uses the due date even when nothing is on file', () => {
    expect(complianceStatus({ ...blank, nextDueDate: '2026-01-01' }, '2026-10-06')).toBe('overdue');
  });
});
