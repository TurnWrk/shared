/**
 * Who may decide a vendor receipt (TURNWRK-36).
 * Canonical rules live in firebase/firestore.rules — never the vendored copy.
 *
 * The field-supply reimbursement path pays the person who submitted the
 * receipt, so the one rule that matters is that submitting and deciding are
 * different jobs. Before the update rule was split, `vendorId == auth.uid`
 * admitted *any* update: a claimant could write `approvalStatus: 'approved'`
 * straight to Firestore and pay themselves, bypassing the server route that
 * owns the $50 auto-approve threshold. The same rule denied an ordinary org
 * manager the approval it was supposed to gate — only the vendor themselves or
 * a platform admin could write at all.
 *
 * So the boundary is two-sided and both sides are asserted here:
 *   1. the claimant may correct their receipt, never decide it;
 *   2. a colleague in the same org may decide it, and touch nothing else.
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
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-turnwrk-rules-vendor-receipts';
const ORG_A = 'org-a';
const ORG_B = 'org-b';
/** The cleaner who bought the supplies and is owed the money. */
const CLAIMANT = 'cleaner-org-a';
/** An org-a member with no admin rights — a PM, the common approver. */
const MANAGER = 'manager-org-a';
/** A member of a different tenant entirely. */
const OUTSIDER = 'member-org-b';
const PLATFORM_ADMIN = 'platform-admin';
const RECEIPT = 'receipt-1';

function userDoc(uid: string, orgId: string, extra: Record<string, unknown> = {}) {
  return {
    uid,
    email: `${uid}@example.com`,
    displayName: uid,
    memberships: [{ orgId, roles: ['pm'] }],
    orgIds: [orgId],
    // Deliberately NOT an org admin: approving a receipt must not require it,
    // because dispatch's PM role carries an empty adminOrgIds.
    adminOrgIds: [],
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...extra,
  };
}

function pendingReceipt() {
  return {
    id: RECEIPT,
    vendorId: CLAIMANT,
    orgId: ORG_A,
    propertyId: 'prop-1',
    amount: '120.00',
    kind: 'field-supply',
    description: 'Paper towels and bin liners',
    receiptImages: ['vendor-receipts/cleaner-org-a/a.jpg'],
    timestamp: 1_700_000_000_000,
    submitted: true,
    approvalStatus: 'pending',
  };
}

describe('firestore.rules vendorReceipts approval split (emulator)', () => {
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
      await setDoc(doc(db, 'users', CLAIMANT), userDoc(CLAIMANT, ORG_A));
      await setDoc(doc(db, 'users', MANAGER), userDoc(MANAGER, ORG_A));
      await setDoc(doc(db, 'users', OUTSIDER), userDoc(OUTSIDER, ORG_B));
      await setDoc(
        doc(db, 'users', PLATFORM_ADMIN),
        userDoc(PLATFORM_ADMIN, ORG_A, { platformAdmin: true }),
      );
      await setDoc(doc(db, 'vendorReceipts', RECEIPT), pendingReceipt());
    });
  });

  const receiptFor = (uid: string) =>
    doc(testEnv.authenticatedContext(uid).firestore(), 'vendorReceipts', RECEIPT);

  // --- the claimant ----------------------------------------------------------

  it('lets the claimant correct their own receipt', async () => {
    await assertSucceeds(
      updateDoc(receiptFor(CLAIMANT), { description: 'Paper towels, bin liners, mop head' }),
    );
  });

  it('denies the claimant approving their own receipt', async () => {
    await assertFails(
      updateDoc(receiptFor(CLAIMANT), {
        approvalStatus: 'approved',
        approvedAt: 1_700_000_100_000,
        approvedBy: CLAIMANT,
      }),
    );
  });

  it('denies the claimant flipping approvalStatus alone', async () => {
    await assertFails(updateDoc(receiptFor(CLAIMANT), { approvalStatus: 'approved' }));
  });

  it('denies the claimant assigning the expense bearer', async () => {
    await assertFails(updateDoc(receiptFor(CLAIMANT), { expenseBearer: 'owner' }));
  });

  it('denies the claimant rejecting their own receipt', async () => {
    // Not an attack, but the same seam: a decision is a decision.
    await assertFails(updateDoc(receiptFor(CLAIMANT), { approvalStatus: 'rejected' }));
  });

  // --- the approver ----------------------------------------------------------

  it('lets a non-admin org colleague approve', async () => {
    await assertSucceeds(
      updateDoc(receiptFor(MANAGER), {
        approvalStatus: 'approved',
        approvedAt: 1_700_000_100_000,
        approvedBy: MANAGER,
        expenseBearer: 'manager',
      }),
    );
  });

  it('lets a non-admin org colleague reject with a reason', async () => {
    await assertSucceeds(
      updateDoc(receiptFor(MANAGER), {
        approvalStatus: 'rejected',
        rejectedAt: 1_700_000_100_000,
        rejectedBy: MANAGER,
        rejectionReason: 'No property attached',
      }),
    );
  });

  it('denies an approver editing the amount while approving', async () => {
    await assertFails(
      updateDoc(receiptFor(MANAGER), { approvalStatus: 'approved', amount: '900.00' }),
    );
  });

  it('denies an approver editing the receipt without deciding it', async () => {
    await assertFails(updateDoc(receiptFor(MANAGER), { description: 'rewritten by someone else' }));
  });

  // --- other tenants and platform admins -------------------------------------

  it("denies another org's member approving", async () => {
    await assertFails(
      updateDoc(receiptFor(OUTSIDER), { approvalStatus: 'approved', approvedBy: OUTSIDER }),
    );
  });

  it('lets a platform admin decide', async () => {
    await assertSucceeds(
      updateDoc(receiptFor(PLATFORM_ADMIN), {
        approvalStatus: 'approved',
        approvedBy: PLATFORM_ADMIN,
      }),
    );
  });

  // --- invariants the split must not have loosened ---------------------------

  it('denies moving a receipt into another org', async () => {
    await assertFails(updateDoc(receiptFor(CLAIMANT), { orgId: ORG_B }));
  });

  it('denies reassigning a receipt to another claimant', async () => {
    await assertFails(updateDoc(receiptFor(CLAIMANT), { vendorId: MANAGER }));
  });
});
