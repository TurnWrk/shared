import { describe, expect, it } from 'vitest';
import {
  createIndefiniteTrialBilling,
  createSuiteTrialBilling,
  DEFAULT_TRIAL_ENABLED_APPS,
  normalizeEnabledApps,
  orgAppEnabled,
  orgIsSuspended,
  resolveBootstrapEnabledApps,
  isOrgTrialExpired,
  isOrgIndefiniteOrActiveTrial,
  type Org,
} from '../src/types/org';

describe('orgAppEnabled', () => {
  it('dual-reads legacy cmms as hostfixCmms', () => {
    const org = {
      enabledApps: { cmms: true, restock: false, clean: false },
    } as Org;
    expect(orgAppEnabled(org, 'hostfixCmms')).toBe(true);
    expect(orgAppEnabled(org, 'restock')).toBe(false);
  });

  it('grandfathers missing enabledApps for cmms/restock only', () => {
    const org = { id: 'x', name: 'n', createdAt: 0, updatedAt: 0 } as Org;
    expect(orgAppEnabled(org, 'hostfixCmms')).toBe(true);
    expect(orgAppEnabled(org, 'restock')).toBe(true);
    expect(orgAppEnabled(org, 'service')).toBe(false);
  });

  it('blocks all apps when suspended', () => {
    const org = {
      status: 'suspended',
      enabledApps: { hostfixCmms: true, restock: true, clean: true },
    } as Org;
    expect(orgAppEnabled(org, 'hostfixCmms')).toBe(false);
    expect(orgIsSuspended(org)).toBe(true);
  });
});

describe('normalizeEnabledApps', () => {
  it('writes hostfixCmms never cmms', () => {
    const next = normalizeEnabledApps({ cmms: true, restock: true, clean: false });
    expect(next).toEqual({
      hostfixCmms: true,
      restock: true,
      // TURNWRK-331: writers emit `service`; `clean` is read-only compat.
      service: false,
    });
    expect((next as { clean?: boolean }).clean).toBeUndefined();
    expect((next as { cmms?: boolean }).cmms).toBeUndefined();
  });
});

describe('resolveBootstrapEnabledApps / createIndefiniteTrialBilling', () => {
  it('defaults to Dispatch + Restock trial apps', () => {
    expect(resolveBootstrapEnabledApps()).toEqual({
      hostfixCmms: true,
      restock: true,
      service: false,
    });
    expect(resolveBootstrapEnabledApps(null)).toEqual(DEFAULT_TRIAL_ENABLED_APPS);
  });

  it('normalizes explicit overrides', () => {
    expect(resolveBootstrapEnabledApps({ cmms: true, restock: false })).toEqual({
      hostfixCmms: true,
      restock: false,
      service: false,
    });
  });

  it('creates indefinite trial billing without ends-at', () => {
    const billing = createIndefiniteTrialBilling(1_700_000_000_000);
    expect(billing.subscriptionStatus).toBe('trialing');
    expect(billing.planId).toBe('trial');
    expect(billing.updatedAt).toBe(1_700_000_000_000);
    expect(billing.trialEndsAt).toBeUndefined();
    expect(billing.currentPeriodEnd).toBeUndefined();
  });

  it('creates 45-day suite trial with trialEndsAt', () => {
    const now = 1_700_000_000_000;
    const billing = createSuiteTrialBilling(now, 45);
    expect(billing.subscriptionStatus).toBe('trialing');
    expect(billing.trialEndsAt).toBe(now + 45 * 24 * 60 * 60 * 1000);
    expect(billing.notes).toContain('45-day');
  });
});

describe('isOrgTrialExpired / isOrgIndefiniteOrActiveTrial', () => {
  it('treats missing trialEndsAt as indefinite (not expired)', () => {
    const billing = { subscriptionStatus: 'trialing' as const };
    expect(isOrgTrialExpired(billing)).toBe(false);
    expect(isOrgIndefiniteOrActiveTrial(billing)).toBe(true);
  });

  it('expires only when trialEndsAt is in the past', () => {
    const now = 1_700_000_000_000;
    expect(
      isOrgTrialExpired({ subscriptionStatus: 'trialing', trialEndsAt: now - 1 }, now),
    ).toBe(true);
    expect(
      isOrgTrialExpired({ subscriptionStatus: 'trialing', trialEndsAt: now + 1 }, now),
    ).toBe(false);
  });
});

describe('compliance tracker app (TURNWRK-728)', () => {
  it('is on only when enabledApps.compliance is true', () => {
    expect(orgAppEnabled({ enabledApps: { compliance: true } } as Org, 'compliance')).toBe(true);
    expect(orgAppEnabled({ enabledApps: { hostfixCmms: true } } as Org, 'compliance')).toBe(false);
  });

  it('is not grandfathered onto orgs with no enabledApps', () => {
    expect(orgAppEnabled({ id: 'x', name: 'n', createdAt: 0, updatedAt: 0 } as Org, 'compliance')).toBe(false);
  });

  it('is off for a suspended org', () => {
    expect(orgAppEnabled({ status: 'suspended', enabledApps: { compliance: true } } as Org, 'compliance')).toBe(false);
  });

  it('normalize keeps it when on and omits it when off', () => {
    expect(normalizeEnabledApps({ compliance: true })).toEqual({
      hostfixCmms: false,
      restock: false,
      service: false,
      compliance: true,
    });
    expect(normalizeEnabledApps({ hostfixCmms: true, compliance: false })).toEqual({
      hostfixCmms: true,
      restock: false,
      service: false,
    });
  });
});
