import { describe, it, expect } from 'vitest';
import {
  normalizePhoneToE164,
  lastTenDigits,
  vendorIdFromPhone,
} from '../src/phone';

describe('normalizePhoneToE164 (TURNWRK-99)', () => {
  it('passes through valid E.164', () => {
    expect(normalizePhoneToE164('+15551234567')).toBe('+15551234567');
  });

  it('normalizes US 10-digit and 11-digit forms', () => {
    expect(normalizePhoneToE164('(555) 123-4567')).toBe('+15551234567');
    expect(normalizePhoneToE164('1-555-123-4567')).toBe('+15551234567');
  });

  it('returns null for empty / non-string / too-short', () => {
    expect(normalizePhoneToE164('')).toBeNull();
    expect(normalizePhoneToE164(null)).toBeNull();
    expect(normalizePhoneToE164(123)).toBeNull();
    expect(normalizePhoneToE164('12345')).toBeNull();
  });
});

describe('lastTenDigits + vendorIdFromPhone', () => {
  it('extracts last 10 digits for fuzzy match', () => {
    expect(lastTenDigits('+1 (555) 123-4567')).toBe('5551234567');
    expect(lastTenDigits('123')).toBe('123');
  });

  it('builds deterministic vendor id from E.164', () => {
    expect(vendorIdFromPhone('+15551234567')).toBe('p15551234567');
  });
});
