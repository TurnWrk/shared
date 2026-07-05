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

export type VendorVerificationStatus = 'pending' | 'verified';

/**
 * Links a vendor to an org via an app-specific profile doc.
 *
 * Org-scoped economics live HERE, never on the shared `Vendor` profile —
 * a crew member's rate/verification with one operator must not leak to
 * another operator reading the same vendor doc.
 */
export interface VendorAffiliation {
  id: string;
  vendorId: string;
  orgId: string;
  app: VendorApp;
  /** `cmms_technicians` or `restock_cleaners` doc id. */
  profileId: string;
  /** Org-scoped hourly labor rate in minor units (Turnwrk Clean payroll). */
  hourlyRateMinor?: number;
  /** Org-scoped verification state shown in the Clean contractors table. */
  verificationStatus?: VendorVerificationStatus;
  /** Org-scoped active flag (inactive contractors are hidden from assignment). */
  active?: boolean;
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
