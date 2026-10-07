import { describe, expect, it } from 'vitest';
import {
  GUEST_SMS_CODE_ALPHABET,
  findGuestSmsCodeCandidates,
  generateGuestSmsCode,
  isGuestSmsCode,
  stripGuestSmsCode,
} from '../../src/intake/guestSmsCode';
import { isGuestContactActive } from '../../src/types/guestContact';

describe('generateGuestSmsCode (TURNWRK-742)', () => {
  it('always mints a valid 6-char mixed code from the look-alike-free alphabet', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateGuestSmsCode();
      expect(isGuestSmsCode(code)).toBe(true);
      expect(code).toHaveLength(6);
      for (const c of code) expect(GUEST_SMS_CODE_ALPHABET).toContain(c);
    }
  });

  it('re-draws an all-letter code instead of returning one', () => {
    // First draw: six bytes mapping to 'A' (index 8); then a mixed draw.
    const draws = [new Uint8Array(12).fill(8), Uint8Array.from([8, 0, 9, 1, 10, 2, 0, 0, 0, 0, 0, 0])];
    const code = generateGuestSmsCode(() => draws.shift() ?? new Uint8Array(12));
    expect(code).toBe('A2B3C4');
  });

  it('skips bytes past the uniform range', () => {
    const code = generateGuestSmsCode(() => Uint8Array.from([255, 254, 8, 0, 9, 1, 10, 2, 0, 0, 0, 0]));
    expect(code).toBe('A2B3C4');
  });
});

describe('findGuestSmsCodeCandidates', () => {
  it('finds a code case-insensitively inside free text', () => {
    expect(findGuestSmsCodeCandidates('hi k7p4qm, the sink is leaking')).toEqual(['K7P4QM']);
    expect(findGuestSmsCodeCandidates('Code: K7P4QM!')).toEqual(['K7P4QM']);
  });

  it('ignores plain words, plain numbers and look-alike characters', () => {
    expect(findGuestSmsCodeCandidates('TOILET please 123456')).toEqual([]);
    expect(findGuestSmsCodeCandidates('K0P4QM K1P4QM')).toEqual([]);
    expect(findGuestSmsCodeCandidates('K7P4QMX')).toEqual([]);
  });

  it('dedupes and caps the candidates', () => {
    expect(findGuestSmsCodeCandidates('K7P4QM k7p4qm A2B3C4')).toEqual(['K7P4QM', 'A2B3C4']);
    const many = Array.from({ length: 15 }, (_, i) => `A2B3C${GUEST_SMS_CODE_ALPHABET[i]}`).join(' ');
    expect(findGuestSmsCodeCandidates(many)).toHaveLength(10);
  });
});

describe('stripGuestSmsCode', () => {
  it('leaves only the message around the code', () => {
    expect(stripGuestSmsCode('k7p4qm the sink is leaking', 'K7P4QM')).toBe('the sink is leaking');
    expect(stripGuestSmsCode('Hi! code K7P4QM - no hot water', 'K7P4QM')).toBe('Hi! code - no hot water');
    expect(stripGuestSmsCode(' K7P4QM ', 'K7P4QM')).toBe('');
  });

  it('does not cut the code out of a longer word', () => {
    expect(stripGuestSmsCode('XK7P4QM', 'K7P4QM')).toBe('XK7P4QM');
  });
});

describe('isGuestContactActive', () => {
  const bound = { phoneE164: '+15555550100', orgId: 'o', propertyId: 'p', expireAt: 2_000 };
  it('is active only while bound, unexpired and not opted out', () => {
    expect(isGuestContactActive(bound, 1_000)).toBe(true);
    expect(isGuestContactActive(bound, 2_000)).toBe(false);
    expect(isGuestContactActive({ ...bound, optedOutAt: 500 }, 1_000)).toBe(false);
    expect(isGuestContactActive({ phoneE164: '+15555550100', bindAttempts: 3 }, 1_000)).toBe(false);
    expect(isGuestContactActive(null, 1_000)).toBe(false);
  });
});
