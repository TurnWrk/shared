import { describe, expect, it } from 'vitest';
import {
  MAX_SECTION_REPEAT,
  resolveRepeatCount,
  seedChecklistFromTemplate,
  templateSections,
} from '../../src/checklist/seed';
import type { ChecklistTemplateSection } from '../../src/types/checklist';

const kitchen: ChecklistTemplateSection = {
  id: 'kitchen',
  title: 'Kitchen',
  items: [
    { id: 'counters', label: 'Wipe counters', inputType: 'checkbox', required: true },
    { id: 'photo', label: 'Kitchen photo', inputType: 'photo-required' },
  ],
};

const bedroom: ChecklistTemplateSection = {
  id: 'bedroom',
  title: 'Bedroom',
  repeatPerParamLabel: 'Bedrooms',
  items: [{ id: 'linens', label: 'Fresh linens', inputType: 'checkbox', required: true }],
};

function deepScanForUndefined(value: unknown, path = '$'): string[] {
  if (value === undefined) return [path];
  if (Array.isArray(value)) return value.flatMap((v, i) => deepScanForUndefined(v, `${path}[${i}]`));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      deepScanForUndefined(v, `${path}.${k}`),
    );
  }
  return [];
}

describe('seedChecklistFromTemplate', () => {
  it('materializes sections and prefixes item ids with the section instance id', () => {
    const checklist = seedChecklistFromTemplate([kitchen], { seededAt: 123 });
    expect(checklist.seededAt).toBe(123);
    expect(checklist.sections).toHaveLength(1);
    expect(checklist.sections[0].id).toBe('kitchen');
    expect(checklist.sections[0].items.map((i) => i.id)).toEqual([
      'kitchen.counters',
      'kitchen.photo',
    ]);
  });

  it('multiplies repeat sections from paramsSnapshot qty with numbered titles/ids', () => {
    const checklist = seedChecklistFromTemplate([bedroom], {
      paramsSnapshot: [{ label: 'Bedrooms', qty: 3 }],
      seededAt: 1,
    });
    expect(checklist.sections.map((s) => s.title)).toEqual(['Bedroom 1', 'Bedroom 2', 'Bedroom 3']);
    expect(checklist.sections.map((s) => s.id)).toEqual(['bedroom-1', 'bedroom-2', 'bedroom-3']);
    expect(checklist.sections[2].items[0].id).toBe('bedroom-3.linens');
  });

  it('keeps a single un-suffixed copy when qty is 1', () => {
    const checklist = seedChecklistFromTemplate([bedroom], {
      paramsSnapshot: [{ label: 'Bedrooms', qty: 1 }],
      seededAt: 1,
    });
    expect(checklist.sections.map((s) => s.title)).toEqual(['Bedroom']);
    expect(checklist.sections[0].id).toBe('bedroom');
  });

  it('drops a repeat section when the matched qty is 0', () => {
    const checklist = seedChecklistFromTemplate([bedroom, kitchen], {
      paramsSnapshot: [{ label: 'Bedrooms', qty: 0 }],
      seededAt: 1,
    });
    expect(checklist.sections.map((s) => s.id)).toEqual(['kitchen']);
  });

  it('falls back to property beds/baths counts when no param matches', () => {
    const bath: ChecklistTemplateSection = {
      id: 'bath',
      title: 'Bathroom',
      repeatPerParamLabel: 'Full Baths',
      items: [],
    };
    const checklist = seedChecklistFromTemplate([bedroom, bath], {
      propertyCounts: { beds: 2, baths: 1 },
      seededAt: 1,
    });
    expect(checklist.sections.map((s) => s.title)).toEqual(['Bedroom 1', 'Bedroom 2', 'Bathroom']);
  });

  it('defaults to a single copy when neither params nor counts resolve', () => {
    expect(resolveRepeatCount(bedroom, {})).toBe(1);
  });

  it('clamps runaway quantities', () => {
    expect(
      resolveRepeatCount(bedroom, { paramsSnapshot: [{ label: 'Bedrooms', qty: 400 }] }),
    ).toBe(MAX_SECTION_REPEAT);
  });

  it('records template provenance and never emits undefined values', () => {
    const checklist = seedChecklistFromTemplate([kitchen, bedroom], {
      templateId: 'tpl-1',
      templateName: 'STR Turnover Clean',
      paramsSnapshot: [{ label: 'Bedrooms', qty: 2 }],
      seededAt: 42,
    });
    expect(checklist.templateId).toBe('tpl-1');
    expect(checklist.templateName).toBe('STR Turnover Clean');
    expect(deepScanForUndefined(checklist)).toEqual([]);
    // State fields are absent until touched, not present-as-undefined.
    expect('done' in checklist.sections[0].items[0]).toBe(false);
  });
});

describe('templateSections', () => {
  it('prefers sectioned templates', () => {
    const sections = templateSections({
      sections: [kitchen],
      checklistItems: [{ id: 'x', label: 'Legacy', inputType: 'checkbox' }],
    });
    expect(sections).toEqual([kitchen]);
  });

  it('wraps legacy flat checklistItems as one section', () => {
    const sections = templateSections({
      checklistItems: [{ id: 'x', label: 'Legacy', inputType: 'checkbox' }],
    });
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Checklist');
    expect(sections[0].items[0].label).toBe('Legacy');
  });

  it('returns empty for a template with neither', () => {
    expect(templateSections({})).toEqual([]);
  });
});
