/**
 * Cross-tenant isolation for org-scoped collections (TURNWRK-471).
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
import { doc, getDoc, setDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-turnwrk-rules-tenant-isolation';
const ORG_A = 'org-a';
const ORG_B = 'org-b';
const MEMBER_A = 'user-org-a';
const MEMBER_B = 'user-org-b';
const ADMIN_A = 'admin-org-a';

function userDoc(uid: string, orgId: string, extra: Record<string, unknown> = {}) {
  return {
    uid,
    email: `${uid}@example.com`,
    displayName: uid,
    memberships: [{ orgId, roles: ['owner'] }],
    orgIds: [orgId],
    adminOrgIds: [orgId],
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...extra,
  };
}

type CollectionCase = {
  collection: string;
  docId: string;
  scoped: Record<string, unknown>;
  missingOrgId: Record<string, unknown>;
};

const CASES: CollectionCase[] = [
  {
    collection: 'svc_customers',
    docId: 'cust-1',
    scoped: { orgId: ORG_A, name: 'Acme Tenant', email: 'a@example.com' },
    missingOrgId: { name: 'Legacy Customer' },
  },
  {
    collection: 'cmms_workOrders',
    docId: 'wo-1',
    scoped: {
      orgId: ORG_A,
      propertyId: 'prop-1',
      title: 'Fix sink',
      status: 'Backlog',
      priority: 'Medium',
      type: 'Repair',
    },
    missingOrgId: { propertyId: 'prop-1', title: 'Legacy WO', status: 'Backlog' },
  },
  {
    collection: 'cmms_estimates',
    docId: 'est-1',
    scoped: {
      orgId: ORG_A,
      workOrderId: 'wo-1',
      amountCents: 12_500,
    },
    missingOrgId: { workOrderId: 'wo-1', amountCents: 12_500 },
  },
  {
    collection: 'cmms_ownerInvoices',
    docId: 'inv-1',
    scoped: {
      orgId: ORG_A,
      propertyId: 'prop-1',
      amountCents: 50_000,
      publicToken: 'tok-abc',
    },
    missingOrgId: {
      propertyId: 'prop-1',
      amountCents: 50_000,
      publicToken: 'tok-legacy',
    },
  },
];

describe('firestore.rules tenant isolation (emulator)', () => {
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
      await setDoc(doc(db, 'users', MEMBER_B), userDoc(MEMBER_B, ORG_B));
      await setDoc(doc(db, 'users', ADMIN_A), userDoc(ADMIN_A, ORG_A, { platformAdmin: true }));

      for (const { collection, docId, scoped } of CASES) {
        await setDoc(doc(db, collection, docId), scoped);
      }
    });
  });

  for (const { collection, docId } of CASES) {
    it(`lets org-a read its own ${collection} doc`, async () => {
      const db = testEnv.authenticatedContext(MEMBER_A).firestore();
      await assertSucceeds(getDoc(doc(db, collection, docId)));
    });

    it(`denies org-b from reading org-a ${collection} doc`, async () => {
      const db = testEnv.authenticatedContext(MEMBER_B).firestore();
      await assertFails(getDoc(doc(db, collection, docId)));
    });
  }

  for (const { collection, docId, missingOrgId } of CASES) {
    it(`denies reads of ${collection} docs missing orgId`, async () => {
      const legacyId = `${docId}-legacy`;
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), collection, legacyId), missingOrgId);
      });

      const memberDb = testEnv.authenticatedContext(MEMBER_A).firestore();
      const outsiderDb = testEnv.authenticatedContext(MEMBER_B).firestore();
      await assertFails(getDoc(doc(memberDb, collection, legacyId)));
      await assertFails(getDoc(doc(outsiderDb, collection, legacyId)));
    });
  }
});
