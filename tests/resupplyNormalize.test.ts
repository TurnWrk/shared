import { describe, expect, it } from 'vitest';
import {
  normalizeResupplyDoc,
  normalizeResupplyStatus,
  projectResupplyItemTypes,
} from '../src/resupplyNormalize';

describe('normalizeResupplyStatus (TURNWRK-76)', () => {
  it('maps legacy reviewed/completed', () => {
    expect(normalizeResupplyStatus('reviewed')).toBe('approved');
    expect(normalizeResupplyStatus('completed')).toBe('fulfilled');
  });

  it('passes through canonical statuses', () => {
    expect(normalizeResupplyStatus('ordered')).toBe('ordered');
    expect(normalizeResupplyStatus('rejected')).toBe('rejected');
  });

  it('defaults unknown to pending', () => {
    expect(normalizeResupplyStatus('weird')).toBe('pending');
    expect(normalizeResupplyStatus(undefined)).toBe('pending');
  });
});

describe('projectResupplyItemTypes', () => {
  it('prefers explicit itemTypes', () => {
    expect(projectResupplyItemTypes(['tp'], [{ name: 'soap', quantity: 1 }])).toEqual(['tp']);
  });

  it('projects from items when itemTypes missing', () => {
    expect(
      projectResupplyItemTypes([], [
        { itemType: 'tp', quantity: 1 },
        { name: 'sponges', quantity: 2 },
      ]),
    ).toEqual(['tp', 'sponges']);
  });
});

describe('normalizeResupplyDoc', () => {
  it('unifies legacy restock shape', () => {
    const n = normalizeResupplyDoc({
      status: 'reviewed',
      itemTypes: ['toilet-paper'],
    });
    expect(n.status).toBe('approved');
    expect(n.itemTypes).toEqual(['toilet-paper']);
    expect(n.items).toEqual([{ itemType: 'toilet-paper', quantity: 1 }]);
  });

  it('unifies CMMS items-only shape', () => {
    const n = normalizeResupplyDoc({
      status: 'pending',
      items: [{ name: 'sponges', quantity: 2 }],
    });
    expect(n.itemTypes).toEqual(['sponges']);
    expect(n.items).toEqual([{ name: 'sponges', quantity: 2 }]);
  });
});
