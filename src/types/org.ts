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

/** Suite product keys on `Org.enabledApps`. */
export type OrgAppKey = 'hostfixCmms' | 'restock' | 'clean';

/**
 * Legacy Firestore docs sometimes store `enabledApps.cmms` instead of
 * `hostfixCmms`. Writers must always use `hostfixCmms`; readers dual-read.
 */
export type OrgEnabledApps = {
  hostfixCmms?: boolean;
  restock?: boolean;
  /** Turnwrk Clean (cleaning-operations product). */
  clean?: boolean;
  /**
   * @deprecated Legacy key — dual-read only. Prefer `hostfixCmms`.
   * Present on some older docs until migrate-enabled-apps-keys runs.
   */
  cmms?: boolean;
};

export type OrgStatus = 'active' | 'suspended';

export type OrgBillingSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | null;

/**
 * Suite SaaS billing on the org (Turnwrk charging operators for software).
 * Distinct from Clean customer Stripe (`clean_customers.stripeCustomerId`)
 * and Mercury owner AR. Privileged writes go through Admin SDK / platform
 * admin APIs — org admins must not set these client-side.
 */
export interface OrgBilling {
  stripeCustomerId?: string;
  /** Stripe Subscription id for suite SaaS (sub_…); not Clean Connect. */
  stripeSubscriptionId?: string;
  subscriptionStatus?: OrgBillingSubscriptionStatus;
  /**
   * e.g. 'comp' | 'founder_ltd' | 'restock_pro' | 'trial' | suite plan SKU
   * (comma-separated `dispatch` | `restock` | `clean`) — see `@turnwrk/shared/billing`.
   */
  planId?: string;
  /** Billable property/unit count mirrored onto the Stripe subscription quantity. */
  unitCount?: number;
  /** Last applied volume discount percent (0–25); mirrored from suite quote. */
  volumeDiscountPct?: number;
  /** UTC epoch ms when the current period ends (if known). */
  currentPeriodEnd?: number;
  /**
   * UTC epoch ms when an indefinite trial should start counting down.
   * Absent = indefinite trial (no countdown). Paid-plan Checkout uses
   * `createSuiteTrialBilling` (45-day) via `@turnwrk/shared/billing` SUITE_TRIAL_DAYS.
   */
  trialEndsAt?: number;
  /** Support / comp reason — free text. */
  notes?: string;
  updatedAt?: number;
  /** platformAdmin uid who last mutated billing. */
  updatedBy?: string;
}

/**
 * Default suite apps for self-serve / trial org create (TURNWRK-145).
 * Dispatch + Restock on; Clean stays opt-in. Callers may override via bootstrap body.
 */
export const DEFAULT_TRIAL_ENABLED_APPS: Required<
  Pick<OrgEnabledApps, 'hostfixCmms' | 'restock' | 'clean'>
> = {
  hostfixCmms: true,
  restock: true,
  clean: false,
};

/**
 * Indefinite suite trial billing for newly bootstrapped orgs.
 * No `trialEndsAt` / `currentPeriodEnd` until a future migration sets them.
 * Prefer `createSuiteTrialBilling` once suite Checkout / paid plans go live.
 */
export function createIndefiniteTrialBilling(now: number = Date.now()): OrgBilling {
  return {
    subscriptionStatus: 'trialing',
    planId: 'trial',
    notes: 'Indefinite trial — ends-at deferred until paid plans launch',
    updatedAt: now,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 45-day suite trial aligned with Stripe Checkout trial_period_days
 * (`SUITE_TRIAL_DAYS` in `@turnwrk/shared/billing`). Use when wiring paid plans;
 * bootstrap still uses `createIndefiniteTrialBilling` until cutover.
 */
export function createSuiteTrialBilling(
  now: number = Date.now(),
  trialDays: number = 45,
): OrgBilling {
  const days = Math.max(1, Math.trunc(trialDays));
  return {
    subscriptionStatus: 'trialing',
    planId: 'trial',
    trialEndsAt: now + days * DAY_MS,
    notes: `${days}-day suite trial`,
    updatedAt: now,
  };
}

/**
 * Resolve enabledApps for org bootstrap: explicit body wins (normalized);
 * otherwise Dispatch + Restock trial defaults.
 */
export function resolveBootstrapEnabledApps(
  input?: OrgEnabledApps | null,
): NonNullable<Org['enabledApps']> {
  if (input && Object.keys(input).length > 0) {
    return (
      normalizeEnabledApps(input) ?? {
        hostfixCmms: false,
        restock: false,
        clean: false,
      }
    );
  }
  return { ...DEFAULT_TRIAL_ENABLED_APPS };
}

/**
 * Whether an org may use a suite app.
 *
 * - Dual-reads legacy `enabledApps.cmms` as `hostfixCmms`.
 * - Missing `enabledApps` entirely: allow hostfixCmms + restock (legacy
 *   grandfather); Clean stays off until explicitly enabled (matches Clean app).
 * - `status === 'suspended'`: all apps off.
 */
export function orgAppEnabled(
  org: Pick<Org, 'enabledApps' | 'status'> | null | undefined,
  app: OrgAppKey,
): boolean {
  if (!org) return false;
  if (org.status === 'suspended') return false;
  const apps = org.enabledApps;
  if (!apps) {
    return app === 'hostfixCmms' || app === 'restock';
  }
  if (app === 'hostfixCmms') {
    return apps.hostfixCmms === true || apps.cmms === true;
  }
  return apps[app] === true;
}

/** Normalize enabledApps for writes: always `hostfixCmms`, never `cmms`. */
export function normalizeEnabledApps(
  input: OrgEnabledApps | null | undefined,
): Org['enabledApps'] {
  if (!input) return undefined;
  const hostfixCmms = input.hostfixCmms === true || input.cmms === true;
  return {
    ...(hostfixCmms ? { hostfixCmms: true } : { hostfixCmms: false }),
    ...(input.restock === true ? { restock: true } : { restock: false }),
    ...(input.clean === true ? { clean: true } : { clean: false }),
  };
}

export function orgIsSuspended(
  org: Pick<Org, 'status'> | null | undefined,
): boolean {
  return org?.status === 'suspended';
}

/**
 * Whether an org's suite trial has ended (TURNWRK-151).
 *
 * Policy for early access: absent `trialEndsAt` = indefinite trial (never
 * expired). Countdown / soft-lock UI is deferred until a migration sets
 * ends-at on early signups. OrgAppGate continues to enforce `enabledApps` +
 * suspended only — do not auto-lock on expiry yet.
 */
export function isOrgTrialExpired(
  billing: Pick<OrgBilling, 'subscriptionStatus' | 'trialEndsAt'> | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!billing || billing.subscriptionStatus !== 'trialing') return false;
  if (typeof billing.trialEndsAt !== 'number') return false;
  return billing.trialEndsAt <= now;
}

/** True when trialing with no ends-at, or ends-at still in the future. */
export function isOrgIndefiniteOrActiveTrial(
  billing: Pick<OrgBilling, 'subscriptionStatus' | 'trialEndsAt'> | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!billing || billing.subscriptionStatus !== 'trialing') return false;
  return !isOrgTrialExpired(billing, now);
}

export interface Org {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /**
   * Soft lifecycle. Absent = active. Suspended orgs retain data but apps
   * refuse entry via `orgAppEnabled`.
   */
  status?: OrgStatus;
  // which apps this org has enabled — lets apps gate features without
  // requiring a separate config lookup
  enabledApps?: OrgEnabledApps;
  /** Plan-flag gates (see OrgFeatureKey). Absent = ORG_FEATURE_DEFAULTS. */
  features?: Partial<Record<OrgFeatureKey, boolean>>;
  /** Suite SaaS billing (not Clean job payments / Mercury). */
  billing?: OrgBilling;
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
