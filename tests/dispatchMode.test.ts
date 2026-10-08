import { describe, expect, it } from 'vitest';
import {
  IN_HOUSE_CLEARED_FIELDS,
  inHouseAcceptedFields,
  inHouseTechIdOf,
  isInHouseOrg,
  orgDispatchMode,
  resolveInHouseTech,
} from '../src/dispatchMode';

const inHouse = { dispatch: { mode: 'in-house', inHouseTechId: 'alan' } };
const alan = { id: 'alan', status: 'Active', orgIds: ['bk'] };

describe('orgDispatchMode', () => {
  it('is marketplace unless dispatch.mode is exactly in-house', () => {
    expect(orgDispatchMode(undefined)).toBe('marketplace');
    expect(orgDispatchMode({})).toBe('marketplace');
    expect(orgDispatchMode({ dispatch: null })).toBe('marketplace');
    expect(orgDispatchMode({ dispatch: { mode: 'marketplace' } })).toBe('marketplace');
    expect(orgDispatchMode({ dispatch: { mode: 'In-House' } })).toBe('marketplace');
    expect(orgDispatchMode(inHouse)).toBe('in-house');
    expect(isInHouseOrg(inHouse)).toBe(true);
    expect(isInHouseOrg({ dispatch: { autoAssignEnabled: true } as never })).toBe(false);
  });
});

describe('inHouseTechIdOf', () => {
  it('trims and rejects blank or non-string ids', () => {
    expect(inHouseTechIdOf(inHouse)).toBe('alan');
    expect(inHouseTechIdOf({ dispatch: { inHouseTechId: '  alan ' } })).toBe('alan');
    expect(inHouseTechIdOf({ dispatch: { inHouseTechId: '  ' } })).toBeNull();
    expect(inHouseTechIdOf({ dispatch: { inHouseTechId: 7 } })).toBeNull();
  });
});

describe('resolveInHouseTech', () => {
  it('resolves an active tech that belongs to the org', () => {
    expect(resolveInHouseTech('bk', inHouse, alan)).toEqual({ ok: true, techId: 'alan' });
  });

  it('fails safe with a reason for every unresolvable tech', () => {
    expect(resolveInHouseTech('bk', { dispatch: { mode: 'in-house' } }, alan)).toEqual({ ok: false, reason: 'no-in-house-tech' });
    expect(resolveInHouseTech('bk', inHouse, null)).toEqual({ ok: false, reason: 'tech-not-found' });
    expect(resolveInHouseTech('bk', inHouse, { ...alan, id: 'someone-else' })).toEqual({ ok: false, reason: 'tech-not-found' });
    expect(resolveInHouseTech('bk', inHouse, { ...alan, status: 'Inactive' })).toEqual({ ok: false, reason: 'tech-inactive' });
    expect(resolveInHouseTech('bk', inHouse, { ...alan, orgIds: ['other'] })).toEqual({ ok: false, reason: 'tech-not-in-org' });
    expect(resolveInHouseTech('bk', inHouse, { ...alan, orgIds: undefined })).toEqual({ ok: false, reason: 'tech-not-in-org' });
  });
});

describe('inHouseAcceptedFields', () => {
  it('assigns and accepts in one write, with no offer clock', () => {
    const fields = inHouseAcceptedFields('alan', 1_700_000_000_000);
    expect(fields).toEqual({ assignedTechId: 'alan', acknowledgedAt: 1_700_000_000_000 });
    expect(fields).not.toHaveProperty('expiresAt');
    expect(IN_HOUSE_CLEARED_FIELDS).toContain('expiresAt');
    expect(IN_HOUSE_CLEARED_FIELDS).toContain('releasedReason');
  });
});
