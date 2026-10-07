/**
 * TURNWRK-737 — the Accept work-order builder, shared by a human Accept and a
 * rule's auto-accept (moved from dispatch lib/intake/triage.ts).
 */
import { describe, expect, it } from 'vitest';
import {
  AUTO_ACCEPT_TRIAGED_BY,
  INTAKE_DECIDED_TTL_MS,
  acceptedDrafts,
  autoAcceptedItemFields,
  buildAcceptedWorkOrders,
  normalizeIntakeItem,
} from '../../src/intake';

const item = (over: Record<string, unknown> = {}) =>
  normalizeIntakeItem(
    {
      orgId: 'org-1',
      propertyId: 'prop-1',
      source: 'vendor_sms',
      reporter: { kind: 'cleaner', id: 'cl-1' },
      text: 'Kitchen faucet leaking\nunder the sink too',
      status: 'completed',
      triage: 'pending',
      drafts: [
        { title: 'Fix faucet', description: 'Leak', priority: 'Medium', estimatedHours: 1, type: 'Repair' },
        { title: 'Check sink', description: 'Under sink', priority: 'Low', estimatedHours: 2, type: 'Repair' },
      ],
      ...over,
    },
    'intake-1',
  );

describe('acceptedDrafts', () => {
  it('uses the drafts when there are any', () => {
    expect(acceptedDrafts(item())).toHaveLength(2);
  });

  it('turns an undrafted report into one work order from its first line', () => {
    expect(acceptedDrafts(item({ drafts: undefined, ai: { category: 'x', priority: 'High' } }))).toEqual([
      {
        title: 'Kitchen faucet leaking',
        description: 'Kitchen faucet leaking\nunder the sink too',
        priority: 'High',
        estimatedHours: 1,
        type: 'Repair',
      },
    ]);
  });
});

describe('buildAcceptedWorkOrders', () => {
  it('writes deterministic ids and Backlog work orders when no date is asked for', () => {
    const built = buildAcceptedWorkOrders('intake-1', item(), { now: 7 });
    expect(built.map((b) => b.id)).toEqual(['wo_intake-1_0', 'wo_intake-1_1']);
    expect(built[0].payload).toMatchObject({
      orgId: 'org-1',
      propertyId: 'prop-1',
      title: 'Fix faucet',
      priority: 'Medium',
      status: 'Backlog',
      source: 'manual',
      scheduledDate: '',
      notes: '',
      aiIntakeId: 'intake-1',
      createdAt: 7,
    });
    expect(built[0].hint).toBeUndefined();
    expect('assignedTechId' in built[0].payload).toBe(false);
    expect('checklist' in built[0].payload).toBe(false);
  });

  it("applies the rule's priority and assignee, and carries notes", () => {
    const built = buildAcceptedWorkOrders('intake-1', item(), {
      now: 7,
      rule: { then: { autoAccept: true, priority: 'High', assigneeId: 'tech-9' } },
      notes: 'SMS from Dana: faucet',
    });
    for (const wo of built) {
      expect(wo.payload).toMatchObject({ priority: 'High', assignedTechId: 'tech-9', notes: 'SMS from Dana: faucet' });
    }
  });

  it('keeps an emergency High whatever the rule says', () => {
    const built = buildAcceptedWorkOrders('intake-1', item({ emergency: true }), {
      now: 7,
      rule: { then: { autoAccept: true, priority: 'Low' } },
    });
    expect(built[0].payload).toMatchObject({ priority: 'High', isEmergency: true });
  });

  it('schedules through the injected resolver and reports the hint', () => {
    const built = buildAcceptedWorkOrders('intake-1', item(), {
      now: 7,
      scheduledDate: '2026-10-10',
      resolveDate: () => ({ dateStr: '2026-10-12', advanced: true }),
    });
    expect(built[0].payload).toMatchObject({ status: 'Scheduled', scheduledDate: '2026-10-12' });
    expect(built[0].hint).toEqual({
      workOrderId: 'wo_intake-1_0',
      requestedDate: '2026-10-10',
      scheduledDate: '2026-10-12',
      advanced: true,
    });
  });

  it("composes the org's default checklist when parts are given", () => {
    const built = buildAcceptedWorkOrders('intake-1', item(), {
      now: 7,
      checklist: {
        org: { cmms: { checklistDefaults: { Repair: 'tpl' } } },
        templates: [{ id: 'tpl', name: 'Repair', sections: [{ id: 's', title: 'S', items: [{ id: 'i', label: 'Photo', inputType: 'checkbox' }] }] }],
        property: null,
      },
    });
    expect((built[0].payload.checklist as { templateId?: string }).templateId).toBe('tpl');
  });
});

describe('autoAcceptedItemFields', () => {
  it('stamps the rule, the system decider and the decided TTL', () => {
    expect(autoAcceptedItemFields({ id: 'default-vendor-sms' }, ['wo_a_0'], 100)).toEqual({
      triage: 'accepted',
      triagedBy: AUTO_ACCEPT_TRIAGED_BY,
      triagedAt: 100,
      autoAcceptedByRuleId: 'default-vendor-sms',
      workOrderIds: ['wo_a_0'],
      expireAt: 100 + INTAKE_DECIDED_TTL_MS,
    });
  });
});
