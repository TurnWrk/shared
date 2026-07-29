import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REPEAT_SOURCES,
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

describe('pack-provided repeatSources (TURNWRK-317)', () => {
  const bath: ChecklistTemplateSection = {
    id: 'bath',
    title: 'Bathroom',
    repeatPerParamLabel: 'Full Baths',
    items: [],
  };
  const bay: ChecklistTemplateSection = {
    id: 'bay',
    title: 'Bay',
    repeatPerParamLabel: 'Service Bays',
    items: [],
  };

  it('defaults to the legacy bed/bath pair when no pack passes sources', () => {
    // Un-migrated callers (dispatch PM generation, the Cloud Functions mirror)
    // must be byte-identical to pre-flip behaviour.
    expect(DEFAULT_REPEAT_SOURCES).toEqual(['bed', 'bath']);
    expect(resolveRepeatCount(bath, { propertyCounts: { baths: 3 } })).toBe(3);
  });

  it('accepts both the bare source and its plural as the count key', () => {
    expect(resolveRepeatCount(bath, { propertyCounts: { baths: 3 }, repeatSources: ['bath'] })).toBe(3);
    expect(resolveRepeatCount(bath, { propertyCounts: { bath: 3 }, repeatSources: ['bath'] })).toBe(3);
  });

  it('lets a vertical declare its own countable', () => {
    expect(
      resolveRepeatCount(bay, { propertyCounts: { bays: 4 }, repeatSources: ['bay'] }),
    ).toBe(4);
  });

  it('degrades to one copy when no declared source matches the label', () => {
    expect(
      resolveRepeatCount(bath, { propertyCounts: { baths: 3 }, repeatSources: ['bay'] }),
    ).toBe(1);
  });

  it('degrades to one copy when the source matches but no count is supplied', () => {
    expect(resolveRepeatCount(bath, { propertyCounts: {}, repeatSources: ['bath'] })).toBe(1);
  });

  it('still prefers a matching booking param over any declared source', () => {
    expect(
      resolveRepeatCount(bath, {
        paramsSnapshot: [{ label: 'Full Baths', qty: 2 }],
        propertyCounts: { baths: 9 },
        repeatSources: ['bath'],
      }),
    ).toBe(2);
  });

  it('honours source order when a label mentions two of them', () => {
    const both: ChecklistTemplateSection = {
      id: 'both',
      title: 'Bed and bath',
      repeatPerParamLabel: 'Bed & bath combo',
      items: [],
    };
    expect(
      resolveRepeatCount(both, {
        propertyCounts: { beds: 2, baths: 5 },
        repeatSources: ['bath', 'bed'],
      }),
    ).toBe(5);
  });

  it('clamps a count coming from a declared source', () => {
    expect(
      resolveRepeatCount(bath, { propertyCounts: { baths: 400 }, repeatSources: ['bath'] }),
    ).toBe(MAX_SECTION_REPEAT);
  });

  it('seeds whole checklists off a declared source', () => {
    const checklist = seedChecklistFromTemplate([bay], {
      propertyCounts: { bays: 3 },
      repeatSources: ['bay'],
      seededAt: 1,
    });
    expect(checklist.sections.map((s) => s.title)).toEqual(['Bay 1', 'Bay 2', 'Bay 3']);
  });
});
