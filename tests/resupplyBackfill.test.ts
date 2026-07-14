import { describe, it, expect } from 'vitest';
import {
  legacyPropertyResupplyToCanonical,
  resupplyTimestampToMillis,
} from '../src/resupplyBackfill';
import { normalizeResupplyDoc } from '../src/resupplyNormalize';

describe('legacyPropertyResupplyToCanonical', () => {
  it('maps reviewed/completed + itemTypes-only into canonical write shape', () => {
    const out = legacyPropertyResupplyToCanonical({
      orgId: 'org-1',
      propertyId: 'p-1',
      status: 'reviewed',
      itemTypes: ['toilet-paper', 'trash-bags'],
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_100_000,
      cleanerId: 'c-1',
      notes: 'needs ASAP',
    });
    expect(out).toEqual({
      orgId: 'org-1',
      propertyId: 'p-1',
      status: 'approved',
      source: 'restock-app',
      vendorType: 'cleaning',
      itemTypes: ['toilet-paper', 'trash-bags'],
      items: [
        { itemType: 'toilet-paper', quantity: 1 },
        { itemType: 'trash-bags', quantity: 1 },
      ],
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_100_000,
      cleanerId: 'c-1',
      notes: 'needs ASAP',
    });
  });

  it('maps completed → fulfilled and Timestamp-like createdAt', () => {
    const out = legacyPropertyResupplyToCanonical({
      orgId: 'org-1',
      propertyId: 'p-2',
      status: 'completed',
      itemTypes: ['soap'],
      createdAt: { seconds: 1_700_000_000, nanoseconds: 0 },
    });
    expect(out?.status).toBe('fulfilled');
    expect(out?.createdAt).toBe(1_700_000_000_000);
    expect(out?.items).toEqual([{ itemType: 'soap', quantity: 1 }]);
  });

  it('returns null when orgId or propertyId missing', () => {
    expect(legacyPropertyResupplyToCanonical({ propertyId: 'p-1', status: 'pending' })).toBeNull();
    expect(legacyPropertyResupplyToCanonical({ orgId: 'org-1', status: 'pending' })).toBeNull();
  });
});

describe('old-doc read + new-doc write alignment', () => {
  it('normalizeResupplyDoc(read) matches legacyPropertyResupplyToCanonical(write) status/items', () => {
    const legacy = {
      orgId: 'org-1',
      propertyId: 'p-1',
      status: 'reviewed' as const,
      itemTypes: ['paper-towels'],
    };
    const write = legacyPropertyResupplyToCanonical(legacy)!;
    const read = normalizeResupplyDoc(write);
    expect(read.status).toBe(write.status);
    expect(read.itemTypes).toEqual(write.itemTypes);
    expect(read.items).toEqual(write.items);
  });
});

describe('resupplyTimestampToMillis', () => {
  it('accepts number, Date, and seconds object', () => {
    expect(resupplyTimestampToMillis(42, 0)).toBe(42);
    expect(resupplyTimestampToMillis(new Date(1000), 0)).toBe(1000);
    expect(resupplyTimestampToMillis({ seconds: 2, nanoseconds: 0 }, 0)).toBe(2000);
    expect(resupplyTimestampToMillis(undefined, 99)).toBe(99);
  });
});
