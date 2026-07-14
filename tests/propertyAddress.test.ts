import { describe, it, expect } from 'vitest';
import {
  formatAddressFromParts,
  parseAddressString,
  propertyAddressMatches,
  ensureAddressParts,
  normalizeAddressKey,
} from '../src/propertyAddress';

describe('formatAddressFromParts / parseAddressString', () => {
  it('round-trips widget format', () => {
    const parts = {
      line1: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    };
    const formatted = formatAddressFromParts(parts);
    expect(formatted).toBe('123 Main St, Austin, TX 78701');
    expect(parseAddressString(formatted)).toEqual(parts);
  });

  it('parses optional line2', () => {
    expect(parseAddressString('123 Main St, Apt 4, Austin, TX 78701')).toEqual({
      line1: '123 Main St',
      line2: 'Apt 4',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    });
  });
});

describe('propertyAddressMatches dual-read', () => {
  const needle = { line1: '123 Main St', zip: '78701' };

  it('matches on addressParts (new doc)', () => {
    expect(
      propertyAddressMatches(
        {
          address: 'ignored',
          addressParts: { line1: '123 Main St', city: 'Austin', state: 'TX', zip: '78701' },
        },
        needle,
      ),
    ).toBe(true);
  });

  it('matches legacy address-only docs via parse (old doc)', () => {
    expect(
      propertyAddressMatches(
        { address: '123 Main St, Austin, TX 78701' },
        needle,
      ),
    ).toBe(true);
  });

  it('rejects zip mismatch', () => {
    expect(
      propertyAddressMatches(
        { address: '123 Main St, Austin, TX 78702' },
        needle,
      ),
    ).toBe(false);
  });
});

describe('ensureAddressParts', () => {
  it('keeps existing parts; otherwise parses address', () => {
    expect(
      ensureAddressParts({
        address: 'x',
        addressParts: { line1: '1 A', city: 'C', state: 'TX', zip: '1' },
      })?.line1,
    ).toBe('1 A');
    expect(ensureAddressParts({ address: '9 Oak Rd, Dallas, TX 75201' })).toEqual({
      line1: '9 Oak Rd',
      city: 'Dallas',
      state: 'TX',
      zip: '75201',
    });
    expect(ensureAddressParts({ address: 'not parseable' })).toBeNull();
  });

  it('normalizeAddressKey collapses whitespace', () => {
    expect(normalizeAddressKey('  Foo   Bar ')).toBe('foo bar');
  });
});
