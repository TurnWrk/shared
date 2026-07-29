import { describe, expect, it } from 'vitest';
import {
  assembleVisitReport,
  visitReportNotification,
  type AssembleVisitReportInput,
} from '../../src/proof/visitReport';
import type { VisitReportPhoto } from '../../src/proof/types';
import type { ChecklistItem, WorkOrderChecklist } from '../../src/types/checklist';

const photo = (overrides: Partial<VisitReportPhoto>): VisitReportPhoto => ({
  kind: 'after',
  url: 'https://cdn.example.com/p.jpg',
  ...overrides,
});

const item = (overrides: Partial<ChecklistItem>): ChecklistItem => ({
  id: 'sec.item',
  label: 'Item',
  inputType: 'checkbox',
  ...overrides,
});

const checklist = (sections: WorkOrderChecklist['sections']): WorkOrderChecklist => ({
  seededAt: 1,
  sections,
});

const base: AssembleVisitReportInput = { service: 'Weekly Pool Service', date: '2026-08-01', photos: [] };

describe('assembleVisitReport — photos', () => {
  it('partitions photos by kind and sorts each group by timestamp ascending', () => {
    const report = assembleVisitReport({
      ...base,
      photos: [
        photo({ kind: 'after', url: 'a2', timestamp: 200 }),
        photo({ kind: 'before', url: 'b1', timestamp: 10 }),
        photo({ kind: 'after', url: 'a1', timestamp: 100 }),
        photo({ kind: 'in_progress', url: 'ip1', timestamp: 50 }),
      ],
    });
    expect(report.photos.before.map((p) => p.url)).toEqual(['b1']);
    expect(report.photos.after.map((p) => p.url)).toEqual(['a1', 'a2']);
    expect(report.photos.inProgress.map((p) => p.url)).toEqual(['ip1']);
    expect(report.photoCounts).toEqual({ before: 1, inProgress: 1, after: 2, total: 4 });
  });

  it('keeps timestamp-less photos after timestamped ones without throwing', () => {
    const report = assembleVisitReport({
      ...base,
      photos: [photo({ url: 'x' }), photo({ url: 'y', timestamp: 5 })],
    });
    expect(report.photos.after.map((p) => p.url)).toEqual(['y', 'x']);
  });
});

describe('assembleVisitReport — checklist', () => {
  const mixed = checklist([
    {
      id: 's1',
      title: 'Skimmer',
      items: [
        item({ id: 's1.a', label: 'Empty baskets', done: true }),
        item({ id: 's1.b', label: 'Brush walls' }), // incomplete
      ],
    },
    {
      id: 's2',
      title: 'Chemistry',
      items: [item({ id: 's2.a', label: 'Log pH', done: true, note: '7.4' })],
    },
  ]);

  it('lists only completed items by default and drops emptied sections', () => {
    const report = assembleVisitReport({ ...base, checklist: mixed });
    expect(report.checklist.sections.map((s) => s.title)).toEqual(['Skimmer', 'Chemistry']);
    expect(report.checklist.sections[0].items.map((i) => i.label)).toEqual(['Empty baskets']);
    // done/total count the WHOLE checklist, not just what's listed.
    expect(report.checklist.done).toBe(2);
    expect(report.checklist.total).toBe(3);
    expect(report.checklist.summaryLine).toBe('Checklist 2/3 complete');
  });

  it('drops a section entirely when none of its items are complete', () => {
    const report = assembleVisitReport({
      ...base,
      checklist: checklist([
        { id: 's1', title: 'All pending', items: [item({ id: 's1.a', label: 'todo' })] },
      ]),
    });
    expect(report.checklist.sections).toEqual([]);
    expect(report.checklist.done).toBe(0);
    expect(report.checklist.total).toBe(1);
  });

  it('includes incomplete items when completedOnly is false', () => {
    const report = assembleVisitReport({ ...base, checklist: mixed, completedOnly: false });
    expect(report.checklist.sections[0].items.map((i) => i.label)).toEqual([
      'Empty baskets',
      'Brush walls',
    ]);
  });

  it('carries item note, status, notApplicable and photoCount through', () => {
    const report = assembleVisitReport({
      ...base,
      checklist: checklist([
        {
          id: 's1',
          title: 'Detail',
          items: [
            item({
              id: 's1.a',
              label: 'Photo the deck',
              inputType: 'photo-required',
              photoEntryIds: ['t1', 't2'],
              status: 'Pass',
              note: 'looks great',
            }),
          ],
        },
      ]),
    });
    expect(report.checklist.sections[0].items[0]).toEqual({
      label: 'Photo the deck',
      status: 'Pass',
      note: 'looks great',
      notApplicable: undefined,
      photoCount: 2,
    });
  });

  it('handles a missing checklist as an empty report', () => {
    const report = assembleVisitReport(base);
    expect(report.checklist).toEqual({ sections: [], done: 0, total: 0, summaryLine: '' });
  });
});

describe('visitReportNotification', () => {
  it('summarizes photos and checklist into vars + detail rows', () => {
    const report = assembleVisitReport({
      ...base,
      photos: [photo({ kind: 'before', timestamp: 1 }), photo({ kind: 'after', timestamp: 2 })],
      checklist: checklist([
        { id: 's1', title: 'Skimmer', items: [item({ id: 's1.a', label: 'Empty baskets', done: true })] },
      ]),
    });
    const parts = visitReportNotification(report);
    expect(parts.vars['report.photo_count']).toBe(2);
    expect(parts.vars['report.checklist_summary']).toBe('Checklist 1/1 complete');
    expect(parts.details).toEqual([
      { label: 'Service', value: 'Weekly Pool Service' },
      { label: 'Date', value: '2026-08-01' },
      { label: 'Photos', value: '2 (1 before, 1 after)' },
      { label: 'Checklist', value: 'Checklist 1/1 complete' },
      { label: 'Skimmer', value: 'Empty baskets' },
    ]);
  });

  it('falls back to a friendly phrase when there is no checklist', () => {
    const parts = visitReportNotification(assembleVisitReport(base));
    expect(parts.vars['report.checklist_summary']).toBe('no checklist on this visit');
    expect(parts.vars['report.photo_count']).toBe(0);
    // No checklist rows when the checklist is empty.
    expect(parts.details.map((d) => d.label)).toEqual(['Service', 'Date', 'Photos']);
    expect(parts.details[2].value).toBe('0');
  });
});
