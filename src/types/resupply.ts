export type ResupplyStatus =
  | 'pending'
  | 'approved'
  | 'ordered'
  | 'fulfilled'
  | 'rejected';

export type ResupplySource =
  | 'manual'
  | 'relay-chat'
  | 'restock-app'
  | 'guest-qr';

/**
 * Which side of the suite the requesting vendor uses. Set by the originating
 * app so dispatch-assistant-api and downstream UIs can route by persona:
 *   - 'cleaning'    — turnover cleaner using the Restock /inspect form
 *   - 'maintenance' — technician using the CMMS technician panel / Relay Chat
 */
export type ResupplyVendorType = 'cleaning' | 'maintenance';

/**
 * One requested resupply line.
 *
 * Two origin styles share this shape:
 *   - Restock (catalog-linked): `itemType` is the canonical catalog key
 *     (e.g. 'toilet-paper'); `productId` optionally pins a specific product.
 *   - Hostfix-CMMS (free-text): `name` is a human label (e.g. "dish sponges").
 *
 * At least one of `itemType` or `name` must be set.
 */
export interface ResupplyItem {
  quantity: number;
  itemType?: string;
  name?: string;
  productId?: string;
  note?: string;
  /**
   * Stable local id, optional. Used by hostfix's UI to track line edits; not
   * required when items are ephemeral inside a restock submission.
   */
  id?: string;
}

export interface ResupplyRequest {
  id: string;
  orgId: string;
  propertyId: string;
  status: ResupplyStatus;
  source: ResupplySource;
  items: ResupplyItem[];
  requestedBy?: string;      // user uid OR anonymous token id
  approvedBy?: string;
  fulfilledBy?: string;
  createdAt: number;
  updatedAt: number;
  notes?: string;

  // Hostfix-CMMS workflow fields — optional because restock writers don't
  // populate them. Kept on the shared type so both apps can read a single
  // canonical document without casting.
  vendorId?: string;
  vendorName?: string;
  /** Chat action item that spawned this request (CMMS extractor). */
  sourceActionItemId?: string;
  /** Chat message the extractor ran on. */
  sourceMessageId?: string;
  /** Work order auto-created on approval. */
  convertedWOId?: string;
  /** Deep link to the restock app for the approver to actually purchase. */
  restockPurchaseUrl?: string;
  /** Guest-QR token that created the request (anonymous flow). */
  tokenId?: string;
  approvedAt?: number;
  orderedAt?: number;
  fulfilledAt?: number;
  rejectedAt?: number;
  rejectedBy?: string;
  rejectionReason?: string;

  /** Vendor persona that originated the request. */
  vendorType?: ResupplyVendorType;

  // Restock-only extension fields. CMMS readers can ignore these; persisted
  // on the canonical doc so a request created via /inspect retains its
  // photo evidence and cleaner attribution.
  cleanerId?: string;
  cleanerName?: string;
  /** Catalog itemType slugs (Restock catalog) — present alongside `items`. */
  itemTypes?: string[];
  notesImageUrls?: string[];
  storagePhotos?: Array<{
    storageId: string;
    storageName: string;
    imageUrls: string[];
  }>;
}

// ==================== PURCHASE REQUESTS ====================
// One-off, non-consumable purchases (furniture, appliances, decor, …).
// Originates in hostfix-cmms but lives in the shared `purchaseRequests`
// collection so other suite apps can read it.

export type PurchaseRequestStatus =
  | 'pending'
  | 'approved'
  | 'purchased'
  | 'delivered'
  | 'rejected';

export type PurchaseCategory =
  | 'furniture'
  | 'appliance'
  | 'fixture'
  | 'electronics'
  | 'decor'
  | 'other';

export interface PurchaseRequest {
  id: string;
  orgId: string;
  propertyId: string;
  itemName: string;
  quantity?: number;
  category?: PurchaseCategory;
  estimatedCost?: number;
  urgency: 'High' | 'Medium' | 'Low';
  reason?: string;
  status: PurchaseRequestStatus;
  source?: ResupplySource;
  sourceActionItemId?: string;
  sourceMessageId?: string;
  convertedWOId?: string;
  photoUrls?: string[];
  purchaseUrl?: string;
  vendorId?: string;
  vendorName?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  approvedAt?: number;
  purchasedAt?: number;
  deliveredAt?: number;
}
