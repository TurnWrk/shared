/**
 * Pure checklist completion/progress logic shared by the vendor UI
 * (ChecklistPanel, WorkDock soft warning, TaskCard progress), dispatch views,
 * and clean. Single source of truth for "what counts as complete/required".
 */

import type { ChecklistItem, WorkOrderChecklist } from '../types/checklist';

/**
 * Required = explicitly flagged, or an inherently mandatory input type.
 * N/A-with-note is the escape hatch; required items feed the soft finish
 * warning (never a hard block — product decision 2026-07-23).
 */
export function isChecklistItemRequired(item: ChecklistItem): boolean {
  return (
    item.required === true ||
    item.inputType === 'checkbox-mandatory' ||
    item.inputType === 'photo-required'
  );
}

export function isChecklistItemComplete(item: ChecklistItem): boolean {
  if (item.notApplicable === true) return true;
  const hasPhoto = (item.photoEntryIds?.length ?? 0) > 0;
  switch (item.inputType) {
    case 'photo-required':
    case 'photo-location':
      return hasPhoto;
    case 'yes-no-photo':
      // Answered either way counts — a Fail is an addressed item that flags an issue.
      return item.status === 'Pass' || item.status === 'Fail' || item.done === true;
    default: {
      const answered = item.done === true || item.status === 'Pass' || item.status === 'Fail';
      return item.photoRequired === true ? answered && hasPhoto : answered;
    }
  }
}

export interface ChecklistProgress {
  done: number;
  total: number;
  requiredRemaining: number;
  /** Ids of incomplete required items, checklist order (first = scroll target). */
  requiredRemainingIds: string[];
}

export function checklistProgress(checklist: WorkOrderChecklist | undefined): ChecklistProgress {
  const progress: ChecklistProgress = { done: 0, total: 0, requiredRemaining: 0, requiredRemainingIds: [] };
  if (!checklist) return progress;
  for (const section of checklist.sections) {
    for (const item of section.items) {
      progress.total += 1;
      if (isChecklistItemComplete(item)) {
        progress.done += 1;
      } else if (isChecklistItemRequired(item)) {
        progress.requiredRemaining += 1;
        progress.requiredRemainingIds.push(item.id);
      }
    }
  }
  return progress;
}

export function countRequiredRemaining(checklist: WorkOrderChecklist | undefined): number {
  return checklistProgress(checklist).requiredRemaining;
}

/** One-line summary for wrap-up notes: "22/24 complete · 1 issue logged". */
export function checklistSummaryLine(checklist: WorkOrderChecklist | undefined): string {
  if (!checklist) return '';
  const p = checklistProgress(checklist);
  const issues = checklist.sections.reduce(
    (n, s) => n + s.items.filter((i) => i.issueWoId).length,
    0,
  );
  const issuePart = issues > 0 ? ` · ${issues} issue${issues === 1 ? '' : 's'} logged` : '';
  return `Checklist ${p.done}/${p.total} complete${issuePart}`;
}
