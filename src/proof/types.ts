/**
 * Proof-of-service types (Verticals C1 — TURNWRK-319).
 *
 * Extracted from src/types/clean.ts. This module was ALREADY trade-neutral —
 * its own comment anticipated a pool vertical — which is why it is the pilot
 * for the C2-C7 extractions. Nothing here mentions cleaning.
 */
import type { ChecklistItemStatus } from '../types/checklist';
import type {
  CleanNotificationChannel,
  CleanNotificationSendStatus,
} from '../notifications/types';

export type VisitReportPhotoKind = 'before' | 'in_progress' | 'after';

/** One photo in the customer-facing report (mapped from a WO timeline entry). */
export interface VisitReportPhoto {
  kind: VisitReportPhotoKind;
  url: string;
  /** Timeline entry timestamp, when known (used for stable ordering). */
  timestamp?: number;
  caption?: string;
}

/** A completed checklist item, flattened for the customer report. */
export interface VisitReportChecklistItem {
  label: string;
  status?: ChecklistItemStatus;
  note?: string;
  notApplicable?: boolean;
  /** How many photos back this item up. */
  photoCount: number;
}

export interface VisitReportChecklistSection {
  title: string;
  items: VisitReportChecklistItem[];
}

export interface VisitReportPhotoCounts {
  before: number;
  inProgress: number;
  after: number;
  total: number;
}

/** One numeric checklist reading flattened for the customer report. */
export interface VisitReportReading {
  label: string;
  /** Display value as entered by the tech (e.g. "7.4", "80"). */
  value: string;
  unit?: string;
}

/**
 * The assembled proof-of-service report — a self-contained snapshot composed
 * from a work order's before/after photos and completed checklist at the
 * moment a visit finishes. Pure data: assembled by `assembleVisitReport`
 * (src/clean/visitReport.ts), persisted for later viewing, and summarized into
 * the `visit_report` notification. `readings` (water chemistry etc.) arrives
 * with the pool vertical V5.
 */
export interface VisitReport {
  /** Service name shown to the customer (e.g. "Weekly Pool Service"). */
  service: string;
  /** Display date, pre-formatted by the caller. */
  date: string;
  photos: {
    before: VisitReportPhoto[];
    inProgress: VisitReportPhoto[];
    after: VisitReportPhoto[];
  };
  photoCounts: VisitReportPhotoCounts;
  checklist: {
    sections: VisitReportChecklistSection[];
    /** Complete / total across the WHOLE checklist (honest even when only completed items are listed). */
    done: number;
    total: number;
    /** One-line summary, e.g. "Checklist 12/14 complete". */
    summaryLine: string;
  };
  /** Numeric checklist readings (water chemistry etc.), when captured. */
  readings?: VisitReportReading[];
}

/**
 * Persisted report doc (`clean_visitReports`) — retained so the customer
 * record can show past reports and so re-completing a visit stays idempotent
 * (doc id = assignmentId). One report per visit.
 */
/**
 * Persisted report doc (`clean_visitReports`, `svc_visitReports` after the
 * rename) — retained so the customer record can show past reports and so
 * re-completing a visit stays idempotent (doc id = assignmentId).
 *
 * NAMING: the decision record's collision rule would give `ServiceVisitReport`,
 * but the payload it wraps is already `VisitReport`, and two near-identical
 * names distinguished only by a `Service` prefix read badly at the call site.
 * `Record` names the wrapper/payload relationship instead. Flagged on
 * TURNWRK-319 as the precedent C2-C7 inherit — easy to reverse now, expensive
 * after six more extractions copy it.
 */
export interface VisitReportRecord {
  /** Doc id — the assignment id, making writes idempotent per visit. */
  id: string;
  orgId: string;
  bookingId: string;
  assignmentId: string;
  customerId?: string;
  workOrderId?: string;
  report: VisitReport;
  /** Channel that carried the report to the customer, when one did. */
  sentChannel?: CleanNotificationChannel;
  sentStatus?: CleanNotificationSendStatus;
  createdAt: number;
}
