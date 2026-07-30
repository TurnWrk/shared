export interface Owner {
  id: string;
  orgId: string;
  name: string;
  phone: string;
  email?: string;
  mercuryCustomerId?: string | null;
  mercuryCustomerEmail?: string | null;
  // Set when this owner's identity fields are owned by an external CRM sync
  // (TURNWRK-354). The vendor record id lives on the OwnerMapping, not here.
  // Server-managed only — firestore.rules blocks client writes to it.
  managedBy?: 'twenty' | null;
  // Reserved for the future read-only owner mini-dashboard. When set, the
  // linked Firebase Auth user may read this owner + its properties via an
  // owner-scoped rules path (currently stubbed in firestore.rules).
  linkedUserId?: string;
  createdAt: number;
  updatedAt: number;
}
