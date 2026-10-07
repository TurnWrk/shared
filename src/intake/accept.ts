/**
 * What accepting an inbox item writes. Pure; the caller owns the transaction.
 *
 * A human Accept (dispatch's triage route) and a rule's auto-accept (dispatch's
 * `createIntakeItem`, cortex's vendor SMS pipeline) build their work orders
 * here, so an auto-accepted item yields exactly the work orders a human Accept
 * of the same item would. Work order ids are deterministic
 * (`wo_<intakeId>_<i>`) and written with `create()`, so a second accept of the
 * same item collides instead of doubling.
 */
import type { WOPriority } from '../types/workOrder';
import type { IntakeItem, WoIntakeDraft } from '../types/woIntake';
import { buildWorkOrderChecklistFromParts, type WorkOrderChecklistParts } from '../checklist/fromParts';
import type { IntakeRule } from './rules';

/** A decided item keeps the retention a completed intake always had. */
export const INTAKE_DECIDED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** `triagedBy` on an item a rule accepted; the rule itself is `autoAcceptedByRuleId`. */
export const AUTO_ACCEPT_TRIAGED_BY = 'system:intake-rule';

export interface SchedulingHint {
  workOrderId: string;
  requestedDate: string;
  scheduledDate: string;
  /** True when a guest holds the unit on `requestedDate` and the work order cannot go into it. */
  advanced: boolean;
}

export function acceptedWorkOrderId(intakeId: string, index: number): string {
  return `wo_${intakeId}_${index}`;
}

/**
 * The drafts to turn into work orders. A report the AI could not split (a
 * dead-lettered guest report, an inspection finding) still becomes one work
 * order from its text.
 */
export function acceptedDrafts(item: Pick<IntakeItem, 'drafts' | 'text' | 'ai'>): WoIntakeDraft[] {
  if (item.drafts?.length) return item.drafts;
  const text = (item.text || '').trim();
  const firstLine = text.split('\n')[0].trim();
  return [
    {
      title: firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine || 'Reported issue',
      description: text,
      priority: item.ai?.priority ?? 'Medium',
      estimatedHours: 1,
      type: 'Repair',
    },
  ];
}

export interface AcceptBuildContext {
  now: number;
  /** Org-local `YYYY-MM-DD` the triager asked for; absent leaves the work in Backlog. */
  scheduledDate?: string;
  /**
   * Occupancy-aware date resolution for `scheduledDate` (dispatch passes
   * `resolveSchedulableDate` over the property's active bookings). Absent
   * keeps the requested date as is.
   */
  resolveDate?: (wo: { priority: WOPriority; isEmergency: boolean }, requestedDate: string) => {
    dateStr: string;
    advanced: boolean;
  };
  /** Loaded parts for checklist composition; absent writes no checklist. */
  checklist?: Omit<WorkOrderChecklistParts, 'workOrder' | 'now'>;
  /** The auto-accept rule, whose `then` overrides priority and assignee. */
  rule?: Pick<IntakeRule, 'then'>;
  /** Work-order notes; empty for a human Accept. */
  notes?: string;
}

export interface AcceptedWorkOrder {
  id: string;
  payload: Record<string, unknown>;
  hint?: SchedulingHint;
}

/** Build the work orders an Accept writes. Pure. */
export function buildAcceptedWorkOrders(
  intakeId: string,
  item: IntakeItem,
  ctx: AcceptBuildContext,
): AcceptedWorkOrder[] {
  return acceptedDrafts(item).map((draft, i) => {
    const id = acceptedWorkOrderId(intakeId, i);
    const priority: WOPriority = item.emergency ? 'High' : ctx.rule?.then.priority ?? draft.priority;
    let scheduledDate = '';
    let hint: SchedulingHint | undefined;
    if (ctx.scheduledDate) {
      const resolved = item.propertyId && ctx.resolveDate
        ? ctx.resolveDate({ priority, isEmergency: item.emergency }, ctx.scheduledDate)
        : { dateStr: ctx.scheduledDate, advanced: false };
      scheduledDate = resolved.dateStr;
      hint = { workOrderId: id, requestedDate: ctx.scheduledDate, scheduledDate, advanced: resolved.advanced };
    }

    const payload: Record<string, unknown> = {
      orgId: item.orgId,
      title: draft.title,
      description: draft.description,
      type: draft.type,
      priority,
      status: scheduledDate ? 'Scheduled' : 'Backlog',
      // 'manual', not 'system': the edit modal locks title/description/type on
      // system-sourced work orders, and these are the triager's to edit.
      source: 'manual',
      estimatedHours: draft.estimatedHours,
      scheduledDate,
      imagesBefore: item.mediaUrls ?? [],
      imagesAfter: [],
      notes: ctx.notes ?? '',
      aiIntakeId: intakeId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
    };
    if (item.propertyId) payload.propertyId = item.propertyId;
    if (item.customerId) payload.customerId = item.customerId;
    if (item.serviceAddress) payload.serviceAddress = item.serviceAddress;
    if (item.emergency) payload.isEmergency = true;
    if (ctx.rule?.then.assigneeId) payload.assignedTechId = ctx.rule.then.assigneeId;
    if (item.checklistTemplateId !== undefined) payload.checklistTemplateId = item.checklistTemplateId;
    if (item.checklistCustomItems?.length) payload.checklistCustomItems = item.checklistCustomItems;

    if (ctx.checklist) {
      const checklist = buildWorkOrderChecklistFromParts({
        ...ctx.checklist,
        workOrder: {
          type: draft.type,
          checklistTemplateId: item.checklistTemplateId,
          checklistCustomItems: item.checklistCustomItems,
        },
        now: ctx.now,
      });
      if (checklist) payload.checklist = checklist;
    }

    return { id, payload, ...(hint ? { hint } : {}) };
  });
}

/** The fields an auto-accept stamps on the item, beside the work orders it creates. */
export function autoAcceptedItemFields(
  rule: Pick<IntakeRule, 'id'>,
  workOrderIds: string[],
  now: number,
): Record<string, unknown> {
  return {
    triage: 'accepted',
    triagedBy: AUTO_ACCEPT_TRIAGED_BY,
    triagedAt: now,
    autoAcceptedByRuleId: rule.id,
    workOrderIds,
    expireAt: now + INTAKE_DECIDED_TTL_MS,
  };
}
