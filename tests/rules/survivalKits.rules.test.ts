/**
 * Org isolation for cleaner survival kits (TURNWRK-33).
 * Canonical rules live in firebase/firestore.rules — never the vendored copy.
 *
 * Kits are the org-scoped counterpart to `restock_curatedLists`, which are
 * platform-authored global presets. That difference is the whole reason these
 * exist as a separate collection, so the isolation it implies is asserted here
 * rather than assumed.
 *
 * Run via: npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-turnwrk-rules-survival-kits';
const ORG_A = 'org-a';
const ORG_B = 'org-b';
const MEMBER_A = 'member-org-a';
const ADMIN_A = 'admin-org-a';
const MEMBER_B = 'member-org-b';
const KIT = 'kit-1';

function userDoc(uid: string, orgId: string, extra: Record<string, unknown> = {}) {
  return {
    uid,
    email: `${uid}@example.com`,
    displayName: uid,
    memberships: [{ orgId, roles: ['pm'] }],
    orgIds: [orgId],
    adminOrgIds: [],
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...extra,
  };
}

function kitDoc(orgId: string) {
  return {
    id: KIT,
    orgId,
    name: 'Turnover survival kit',
    lines: [
      { name: 'Trash bags', itemType: 'trash_bags', quantity: 4 },
      { name: 'Toilet paper', quantity: 6 },
    ],
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  };
}

describe('firestore.rules restock_survivalKits (emulator)', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync(join(process.cwd(), 'firebase/firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  }, 60_000);

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users', MEMBER_A), userDoc(MEMBER_A, ORG_A));
      await setDoc(doc(db, 'users', ADMIN_A), userDoc(ADMIN_A, ORG_A, { adminOrgIds: [ORG_A] }));
      await setDoc(doc(db, 'users', MEMBER_B), userDoc(MEMBER_B, ORG_B));
      await setDoc(doc(db, 'restock_survivalKits', KIT), kitDoc(ORG_A));
    });
  });

  const kitFor = (uid: string) =>
    doc(testEnv.authenticatedContext(uid).firestore(), 'restock_survivalKits', KIT);

  it('lets an org member read their own kit', async () => {
    await assertSucceeds(getDoc(kitFor(MEMBER_A)));
  });

  it("denies another org reading it", async () => {
    await assertFails(getDoc(kitFor(MEMBER_B)));
  });

  it('lets a non-admin org member author a kit', async () => {
    // Kits are operational content, not entitlements — a PM writes them.
    const db = testEnv.authenticatedContext(MEMBER_A).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'restock_survivalKits', 'kit-new'), { ...kitDoc(ORG_A), id: 'kit-new' }),
    );
  });

  it('denies planting a kit into another org', async () => {
    const db = testEnv.authenticatedContext(MEMBER_B).firestore();
    await assertFails(
      setDoc(doc(db, 'restock_survivalKits', 'kit-planted'), { ...kitDoc(ORG_A), id: 'kit-planted' }),
    );
  });

  it('denies a nameless kit', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A).firestore();
    await assertFails(
      setDoc(doc(db, 'restock_survivalKits', 'kit-blank'), { ...kitDoc(ORG_A), name: '' }),
    );
  });

  it('lets an org member edit their kit', async () => {
    await assertSucceeds(
      updateDoc(kitFor(MEMBER_A), { lines: [{ name: 'Trash bags', quantity: 2 }] }),
    );
  });

  it('denies moving a kit into another org', async () => {
    await assertFails(updateDoc(kitFor(MEMBER_A), { orgId: ORG_B }));
  });

  it('denies another org editing it', async () => {
    await assertFails(updateDoc(kitFor(MEMBER_B), { name: 'Theirs now' }));
  });

  it('reserves deletion for an org admin', async () => {
    await assertFails(deleteDoc(kitFor(MEMBER_A)));
    await assertSucceeds(deleteDoc(kitFor(ADMIN_A)));
  });
});
