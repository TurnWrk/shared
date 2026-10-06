/**
 * cmms_complianceItems / cmms_dbprLicenses (TURNWRK-718). Org members read
 * their own org's compliance items; every client write, platform admin
 * included, is refused because seeding and edits go through dispatch's
 * Admin SDK routes. DBPR public
 * records are platform-admin read only and never client-written.
 * Canonical rules live in firebase/firestore.rules — never the vendored copy.
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
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-turnwrk-rules-compliance';
const ORG_A = 'org-a';
const ORG_B = 'org-b';
const ADMIN_A = 'admin-org-a';
const MEMBER_A = 'member-org-a';
const MEMBER_B = 'member-org-b';
const PLATFORM = 'platform-admin';

function userDoc(uid: string, orgId: string, admin: boolean, extra: Record<string, unknown> = {}) {
  return {
    uid,
    email: `${uid}@example.com`,
    displayName: uid,
    memberships: [{ orgId, roles: [admin ? 'admin' : 'pm'] }],
    orgIds: [orgId],
    adminOrgIds: admin ? [orgId] : [],
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...extra,
  };
}

const ITEM = {
  orgId: ORG_A,
  propertyId: 'prop-1',
  kind: 'license',
  ruleKey: 'fl.dbpr_vr_license',
  source: 'jurisdiction_seed',
  label: 'DBPR vacation rental license',
  jurisdiction: { level: 'state', state: 'FL' },
  leadDays: 60,
  documents: [],
  ownerVisible: true,
  remindersSent: [],
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

const DBPR = {
  licenseNumber: 'DWE6201234',
  licenseeName: 'Example Holdings LLC',
  county: 'Pinellas',
  rentalUnits: 1,
};

describe('firestore.rules cmms_complianceItems + cmms_dbprLicenses (emulator)', () => {
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
      await setDoc(doc(db, 'users', ADMIN_A), userDoc(ADMIN_A, ORG_A, true));
      await setDoc(doc(db, 'users', MEMBER_A), userDoc(MEMBER_A, ORG_A, false));
      await setDoc(doc(db, 'users', MEMBER_B), userDoc(MEMBER_B, ORG_B, true));
      await setDoc(doc(db, 'users', PLATFORM), userDoc(PLATFORM, ORG_B, true, { platformAdmin: true }));
      await setDoc(doc(db, 'cmms_complianceItems', 'item-1'), ITEM);
      await setDoc(doc(db, 'cmms_dbprLicenses', 'DWE6201234'), DBPR);
    });
  });

  it('lets an org admin and a pm of the org read the item', async () => {
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext(ADMIN_A).firestore(), 'cmms_complianceItems', 'item-1')));
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext(MEMBER_A).firestore(), 'cmms_complianceItems', 'item-1')));
  });

  it('lets an org member list their own org items by orgId', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A).firestore();
    await assertSucceeds(getDocs(query(collection(db, 'cmms_complianceItems'), where('orgId', '==', ORG_A))));
  });

  it('denies another org reading or listing the item', async () => {
    const db = testEnv.authenticatedContext(MEMBER_B).firestore();
    await assertFails(getDoc(doc(db, 'cmms_complianceItems', 'item-1')));
    await assertFails(getDocs(query(collection(db, 'cmms_complianceItems'), where('orgId', '==', ORG_A))));
  });

  it('denies signed-out reads', async () => {
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'cmms_complianceItems', 'item-1')));
  });

  it('refuses every client write, org admin and platform admin included', async () => {
    for (const uid of [ADMIN_A, MEMBER_A, PLATFORM]) {
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertFails(setDoc(doc(db, 'cmms_complianceItems', `planted-${uid}`), ITEM));
      await assertFails(updateDoc(doc(db, 'cmms_complianceItems', 'item-1'), { identifier: 'X' }));
      await assertFails(deleteDoc(doc(db, 'cmms_complianceItems', 'item-1')));
    }
  });

  it('lets only a platform admin read DBPR records', async () => {
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext(PLATFORM).firestore(), 'cmms_dbprLicenses', 'DWE6201234')));
    for (const uid of [ADMIN_A, MEMBER_A]) {
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertFails(getDoc(doc(db, 'cmms_dbprLicenses', 'DWE6201234')));
      await assertFails(getDocs(collection(db, 'cmms_dbprLicenses')));
    }
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'cmms_dbprLicenses', 'DWE6201234')));
  });

  it('refuses every client write to DBPR records, platform admin included', async () => {
    for (const uid of [ADMIN_A, PLATFORM]) {
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertFails(setDoc(doc(db, 'cmms_dbprLicenses', 'planted'), DBPR));
      await assertFails(updateDoc(doc(db, 'cmms_dbprLicenses', 'DWE6201234'), { rentalUnits: 9 }));
      await assertFails(deleteDoc(doc(db, 'cmms_dbprLicenses', 'DWE6201234')));
    }
  });
});
