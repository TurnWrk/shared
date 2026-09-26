import { describe, expect, it } from 'vitest';
import {
  AMENITY_SPEC_BY_CLASS,
  KNOWN_AMENITY_CLASSES,
  amenityKey,
  isPropertyAmenity,
  normalizeAmenities,
  normalizeAmenity,
} from '../../src/maintenance';

describe('amenityKey', () => {
  it('lower-cases, strips the Unavailable prefix, and collapses punctuation', () => {
    expect(amenityKey("Pack 'n play/Travel crib")).toBe('pack n play travel crib');
    expect(amenityKey('Unavailable: Private entrance')).toBe('private entrance');
    expect(amenityKey('  Wi-Fi ')).toBe('wi fi');
  });
});

describe('normalizeAmenity', () => {
  it('maps Airbnb labels to catalog classes', () => {
    expect(normalizeAmenity('Private BBQ grill')).toMatchObject({ kind: 'matched', amenity: 'outdoor-grill' });
    expect(normalizeAmenity('Mini golf')).toMatchObject({ kind: 'matched', amenity: 'putting-green' });
    expect(normalizeAmenity('Exterior security cameras on property')).toMatchObject({
      kind: 'matched',
      amenity: 'security-camera',
    });
    expect(normalizeAmenity('Self check-in')).toMatchObject({ kind: 'matched', amenity: 'access-hardware' });
  });

  it('passes a class value straight through', () => {
    expect(normalizeAmenity('hot-tub')).toMatchObject({ kind: 'matched', amenity: 'hot-tub' });
  });

  it('ignores consumables, policy flags, and struck-through Unavailable rows', () => {
    expect(normalizeAmenity('Shampoo').kind).toBe('ignored');
    expect(normalizeAmenity('Long term stays allowed').kind).toBe('ignored');
    expect(normalizeAmenity('Unavailable: Essentials').kind).toBe('ignored');
    // An unavailable row never matches even when the label itself would.
    expect(normalizeAmenity('Unavailable: Pool').kind).toBe('ignored');
    expect(normalizeAmenity('   ').kind).toBe('ignored');
  });

  it('reports what it does not know as unmapped, never silently', () => {
    const n = normalizeAmenity('Helipad');
    expect(n).toEqual({ kind: 'unmapped', input: 'Helipad' });
  });
});

describe('normalizeAmenities', () => {
  it('deduplicates matches in first-seen order and keeps the other two buckets', () => {
    const out = normalizeAmenities(['Refrigerator', 'Kitchen', 'Oven', 'Hangers', 'Helipad', 'Pool']);
    expect(out.matched).toEqual(['kitchen', 'pool']);
    expect(out.ignored).toEqual(['Hangers']);
    expect(out.unmapped).toEqual(['Helipad']);
  });
});

describe('class vocabulary', () => {
  it('every class the alias table can produce has a catalog entry', () => {
    for (const cls of KNOWN_AMENITY_CLASSES) {
      expect(isPropertyAmenity(cls)).toBe(true);
      expect(AMENITY_SPEC_BY_CLASS.has(cls as never), `catalog entry missing for '${cls}'`).toBe(true);
    }
  });

  it('keeps the original seven classes', () => {
    for (const cls of ['kitchen', 'laundry', 'pool', 'hot-tub', 'outdoor-grill', 'fireplace', 'gym']) {
      expect(isPropertyAmenity(cls)).toBe(true);
    }
  });
});
