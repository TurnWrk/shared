/**
 * Standalone expense receipt submitted by a vendor outside any work order.
 * Stored in the shared `vendorReceipts` collection — written by hostfix-cmms
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
 *   - Excluded from technician earnings until an approval flow exists.
 */
export interface VendorReceipt {
  id: string;
  /** Submitter's auth uid. */
  vendorId: string;
  orgId?: string;
  /** Optional property this expense applies to. */
  propertyId?: string;
  amount: string;
  description?: string;
  receiptImages: string[];
  /** Unix ms. */
  timestamp?: number;
  submitted?: boolean;
}
