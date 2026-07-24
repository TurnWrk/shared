import { describe, expect, it } from 'vitest';
import {
  checklistProgress,
  checklistSummaryLine,
  countRequiredRemaining,
  isChecklistItemComplete,
  isChecklistItemRequired,
} from '../../src/checklist/progress';
import type { ChecklistItem, WorkOrderChecklist } from '../../src/types/checklist';

const item = (overrides: Partial<ChecklistItem>): ChecklistItem => ({
  id: 'sec.item',
  label: 'Item',
  inputType: 'checkbox',
  ...overrides,
});

describe('isChecklistItemRequired', () => {
  it('honors the explicit flag and inherently mandatory input types', () => {
    expect(isChecklistItemRequired(item({ required: true }))).toBe(true);
    expect(isChecklistItemRequired(item({ inputType: 'checkbox-mandatory' }))).toBe(true);
    expect(isChecklistItemRequired(item({ inputType: 'photo-required' }))).toBe(true);
    expect(isChecklistItemRequired(item({}))).toBe(false);
  });
});

describe('isChecklistItemComplete', () => {
  it('treats N/A as complete regardless of type', () => {
    expect(isChecklistItemComplete(item({ inputType: 'photo-required', notApplicable: true }))).toBe(true);
  });

  it('photo types complete only with a photo reference', () => {
    expect(isChecklistItemComplete(item({ inputType: 'photo-required', done: true }))).toBe(false);
    expect(
      isChecklistItemComplete(item({ inputType: 'photo-required', photoEntryIds: ['t1'] })),
    ).toBe(true);
  });

  it('checkbox completes on done or an answered Pass/Fail status', () => {
    expect(isChecklistItemComplete(item({ done: true }))).toBe(true);
    expect(isChecklistItemComplete(item({ status: 'Fail' }))).toBe(true);
    expect(isChecklistItemComplete(item({}))).toBe(false);
  });

  it('photoRequired flag on a checkbox needs both the answer and a photo', () => {
    expect(isChecklistItemComplete(item({ photoRequired: true, done: true }))).toBe(false);
    expect(
      isChecklistItemComplete(item({ photoRequired: true, done: true, photoEntryIds: ['t1'] })),
    ).toBe(true);
  });

  it('yes-no-photo completes once answered', () => {
    expect(isChecklistItemComplete(item({ inputType: 'yes-no-photo', status: 'Pass' }))).toBe(true);
    expect(isChecklistItemComplete(item({ inputType: 'yes-no-photo' }))).toBe(false);
  });
});

const checklist: WorkOrderChecklist = {
  seededAt: 1,
  sections: [
    {
      id: 'kitchen',
      title: 'Kitchen',
      items: [
        item({ id: 'kitchen.counters', required: true, done: true }),
        item({ id: 'kitchen.photo', inputType: 'photo-required' }),
        item({ id: 'kitchen.optional' }),
      ],
    },
    {
      id: 'bedroom-1',
      title: 'Bedroom 1',
      items: [item({ id: 'bedroom-1.linens', required: true, issueWoId: 'wo-9' })],
    },
  ],
};

describe('checklistProgress', () => {
  it('counts done/total and lists incomplete required item ids in order', () => {
    const p = checklistProgress(checklist);
    expect(p.total).toBe(4);
    expect(p.done).toBe(1);
    expect(p.requiredRemaining).toBe(2);
    expect(p.requiredRemainingIds).toEqual(['kitchen.photo', 'bedroom-1.linens']);
  });

  it('is zeroed for missing checklists', () => {
    expect(checklistProgress(undefined)).toEqual({
      done: 0,
      total: 0,
      requiredRemaining: 0,
      requiredRemainingIds: [],
    });
    expect(countRequiredRemaining(undefined)).toBe(0);
  });
});

describe('checklistSummaryLine', () => {
  it('summarizes completion and logged issues', () => {
    expect(checklistSummaryLine(checklist)).toBe('Checklist 1/4 complete · 1 issue logged');
  });

  it('is empty without a checklist', () => {
    expect(checklistSummaryLine(undefined)).toBe('');
  });
});
