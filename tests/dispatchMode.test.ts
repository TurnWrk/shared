import { describe, expect, it } from 'vitest';
import {
  IN_HOUSE_CLEARED_FIELDS,
  applyInHouseToNewWorkOrder,
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

describe('applyInHouseToNewWorkOrder', () => {
  const NOW = 1_700_000_000_000;
  const sam = { id: 'sam', status: 'Active', orgIds: ['bk'] };
  const ctx = (over: Partial<{ inHouse: { ok: true; techId: string } | { ok: false; reason: 'tech-inactive' }; orgTechs: Array<Record<string, unknown> & { id: string }> }> = {}) => ({
    orgId: 'bk',
    inHouse: { ok: true as const, techId: 'alan' },
    orgTechs: [{ id: 'alan', status: 'Active', orgIds: ['bk'] }, sam],
    ...over,
  });

  it('hands open, unassigned, non-emergency work to the in-house tech, accepted, with no offer clock', () => {
    for (const status of ['Backlog', 'Scheduled']) {
      const wo: Record<string, unknown> = { status };
      expect(applyInHouseToNewWorkOrder(wo, ctx(), NOW)).toBe('assigned');
      expect(wo).toEqual({ status, assignedTechId: 'alan', acknowledgedAt: NOW });
    }
  });

  it('a rule-named assignee who is an active org tech keeps the job, accepted, no offer clock', () => {
    const wo: Record<string, unknown> = { status: 'Backlog', assignedTechId: 'sam' };
    expect(applyInHouseToNewWorkOrder(wo, ctx(), NOW)).toBe('kept');
    expect(wo).toEqual({ status: 'Backlog', assignedTechId: 'sam', acknowledgedAt: NOW });
    expect(wo).not.toHaveProperty('expiresAt');
  });

  it('a rule-named assignee who is not an active org tech falls back to the in-house tech, accepted', () => {
    for (const orgTechs of [
      [{ id: 'sam', status: 'Inactive', orgIds: ['bk'] }],
      [{ id: 'sam', status: 'Active', orgIds: ['other-org'] }],
      [],
    ]) {
      const wo: Record<string, unknown> = { status: 'Scheduled', assignedTechId: 'sam' };
      expect(applyInHouseToNewWorkOrder(wo, ctx({ orgTechs }), NOW)).toBe('assigned');
      expect(wo).toEqual({ status: 'Scheduled', assignedTechId: 'alan', acknowledgedAt: NOW });
    }
  });

  it('an unresolved in-house tech leaves the job unassigned and never accepted or offered', () => {
    const unresolved = ctx({ inHouse: { ok: false, reason: 'tech-inactive' }, orgTechs: [] });
    const plain: Record<string, unknown> = { status: 'Backlog' };
    expect(applyInHouseToNewWorkOrder(plain, unresolved, NOW)).toBe('unresolved');
    expect(plain).toEqual({ status: 'Backlog' });
    const badNamed: Record<string, unknown> = { status: 'Backlog', assignedTechId: 'ghost' };
    expect(applyInHouseToNewWorkOrder(badNamed, unresolved, NOW)).toBe('unresolved');
    expect(badNamed).toEqual({ status: 'Backlog', assignedTechId: null });
  });

  it('leaves an emergency and closed work untouched', () => {
    for (const wo of [{ status: 'Scheduled', isEmergency: true }, { status: 'Scheduled', isEmergency: true, assignedTechId: 'sam' }, { status: 'Pending Approval' }]) {
      const copy = { ...wo };
      expect(applyInHouseToNewWorkOrder(copy, ctx(), NOW)).toBe('skipped');
      expect(copy).toEqual(wo);
    }
  });
});
