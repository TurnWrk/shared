/**
 * cmms_guestContacts (TURNWRK-742): guest phone -> property bindings and the
 * per-phone bind-attempt counter. Admin SDK only — no client, org admin and
 * platform admin included, may read or write a binding.
 * Canonical rules live in firebase/firestore.rules — never the vendored copy.
 *
 * Run via: npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const PROJECT_ID = 'demo-turnwrk-rules-guest-contacts';
const ORG_A = 'org-a';
const ADMIN_A = 'admin-org-a';
const PLATFORM = 'platform-admin';
const PHONE = '+15555550100';

function userDoc(uid: string, orgId: string, extra: Record<string, unknown> = {}) {
  return {
    uid,
    email: `${uid}@example.com`,
    displayName: uid,
    memberships: [{ orgId, roles: ['admin'] }],
    orgIds: [orgId],
    adminOrgIds: [orgId],
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...extra,
  };
}

const CONTACT = {
  phoneE164: PHONE,
  orgId: ORG_A,
  propertyId: 'prop-1',
  tokenId: 'tok-1',
  code: 'K7P4QM',
  boundAt: 1_700_000_000_000,
  expireAt: 1_700_100_000_000,
};

describe('firestore.rules cmms_guestContacts (emulator)', () => {
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
      await setDoc(doc(db, 'users', ADMIN_A), userDoc(ADMIN_A, ORG_A));
      await setDoc(doc(db, 'users', PLATFORM), userDoc(PLATFORM, 'org-b', { platformAdmin: true }));
      await setDoc(doc(db, 'cmms_guestContacts', PHONE), CONTACT);
    });
  });

  it('denies every client read, the owning org and a platform admin included', async () => {
    for (const ctx of [testEnv.authenticatedContext(ADMIN_A), testEnv.authenticatedContext(PLATFORM), testEnv.unauthenticatedContext()]) {
      const db = ctx.firestore();
      await assertFails(getDoc(doc(db, 'cmms_guestContacts', PHONE)));
      await assertFails(getDocs(query(collection(db, 'cmms_guestContacts'), where('orgId', '==', ORG_A))));
    }
  });

  it('denies every client write, so nobody can bind a phone or clear a throttle', async () => {
    for (const ctx of [testEnv.authenticatedContext(ADMIN_A), testEnv.authenticatedContext(PLATFORM), testEnv.unauthenticatedContext()]) {
      const db = ctx.firestore();
      await assertFails(setDoc(doc(db, 'cmms_guestContacts', '+15555550199'), CONTACT));
      await assertFails(updateDoc(doc(db, 'cmms_guestContacts', PHONE), { bindAttempts: 0 }));
      await assertFails(deleteDoc(doc(db, 'cmms_guestContacts', PHONE)));
    }
  });
});
