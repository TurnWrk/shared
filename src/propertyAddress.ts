import type { PropertyAddressParts } from './types/property';

/** Collapse whitespace + lowercase for address matching. */
export function normalizeAddressKey(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Format structured parts into the Clean widget `address` string. */
export function formatAddressFromParts(parts: PropertyAddressParts): string {
  const line1 = parts.line1.trim();
  const line2 = parts.line2?.trim();
  const city = parts.city.trim();
  const state = parts.state.trim();
  const zip = parts.zip.trim();
  const street = line2 ? `${line1}, ${line2}` : line1;
  return `${street}, ${city}, ${state} ${zip}`.replace(/\s+/g, ' ').trim();
}

/**
 * Best-effort parse of Clean widget format: `line1, city, state zip`
 * (optional line2 as a second comma segment before city).
 */
export function parseAddressString(address: string | undefined | null): PropertyAddressParts | null {
  const raw = (address || '').trim();
  if (!raw) return null;
  const segments = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (segments.length < 3) return null;

  const line1 = segments[0];
  const line2 = segments.length >= 4 ? segments[1] : undefined;
  const city = segments.length >= 4 ? segments[2] : segments[1];
  const stateZip = segments[segments.length - 1];
  const m = stateZip.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (!m) return null;
  return {
    line1,
    ...(line2 ? { line2 } : {}),
    city,
    state: m[1].toUpperCase(),
    zip: m[2],
  };
}

export interface AddressMatchNeedle {
  line1: string;
  zip?: string;
  city?: string;
  state?: string;
}

/**
 * Dual-read match: prefer `addressParts`, fall back to normalized full `address`
 * (and to a parsed address string) so legacy residence docs without parts still dedupe.
 */
export function propertyAddressMatches(
  property: { address?: string; addressParts?: PropertyAddressParts | null },
  needle: AddressMatchNeedle,
): boolean {
  const wantLine = normalizeAddressKey(needle.line1);
  const wantZip = normalizeAddressKey(needle.zip);
  if (!wantLine) return false;

  const parts = property.addressParts;
  if (parts?.line1?.trim()) {
    const matchLine = normalizeAddressKey(parts.line1) === wantLine;
    const matchZip = !wantZip || normalizeAddressKey(parts.zip) === wantZip;
    return matchLine && matchZip;
  }

  const parsed = parseAddressString(property.address);
  if (parsed?.line1?.trim()) {
    const matchLine = normalizeAddressKey(parsed.line1) === wantLine;
    const matchZip = !wantZip || normalizeAddressKey(parsed.zip) === wantZip;
    return matchLine && matchZip;
  }

  // Last resort: substring / full-string contains for very old free-text docs.
  const hay = normalizeAddressKey(property.address);
  if (!hay) return false;
  if (!hay.includes(wantLine)) return false;
  if (wantZip && !hay.includes(wantZip)) return false;
  return true;
}

/** Pure backfill transform: derive parts from address when missing. */
export function ensureAddressParts(property: {
  address?: string;
  addressParts?: PropertyAddressParts | null;
}): PropertyAddressParts | null {
  if (property.addressParts?.line1?.trim()) {
    return {
      line1: property.addressParts.line1.trim(),
      ...(property.addressParts.line2?.trim()
        ? { line2: property.addressParts.line2.trim() }
        : {}),
      city: (property.addressParts.city || '').trim(),
      state: (property.addressParts.state || '').trim(),
      zip: (property.addressParts.zip || '').trim(),
    };
  }
  return parseAddressString(property.address);
}
