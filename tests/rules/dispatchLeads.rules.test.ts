/**
 * cmms_leads (TURNWRK-701): inbound inquiries awaiting review. Org members read
 * their own org's leads; every client write is refused, because creation,
 * quoting and conversion go through the dispatch leads API (admin/pm only).
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

const PROJECT_ID = 'demo-turnwrk-rules-dispatch-leads';
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

const LEAD = {
  orgId: ORG_A,
  sourceSite: 'tampa-plumber.example',
  source: 'web-form',
  contact: { name: 'Jane Doe', phone: '+15551234567' },
  inquiryText: 'Kitchen sink is leaking under the cabinet.',
  status: 'new',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

describe('firestore.rules cmms_leads (emulator)', () => {
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
      await setDoc(doc(db, 'cmms_leads', 'lead-1'), LEAD);
    });
  });

  it('lets an org admin and a pm of the org read the lead', async () => {
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext(ADMIN_A).firestore(), 'cmms_leads', 'lead-1')));
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext(MEMBER_A).firestore(), 'cmms_leads', 'lead-1')));
  });

  it('lets an org member list their own org leads by orgId', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A).firestore();
    await assertSucceeds(getDocs(query(collection(db, 'cmms_leads'), where('orgId', '==', ORG_A))));
  });

  it('denies another org reading or listing the lead', async () => {
    const db = testEnv.authenticatedContext(MEMBER_B).firestore();
    await assertFails(getDoc(doc(db, 'cmms_leads', 'lead-1')));
    await assertFails(getDocs(query(collection(db, 'cmms_leads'), where('orgId', '==', ORG_A))));
  });

  it('denies signed-out reads', async () => {
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'cmms_leads', 'lead-1')));
  });

  it('refuses every client write from org members, even the org admin', async () => {
    for (const uid of [ADMIN_A, MEMBER_A]) {
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertFails(setDoc(doc(db, 'cmms_leads', `planted-${uid}`), LEAD));
      await assertFails(updateDoc(doc(db, 'cmms_leads', 'lead-1'), { status: 'converted' }));
      await assertFails(deleteDoc(doc(db, 'cmms_leads', 'lead-1')));
    }
  });

  it('allows a platform admin to write (Admin-SDK-equivalent escape hatch)', async () => {
    const db = testEnv.authenticatedContext(PLATFORM).firestore();
    await assertSucceeds(updateDoc(doc(db, 'cmms_leads', 'lead-1'), { status: 'spam' }));
  });
});
