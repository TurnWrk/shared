import type { InspectMode } from './property';
import type { LaundryVendorConfig } from './property';
import type { CleanOrgSettings } from './clean';

export interface OrgBranding {
  logoUrl?: string;
  logoPath?: string;
  /** Brand primary color (hex). Drives whitelabel theme tokens in clean/. */
  accentColor?: string;
  companyName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

/** SOP-05 weekly on-call rotation entry. */
export interface OnCallRotationEntry {
  weekStart: string; // ISO date YYYY-MM-DD (Monday)
  techId?: string;
  dispatcherUserId?: string;
}

/**
 * SOP-05 / SOP-08 SLA thresholds (org-configurable).
 */
export interface OrgSlaSettings {
  /** Minutes before unacknowledged WO escalates to secondary (default 20). */
  workOrderAckMinutes?: number;
  /** Hours before unacked resupply request is flagged (default 24). */
  resupplyAckHours?: number;
  /** Days before open resupply request is aged (default 7). */
  resupplyOpenDays?: number;
  /** User ids notified before admins on WO SLA breach (dispatchers, etc.). */
  secondaryNotifyUserIds?: string[];
}

/**
 * Plan-flag gate keys (Change Order 1 R2/A9; doc 07 "org_features"). This is
 * deliberately NOT a billing-tier system — just per-org boolean gates that a
 * future pricing design can drive (F2). Absent keys fall back to
 * ORG_FEATURE_DEFAULTS.
 */
export type OrgFeatureKey =
  /** Operator may edit notification templates (default on). */
  | 'clean_editable_templates'
  /** Removes "Powered by Turnwrk" badging from the public booking surfaces (default off). */
  | 'clean_white_label_booking'
  /** SMS channel available to this org (default on; sends still require org smsEnabled + provider config). */
  | 'clean_sms'
  /** Bounty photo rewards (Change Order 2). Default off: zero UI, zero rows. */
  | 'clean_bounties';

export const ORG_FEATURE_DEFAULTS: Record<OrgFeatureKey, boolean> = {
  clean_editable_templates: true,
  clean_white_label_booking: false,
  clean_sms: true,
  clean_bounties: false,
};

/** Resolve a feature flag with its default. */
export function orgFeatureEnabled(
  org: Pick<Org, 'features'> | null | undefined,
  key: OrgFeatureKey,
): boolean {
  return org?.features?.[key] ?? ORG_FEATURE_DEFAULTS[key];
}

export interface Org {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  // which apps this org has enabled — lets apps gate features without
  // requiring a separate config lookup
  enabledApps?: {
    hostfixCmms?: boolean;
    restock?: boolean;
    /** Turnwrk Clean (cleaning-operations product). */
    clean?: boolean;
  };
  /** Plan-flag gates (see OrgFeatureKey). Absent = ORG_FEATURE_DEFAULTS. */
  features?: Partial<Record<OrgFeatureKey, boolean>>;
  branding?: OrgBranding;
  /**
   * IANA timezone (e.g. 'America/Chicago'). Used for display and for
   * computing schedule-derived instants (e.g. the Clean T-48h pre-auth) —
   * absent falls back to app-level defaults.
   */
  timezone?: string;
  /** ISO 4217 currency for customer-facing money (default 'USD'). */
  currency?: string;
  /** Sales-tax settings applied to Clean bookings. Whole percent (8.25 = 8.25%). */
  tax?: { pct: number };
  /** Turnwrk Clean org configuration (booking site, windows, reviews, …). */
  cleanSettings?: CleanOrgSettings;
  /**
   * Default inspect mode applied to newly created properties for this org.
   * Individual properties can still override via `PropertySupply.inspectMode`.
   * Falls back to `'full_checklist'` when absent.
   */
  defaultInspectMode?: InspectMode;
  /**
   * Vendor "quick work order" thresholds. When a vendor raises a small work
   * order on-site that falls under either cap (or is an emergency) it skips the
   * dispatcher approval gate. Absent fields fall back to app-level defaults
   * (see hostfix-cmms/lib/quickWorkOrder.ts DEFAULT_QUICK_WO_CONFIG).
   */
  quickWorkOrder?: {
    enabled?: boolean;       // default true
    maxLaborHours?: number;  // default 2
    maxCostUsd?: number;     // default 200
  };
  /** SOP-05 after-hours on-call rotation. */
  onCallRotation?: OnCallRotationEntry[];
  /** SOP-05/08 SLA defaults for this org. */
  sla?: OrgSlaSettings;
  /** SOP-08 per-market laundry vendor configs. */
  laundryVendors?: LaundryVendorConfig[];
}
