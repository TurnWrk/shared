/**
 * Cross-tenant isolation for org-scoped collections (TURNWRK-471, extended for
 * TURNWRK-271 — the third tenant type, a self-serve independent trade).
 * Canonical rules live in firebase/firestore.rules — never the vendored copy.
 *
 * A trade org is an ordinary tenant: isolation is decided by `orgId` and the
 * caller's membership lists, never by persona (`Org.verticals` drives shell and
 * landing only). So these cases carry no persona at all — that is the point.
 * Three boundaries, per collection:
 *   1. READ — a member of one org cannot read another org's doc, and a legacy
 *      doc with no `orgId` at all is unreadable by everyone.
 *   2. CREATE — a member cannot plant a doc carrying another org's `orgId`.
 *   3. UPDATE — a member cannot move their own doc into another org by
 *      rewriting `orgId` (a cross-tenant *write*, the mirror of case 1).
 * Plus the `orgs` doc itself, which is where the self-declared business profile
 * (license / insurance) lives.
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
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-turnwrk-rules-tenant-isolation';
const ORG_A = 'org-a';
const ORG_B = 'org-b';
const MEMBER_A = 'user-org-a';
const MEMBER_B = 'user-org-b';
const ADMIN_A = 'admin-org-a';
/** Member of org-a who is NOT an org admin — org-doc writes must refuse them. */
const VIEWER_A = 'viewer-org-a';

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

function orgDoc(orgId: string, name: string) {
  return {
    id: orgId,
    name,
    // A trade org, to make the point that isolation ignores it entirely.
    verticals: ['pool'],
    primaryVertical: 'pool',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
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
      await setDoc(doc(db, 'users', VIEWER_A), userDoc(VIEWER_A, ORG_A, { adminOrgIds: [] }));

      await setDoc(doc(db, 'orgs', ORG_A), orgDoc(ORG_A, 'Ridgeline Pool Care'));
      await setDoc(doc(db, 'orgs', ORG_B), orgDoc(ORG_B, 'Second Tenant'));

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

  // --- cross-tenant WRITES ---------------------------------------------------
  // The mirror of the read cases: shutting reads is not isolation on its own if
  // one tenant can still push rows into another. svc_* collections fail these a
  // step earlier (every client write is platform-admin only) — same verdict.

  for (const { collection, docId, scoped } of CASES) {
    it(`denies org-b from creating a ${collection} doc carrying org-a's orgId`, async () => {
      const db = testEnv.authenticatedContext(MEMBER_B).firestore();
      await assertFails(
        setDoc(doc(db, collection, `${docId}-planted`), { ...scoped, orgId: ORG_A }),
      );
    });

    it(`denies org-a from moving its own ${collection} doc into org-b`, async () => {
      const db = testEnv.authenticatedContext(MEMBER_A).firestore();
      await assertFails(updateDoc(doc(db, collection, docId), { orgId: ORG_B }));
    });
  }

  // --- the org doc, where the business profile lives -------------------------

  it('lets a member read their own org doc', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A).firestore();
    await assertSucceeds(getDoc(doc(db, 'orgs', ORG_A)));
  });

  it("denies org-b from reading org-a's org doc", async () => {
    const db = testEnv.authenticatedContext(MEMBER_B).firestore();
    await assertFails(getDoc(doc(db, 'orgs', ORG_A)));
  });

  it('lets an org admin save the self-declared business profile', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A).firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'orgs', ORG_A), {
        businessProfile: {
          licenseNumber: 'TACLA00123C',
          insuranceCarrier: 'Acme Mutual',
          insurancePolicyNumber: 'POL-98213',
        },
        updatedAt: 1_700_000_000_100,
      }),
    );
  });

  it('denies a non-admin member editing the business profile', async () => {
    const db = testEnv.authenticatedContext(VIEWER_A).firestore();
    await assertFails(
      updateDoc(doc(db, 'orgs', ORG_A), {
        businessProfile: { licenseNumber: 'FORGED-1' },
      }),
    );
  });

  it("denies org-b's members editing org-a's business profile", async () => {
    const db = testEnv.authenticatedContext(MEMBER_B).firestore();
    await assertFails(
      updateDoc(doc(db, 'orgs', ORG_A), {
        businessProfile: { licenseNumber: 'FORGED-2' },
      }),
    );
  });

  it('still refuses privileged org fields to an org admin (entitlements are not self-serve)', async () => {
    const db = testEnv.authenticatedContext(MEMBER_A).firestore();
    await assertFails(
      updateDoc(doc(db, 'orgs', ORG_A), { features: { svc_bounties: true } }),
    );
    await assertFails(updateDoc(doc(db, 'orgs', ORG_A), { status: 'suspended' }));
  });
});
