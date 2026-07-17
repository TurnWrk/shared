import { describe, expect, it } from 'vitest';
import {
  createIndefiniteTrialBilling,
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
    expect(orgAppEnabled(org, 'clean')).toBe(false);
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
      clean: false,
    });
    expect((next as { cmms?: boolean }).cmms).toBeUndefined();
  });
});

describe('resolveBootstrapEnabledApps / createIndefiniteTrialBilling', () => {
  it('defaults to Dispatch + Restock trial apps', () => {
    expect(resolveBootstrapEnabledApps()).toEqual({
      hostfixCmms: true,
      restock: true,
      clean: false,
    });
    expect(resolveBootstrapEnabledApps(null)).toEqual(DEFAULT_TRIAL_ENABLED_APPS);
  });

  it('normalizes explicit overrides', () => {
    expect(resolveBootstrapEnabledApps({ cmms: true, restock: false })).toEqual({
      hostfixCmms: true,
      restock: false,
      clean: false,
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
