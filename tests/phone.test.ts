import { describe, it, expect } from 'vitest';
import {
  normalizePhoneToE164,
  lastTenDigits,
  vendorIdFromPhone,
} from '../src/phone';

describe('normalizePhoneToE164 (TURNWRK-99)', () => {
  it('passes through valid E.164', () => {
    expect(normalizePhoneToE164('+15551234567')).toBe('+15551234567');
    expect(normalizePhoneToE164('+442071838750')).toBe('+442071838750');
  });

  it('normalizes US 10-digit and 11-digit forms with punctuation', () => {
    expect(normalizePhoneToE164('(555) 123-4567')).toBe('+15551234567');
    expect(normalizePhoneToE164('1-555-123-4567')).toBe('+15551234567');
    expect(normalizePhoneToE164('555.123.4567')).toBe('+15551234567');
    expect(normalizePhoneToE164(' 5551234567 ')).toBe('+15551234567');
  });

  it('returns null for empty / non-string / invalid', () => {
    expect(normalizePhoneToE164('')).toBeNull();
    expect(normalizePhoneToE164('   ')).toBeNull();
    expect(normalizePhoneToE164(null)).toBeNull();
    expect(normalizePhoneToE164(undefined)).toBeNull();
    expect(normalizePhoneToE164(123)).toBeNull();
    expect(normalizePhoneToE164('12345')).toBeNull();
    // Too many digits for US defaultCountry — not confident enough to invent +
    expect(normalizePhoneToE164('55512345678901')).toBeNull();
  });

  it('honors a non-US defaultCountry for digit-only inputs', () => {
    expect(normalizePhoneToE164('2071838750', '+44')).toBe('+442071838750');
  });
});

describe('lastTenDigits + vendorIdFromPhone (TURNWRK-99)', () => {
  it('extracts last 10 digits for fuzzy match', () => {
    expect(lastTenDigits('+1 (555) 123-4567')).toBe('5551234567');
    expect(lastTenDigits('123')).toBe('123');
    expect(lastTenDigits(null)).toBe('');
    expect(lastTenDigits(42)).toBe('');
  });

  it('builds a stable deterministic vendor id from E.164', () => {
    expect(vendorIdFromPhone('+15551234567')).toBe('p15551234567');
    expect(vendorIdFromPhone('+15551234567')).toBe(vendorIdFromPhone('+15551234567'));
    expect(vendorIdFromPhone('+44 20 7183 8750')).toBe('p442071838750');
  });
});
