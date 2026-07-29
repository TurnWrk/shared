/**
 * Verticals F2 (TURNWRK-331) — the `clean` → `service` / `clean_*` → `svc_*`
 * rename must not change what a LIVE org doc resolves to. `orgs` docs are not
 * disposable, so every one of these is a compat guarantee, not a nicety.
 */
import { describe, it, expect } from 'vitest';
import {
  ORG_FEATURE_DEFAULTS,
  LEGACY_ORG_FEATURE_KEYS,
  orgAppEnabled,
  orgFeatureEnabled,
  normalizeEnabledApps,
} from '../src/types/org';
import type { Org } from '../src/types/org';

const org = (patch: Partial<Org>): Org =>
  ({ id: 'o1', name: 'O', createdAt: 0, updatedAt: 0, ...patch }) as Org;

describe('OrgAppKey service/clean dual-read', () => {
  it('accepts the new key', () => {
    expect(orgAppEnabled(org({ enabledApps: { service: true } }), 'service')).toBe(true);
  });

  it('accepts a legacy doc that only has `clean`', () => {
    expect(orgAppEnabled(org({ enabledApps: { clean: true } }), 'service')).toBe(true);
  });

  it('is off when neither key is set', () => {
    expect(orgAppEnabled(org({ enabledApps: { restock: true } }), 'service')).toBe(false);
  });

  it('still stays off for an org with no enabledApps at all', () => {
    // Legacy grandfather covers hostfixCmms + restock only — Clean never was.
    expect(orgAppEnabled(org({}), 'service')).toBe(false);
    expect(orgAppEnabled(org({}), 'restock')).toBe(true);
  });

  it('suspension still beats both keys', () => {
    expect(
      orgAppEnabled(org({ status: 'suspended', enabledApps: { clean: true } }), 'service'),
    ).toBe(false);
  });
});

describe('normalizeEnabledApps writes only the new key', () => {
  it('upgrades a legacy doc on write', () => {
    const out = normalizeEnabledApps({ clean: true });
    expect(out?.service).toBe(true);
    expect('clean' in (out ?? {})).toBe(false);
  });

  it('keeps an explicit off as off', () => {
    expect(normalizeEnabledApps({ restock: true })?.service).toBe(false);
  });
});

describe('OrgFeatureKey svc_/clean_ dual-read', () => {
  it('prefers the new key', () => {
    const o = org({ features: { svc_sms: false, clean_sms: true } as never });
    expect(orgFeatureEnabled(o, 'svc_sms')).toBe(false);
  });

  it('falls back to the legacy key on an un-migrated doc', () => {
    const o = org({ features: { clean_bounties: true } as never });
    expect(orgFeatureEnabled(o, 'svc_bounties')).toBe(true);
  });

  it('honours an explicit legacy FALSE rather than reverting to the default', () => {
    // svc_sms defaults ON. An operator who turned it off must stay off — this is
    // the case a naive `?? default` fallback silently breaks.
    expect(ORG_FEATURE_DEFAULTS.svc_sms).toBe(true);
    const o = org({ features: { clean_sms: false } as never });
    expect(orgFeatureEnabled(o, 'svc_sms')).toBe(false);
  });

  it('uses the default when neither key is present', () => {
    for (const key of Object.keys(ORG_FEATURE_DEFAULTS) as (keyof typeof ORG_FEATURE_DEFAULTS)[]) {
      expect(orgFeatureEnabled(org({}), key)).toBe(ORG_FEATURE_DEFAULTS[key]);
    }
  });

  it('maps every new key to a legacy name', () => {
    for (const key of Object.keys(ORG_FEATURE_DEFAULTS)) {
      expect(LEGACY_ORG_FEATURE_KEYS[key as keyof typeof LEGACY_ORG_FEATURE_KEYS]).toMatch(
        /^clean_/,
      );
    }
  });
});
