/**
 * Property compliance model (TURNWRK-718): licenses, registrations, permits,
 * HOA approvals, life-safety checks, inspections and tax filings a short-term
 * rental must keep current. One `ComplianceItem` per obligation per property,
 * persisted in `cmms_complianceItems` (Admin SDK writes only).
 *
 * Status is never stored: read it through `complianceStatus()`, which derives
 * it from the dates below and the caller's org-local today.
 */
import type { PMCadenceUnit } from '../routing/templates.types';

export type ComplianceKind =
  | 'license'
  | 'registration'
  | 'permit'
  | 'hoa_approval'
  | 'life_safety'
  | 'inspection'
  | 'tax_filing';

/** Where the item came from: a jurisdiction rule seed, the operator, or a DBPR record prefill. */
export type ComplianceSource = 'jurisdiction_seed' | 'operator' | 'dbpr_prefill';

export type ComplianceJurisdictionLevel = 'state' | 'county' | 'city' | 'hoa';

export interface ComplianceJurisdiction {
  level: ComplianceJurisdictionLevel;
  /** Two-letter state code ("FL"). */
  state: string;
  /** County, city or association name; omitted for state-level items. */
  name?: string;
}

/** Recurrence of a renewable or periodic item. Same unit set as PM schedules. */
export interface ComplianceCadence {
  value: number;
  unit: PMCadenceUnit;
}

export type ComplianceResult = 'pass' | 'fail' | 'conditional';

export type ComplianceDocumentKind = 'license' | 'certificate' | 'report' | 'receipt';

export interface ComplianceDocument {
  /** Firebase Storage object path. */
  storagePath: string;
  name: string;
  kind: ComplianceDocumentKind;
  uploadedAt: number;
}

/** How a DBPR public-record row was tied to this property. */
export type DbprMatchedBy = 'license_number' | 'address';

/** Snapshot of the Florida DBPR vacation-rental license record matched to the item. */
export interface ComplianceDbprRecord {
  licenseNumber: string;
  licenseeName: string;
  county: string;
  rentalUnits: number;
  /** YYYY-MM-DD; absent when DBPR has no inspection on file. */
  lastInspectionDate?: string;
  matchedBy: DbprMatchedBy;
  syncedAt: number;
}

export interface ComplianceItem {
  id: string;
  orgId: string;
  propertyId: string;
  kind: ComplianceKind;
  /** Jurisdiction rule key (`fl.dbpr_vr_license`); absent for free-form operator items. */
  ruleKey?: string;
  source: ComplianceSource;
  label: string;
  jurisdiction: ComplianceJurisdiction;
  /** License, registration or permit number. */
  identifier?: string;
  /** YYYY-MM-DD */
  issuedOn?: string;
  /** YYYY-MM-DD */
  expiresOn?: string;
  /** YYYY-MM-DD: the next check, filing or renewal. */
  nextDueDate?: string;
  cadence?: ComplianceCadence;
  /** Days before the due date the item turns `due_soon` and reminders start. */
  leadDays: number;
  /** PM schedule that generates the recurring check's work orders. */
  pmScheduleId?: string;
  lastWorkOrderId?: string;
  lastCompletedAt?: number;
  lastResult?: ComplianceResult;
  documents: ComplianceDocument[];
  /** Shown to the property owner in the owner portal. */
  ownerVisible: boolean;
  dbpr?: ComplianceDbprRecord;
  /** Idempotency keys of reminders already sent for this item. */
  remindersSent: string[];
  createdAt: number;
  updatedAt: number;
}

export type ComplianceStatus = 'missing' | 'current' | 'due_soon' | 'overdue';
