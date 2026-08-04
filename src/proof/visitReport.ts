/**
 * Proof-of-service visit report assembler (Verticals V2 — TURNWRK-291).
 *
 * Pure composition, not new plumbing: it folds a work order's before/after
 * photos (WO timeline entries, mapped by the caller) and its completed
 * checklist into a self-contained {@link VisitReport} snapshot. The snapshot is
 * persisted for later viewing and summarized into the `visit_report`
 * notification. No IO here — the clean server loads the WO and maps its
 * timeline entries into {@link VisitReportPhoto}s before calling in.
 *
 * Checklist completion reuses the single source of truth in
 * ../checklist/progress (isChecklistItemComplete / checklistProgress /
 * checklistSummaryLine) so "what counts as done" never drifts from the vendor
 * UI.
 */
import type { WorkOrderChecklist } from '../types/checklist';
import type {
  VisitReport,
  VisitReportChecklistSection,
  VisitReportPhoto,
  VisitReportPhotoCounts,
  VisitReportReading,
} from './types';
import {
  checklistProgress,
  checklistSummaryLine,
  isChecklistItemComplete,
} from '../checklist/progress';

export interface AssembleVisitReportInput {
  /** Service name shown to the customer. */
  service: string;
  /** Pre-formatted display date in the org timezone. */
  date: string;
  /** Photos from the WO timeline (before/in_progress/after), any order. */
  photos: VisitReportPhoto[];
  /** The WO's structured checklist, if any. */
  checklist?: WorkOrderChecklist;
  /**
   * List only completed checklist items (default true) — the customer report
   * shouldn't advertise unfinished work. done/total still count the WHOLE
   * checklist so "12/14 complete" stays honest.
   */
  completedOnly?: boolean;
}

/** Stable order: by timestamp ascending, entries without one kept in input order. */
function byTimestamp(a: VisitReportPhoto, b: VisitReportPhoto): number {
  if (a.timestamp === undefined && b.timestamp === undefined) return 0;
  if (a.timestamp === undefined) return 1;
  if (b.timestamp === undefined) return -1;
  return a.timestamp - b.timestamp;
}

function extractReadings(checklist: WorkOrderChecklist | undefined): VisitReportReading[] {
  const readings: VisitReportReading[] = [];
  for (const section of checklist?.sections ?? []) {
    for (const item of section.items) {
      if (item.inputType !== 'number' || !isChecklistItemComplete(item)) continue;
      const raw = typeof item.value === 'string' ? item.value.trim() : '';
      if (!raw) continue;
      readings.push({
        label: item.label,
        value: raw,
        ...(item.suffix !== undefined ? { unit: item.suffix } : {}),
      });
    }
  }
  return readings;
}

/**
 * Compose a customer-facing report from a visit's photos + checklist. Pure and
 * deterministic — same inputs always yield the same report.
 */
export function assembleVisitReport(input: AssembleVisitReportInput): VisitReport {
  const completedOnly = input.completedOnly ?? true;

  const before = input.photos.filter((p) => p.kind === 'before').sort(byTimestamp);
  const inProgress = input.photos.filter((p) => p.kind === 'in_progress').sort(byTimestamp);
  const after = input.photos.filter((p) => p.kind === 'after').sort(byTimestamp);

  const photoCounts: VisitReportPhotoCounts = {
    before: before.length,
    inProgress: inProgress.length,
    after: after.length,
    total: before.length + inProgress.length + after.length,
  };

  const sections: VisitReportChecklistSection[] = [];
  for (const section of input.checklist?.sections ?? []) {
    const items = section.items
      .filter((item) => (completedOnly ? isChecklistItemComplete(item) : true))
      .map((item) => ({
        label: item.label,
        status: item.status,
        note: item.note,
        notApplicable: item.notApplicable,
        photoCount: item.photoEntryIds?.length ?? 0,
      }));
    if (items.length > 0) sections.push({ title: section.title, items });
  }

  const progress = checklistProgress(input.checklist);
  const readings = extractReadings(input.checklist);

  return {
    service: input.service,
    date: input.date,
    photos: { before, inProgress, after },
    photoCounts,
    checklist: {
      sections,
      done: progress.done,
      total: progress.total,
      summaryLine: checklistSummaryLine(input.checklist),
    },
    ...(readings.length > 0 ? { readings } : {}),
  };
}

export interface VisitReportNotificationParts {
  /**
   * Template vars for the `visit_report` notification. `report.url` is added by
   * the caller (app-specific CTA), never here.
   */
  vars: {
    'report.photo_count': number;
    'report.checklist_summary': string;
  };
  /** Structured email detail rows (label/value), rendered outside the template. */
  details: { label: string; value: string }[];
}

/** Human phrase for a photo breakdown, e.g. "4 (2 before, 2 after)". */
function photoBreakdown(counts: VisitReportPhotoCounts): string {
  const parts: string[] = [];
  if (counts.before) parts.push(`${counts.before} before`);
  if (counts.inProgress) parts.push(`${counts.inProgress} in progress`);
  if (counts.after) parts.push(`${counts.after} after`);
  return parts.length ? `${counts.total} (${parts.join(', ')})` : '0';
}

/**
 * Derive the notification vars + email detail rows from an assembled report.
 * `checklistSummaryLine` is reused verbatim so SMS and email agree. The
 * summary omits an empty checklist entirely (`summaryLine` is '' then).
 */
export function visitReportNotification(report: VisitReport): VisitReportNotificationParts {
  const checklistSummary = report.checklist.summaryLine || 'no checklist on this visit';

  const details: { label: string; value: string }[] = [
    { label: 'Service', value: report.service },
    { label: 'Date', value: report.date },
    { label: 'Photos', value: photoBreakdown(report.photoCounts) },
  ];
  if (report.checklist.total > 0) {
    details.push({ label: 'Checklist', value: report.checklist.summaryLine });
    for (const section of report.checklist.sections) {
      details.push({
        label: section.title,
        value: section.items.map((i) => i.label).join(', '),
      });
    }
  }
  if (report.readings && report.readings.length > 0) {
    details.push({
      label: 'Readings',
      value: report.readings
        .map((r) => (r.unit ? `${r.label}: ${r.value} ${r.unit}` : `${r.label}: ${r.value}`))
        .join('; '),
    });
  }

  return {
    vars: {
      'report.photo_count': report.photoCounts.total,
      'report.checklist_summary': checklistSummary,
    },
    details,
  };
}
