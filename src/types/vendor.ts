/**
 * Org-independent vendor identity shared across hostfix-cmms and restock.
 * Org access is modeled in `vendorAffiliations` (and denormalized `orgIds`
 * on the vendor doc for rules/queries).
 */

export type VendorApp = 'cmms' | 'restock';

export type VendorSmsConsentStatus = 'pending' | 'verified' | 'opted-out';

export interface VendorSmsConsent {
  status?: VendorSmsConsentStatus;
  invitedAt?: number;
  verifiedAt?: number;
  optedOutAt?: number;
  lastKeyword?: string;
}

/** Canonical vendor profile — one per phone number. */
export interface Vendor {
  id: string;
  /** E.164 phone; unique identity key across apps. */
  phone: string;
  name: string;
  email?: string;
  /** Firebase Auth uid once the vendor has signed in. */
  userId?: string;
  avatar?: string;
  smsConsent?: VendorSmsConsent;
  telegramChatId?: string;
  telegramLinkedAt?: number;
  /**
   * Denormalized union of org ids from all affiliations. Maintained by
   * writers — not the source of truth for membership details.
   */
  orgIds?: string[];
  createdAt: number;
  updatedAt: number;
}

/** Links a vendor to an org via an app-specific profile doc. */
export interface VendorAffiliation {
  id: string;
  vendorId: string;
  orgId: string;
  app: VendorApp;
  /** `cmms_technicians` or `restock_cleaners` doc id. */
  profileId: string;
  createdAt: number;
  updatedAt: number;
}

export function vendorAffiliationId(
  vendorId: string,
  orgId: string,
  app: VendorApp,
): string {
  return `${vendorId}_${orgId}_${app}`;
}
