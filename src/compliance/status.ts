import { addDaysToDate } from '../clean/orgTime';
import type { ComplianceItem, ComplianceStatus } from './types';

type StatusInput = Pick<
  ComplianceItem,
  | 'identifier'
  | 'issuedOn'
  | 'expiresOn'
  | 'nextDueDate'
  | 'leadDays'
  | 'lastCompletedAt'
  | 'documents'
>;

/**
 * The date the item next needs action: the earlier of its expiry and its next
 * scheduled check or filing. Undefined when the item has neither.
 */
export function complianceDueDate(
  item: Pick<ComplianceItem, 'expiresOn' | 'nextDueDate'>,
): string | undefined {
  const { expiresOn, nextDueDate } = item;
  if (expiresOn && nextDueDate) return expiresOn < nextDueDate ? expiresOn : nextDueDate;
  return expiresOn || nextDueDate || undefined;
}

/**
 * Derived compliance status, never stored. `today` is the org-local
 * YYYY-MM-DD (`todayYmdInTz(org.timezone)`).
 *
 * - `missing`: no due date and nothing on file (no identifier, issue date,
 *   completion or document): the operator has not entered it yet.
 * - `overdue`: today is after the due date. The due date itself is not late.
 * - `due_soon`: today is within `leadDays` of the due date, inclusive.
 * - `current`: otherwise, including a one-time item on file with no due date.
 */
export function complianceStatus(item: StatusInput, today: string): ComplianceStatus {
  const due = complianceDueDate(item);
  if (!due) {
    const onFile =
      !!item.identifier ||
      !!item.issuedOn ||
      typeof item.lastCompletedAt === 'number' ||
      item.documents.length > 0;
    return onFile ? 'current' : 'missing';
  }
  if (today > due) return 'overdue';
  if (today >= addDaysToDate(due, -Math.max(0, item.leadDays))) return 'due_soon';
  return 'current';
}
