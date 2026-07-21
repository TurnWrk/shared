/**
 * Phone normalization for vendor identity matching across apps.
 * Surge inbound SMS uses E.164; legacy docs may store other formats.
 */

const E164_RE = /^\+\d{8,15}$/;

/** Normalize a raw phone string to E.164, or null if not confident. */
export function normalizePhoneToE164(
  raw: unknown,
  defaultCountry = '+1',
): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (E164_RE.test(trimmed)) return trimmed;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 0) return null;

  if (defaultCountry === '+1') {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  } else if (digits.length >= 8 && digits.length <= 15) {
    return `${defaultCountry}${digits}`;
  }

  return null;
}

/** Last 10 digits for fuzzy legacy matching. */
export function lastTenDigits(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/** Deterministic vendor doc id from an E.164 phone. */
export function vendorIdFromPhone(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '');
  return `p${digits}`;
}
