/**
 * Standalone expense receipt submitted by a vendor outside any work order.
 * Stored in the shared `vendorReceipts` collection — written by dispatch
 * (technician Pay tab) today; restock will write the same shape when
 * authenticated cleaners submit supply-purchase receipts.
 *
 * Contract notes:
 *   - `vendorId` is the submitter's Firebase auth uid (hostfix tech profile
 *     id == uid; restock cleaners need a `users/{uid}` doc with org
 *     membership for rules to admit the write).
 *   - Receipt photos live in Firebase Storage under
 *     `vendor-receipts/{vendorId}/`.
 *   - `amount` is a string for parity with hostfix's work-order-embedded
 *     receipt shape.
 */
export type VendorReceiptApprovalStatus = 'pending' | 'approved' | 'rejected';

/**
 * What the spend was for, which decides who reimburses it and on what clock.
 *
 * `field-supply` is a cleaner or technician buying supplies mid-turnover and
 * being paid back outside the AP cycle (TURNWRK-36) — the restock path stamps
 * it server-side on submit. Absent on every row that predates the field,
 * including dispatch's technician Pay tab, so consumers must treat `undefined`
 * as "ordinary vendor expense" rather than assuming a kind.
 */
export type VendorReceiptKind = 'field-supply';

/** Who the expense is billed to after dispatcher assignment. */
export type ExpenseBearer = 'owner' | 'manager' | 'guest';

export interface VendorReceipt {
  id: string;
  /** Submitter's auth uid. */
  vendorId: string;
  orgId?: string;
  /** Optional property this expense applies to. */
  propertyId?: string;
  amount: string;
  /** What the spend was for; absent on rows written before the field existed. */
  kind?: VendorReceiptKind;
  description?: string;
  receiptImages: string[];
  /** Unix ms. */
  timestamp?: number;
  submitted?: boolean;
  /** SOP-06 approval flow — pending until dispatcher reviews. */
  approvalStatus?: VendorReceiptApprovalStatus;
  /** Set on approve: owner upgrade, manager ops, or guest damage. */
  expenseBearer?: ExpenseBearer;
  /**
   * Day of spend (unix ms, start of day). Required when expenseBearer is
   * `guest` for later reservation matching.
   */
  purchaseDate?: number;
  approvedAt?: number;
  approvedBy?: string;
  rejectedAt?: number;
  rejectedBy?: string;
  rejectionReason?: string;
}
