import { describe, it, expect } from 'vitest';
import {
  resolveScenario,
  SCENARIOS,
  mergeScenario,
  TEST_DATA,
  buildManagerUser,
} from '../src/testFixtures';
import { COLLECTIONS } from '../src/collections';

describe('testFixtures scenarios', () => {
  it('base seeds one org, its owner + platform admin, and a property', () => {
    const r = resolveScenario('base');
    expect(Object.keys(r.firestore[COLLECTIONS.orgs])).toEqual([TEST_DATA.orgId]);
    expect(r.firestore[COLLECTIONS.users][TEST_DATA.managerId]).toMatchObject({
      orgIds: [TEST_DATA.orgId],
      adminOrgIds: [TEST_DATA.orgId], // owner role → admin of its org
      subscriptionStatus: 'active',
    });
    expect(r.firestore[COLLECTIONS.users][TEST_DATA.adminId]).toMatchObject({ platformAdmin: true, orgIds: [] });
    expect(r.auth.map((u) => u.uid).sort()).toEqual([TEST_DATA.adminId, TEST_DATA.managerId].sort());
  });

  it('multiTenant:twoOrgs isolates two orgs, each owner scoped to its own org', () => {
    const r = resolveScenario('multiTenant:twoOrgs');
    expect(Object.keys(r.firestore[COLLECTIONS.orgs]).sort()).toEqual([TEST_DATA.orgId, TEST_DATA.orgBId].sort());
    // The core multi-tenant invariant: owner B's orgIds never include org A.
    const managerB = r.firestore[COLLECTIONS.users][TEST_DATA.managerBId] as { orgIds: string[] };
    expect(managerB.orgIds).toEqual([TEST_DATA.orgBId]);
    expect(managerB.orgIds).not.toContain(TEST_DATA.orgId);
  });

  it('every registered scenario resolves and is JSON-serializable (crosses the seed-route HTTP boundary)', () => {
    for (const name of Object.keys(SCENARIOS)) {
      const r = resolveScenario(name);
      expect(() => JSON.parse(JSON.stringify(r))).not.toThrow();
      expect(Array.isArray(r.auth)).toBe(true);
    }
  });

  it('resolveScenario throws on an unknown scenario name', () => {
    expect(() => resolveScenario('nope')).toThrow(/Unknown test scenario/);
  });

  it('overrides shallow-merge onto docs without mutating the base builder output', () => {
    const merged = mergeScenario(resolveScenario('base'), {
      firestore: { [COLLECTIONS.orgs]: { [TEST_DATA.orgId]: { name: 'Renamed Org' } } },
    });
    expect(merged.firestore[COLLECTIONS.orgs][TEST_DATA.orgId]).toMatchObject({ name: 'Renamed Org', enabledApps: { restock: true } });
    // untouched fields survive
    expect(buildManagerUser().orgIds).toEqual([TEST_DATA.orgId]);
  });
});
