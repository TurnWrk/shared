import { describe, expect, it } from 'vitest';
import { SHARE_TOKEN_AUDIENCES, shareTokenAudience } from '../src/types/shareToken';

describe('shareTokenAudience (TURNWRK-741)', () => {
  it('reads a legacy token with no audience as vendor', () => {
    expect(shareTokenAudience({})).toBe('vendor');
  });

  it('reads explicit audiences', () => {
    expect(shareTokenAudience({ audience: 'vendor' })).toBe('vendor');
    expect(shareTokenAudience({ audience: 'guest' })).toBe('guest');
  });

  it('never widens an unknown value into the guest surface', () => {
    expect(shareTokenAudience({ audience: 'GUEST' })).toBe('vendor');
    expect(shareTokenAudience({ audience: 1 })).toBe('vendor');
    expect(shareTokenAudience({ audience: null })).toBe('vendor');
  });

  it('lists both audiences', () => {
    expect(SHARE_TOKEN_AUDIENCES).toEqual(['vendor', 'guest']);
  });
});
