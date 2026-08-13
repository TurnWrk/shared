/**
 * Self-declared trade business profile (TURNWRK-271, Dispatch for Trades F3).
 *
 * The normalizer is the only thing standing between a settings form and the
 * `orgs` doc, so it carries two guarantees: a cleared field disappears rather
 * than persisting as `''`, and a wholly blank submission returns `undefined`
 * so the caller deletes the field instead of writing `{}` or an undefined key.
 */
import { describe, it, expect } from 'vitest';
import { normalizeOrgBusinessProfile } from '../src/types/org';

describe('normalizeOrgBusinessProfile', () => {
  it('keeps the fields that carry a value, trimmed', () => {
    expect(
      normalizeOrgBusinessProfile({
        licenseNumber: '  TACLA00123C ',
        insuranceCarrier: 'State Farm',
        insurancePolicyNumber: 'POL-98213',
      }),
    ).toEqual({
      licenseNumber: 'TACLA00123C',
      insuranceCarrier: 'State Farm',
      insurancePolicyNumber: 'POL-98213',
    });
  });

  it('drops blank and whitespace-only fields instead of storing them', () => {
    expect(
      normalizeOrgBusinessProfile({
        licenseNumber: 'TACLA00123C',
        insuranceCarrier: '   ',
        insurancePolicyNumber: '',
      }),
    ).toEqual({ licenseNumber: 'TACLA00123C' });
  });

  it('returns undefined when nothing is filled in — the cue to delete the field', () => {
    expect(normalizeOrgBusinessProfile({})).toBeUndefined();
    expect(
      normalizeOrgBusinessProfile({ licenseNumber: ' ', insuranceCarrier: '' }),
    ).toBeUndefined();
    expect(normalizeOrgBusinessProfile(null)).toBeUndefined();
    expect(normalizeOrgBusinessProfile(undefined)).toBeUndefined();
  });

  it('ignores non-string values a hand-built payload could carry', () => {
    expect(
      normalizeOrgBusinessProfile({
        licenseNumber: 42 as unknown as string,
        insuranceCarrier: 'Acme Mutual',
      }),
    ).toEqual({ insuranceCarrier: 'Acme Mutual' });
  });

  it('never returns a key with an undefined value (Firestore rejects those)', () => {
    const out = normalizeOrgBusinessProfile({ insuranceCarrier: 'Acme Mutual' });
    expect(Object.keys(out ?? {})).toEqual(['insuranceCarrier']);
  });
});
