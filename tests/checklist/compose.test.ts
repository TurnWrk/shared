import { describe, expect, it } from 'vitest';
import {
  composeWorkOrderChecklist,
  CUSTOM_CHECKLIST_SECTION_ID,
} from '../../src/checklist/compose';
import type { ChecklistTemplateSection } from '../../src/types/checklist';

const kitchen: ChecklistTemplateSection = {
  id: 'kitchen',
  title: 'Kitchen',
  items: [{ id: 'towels', label: 'Fresh towels', inputType: 'checkbox' }],
};

describe('composeWorkOrderChecklist', () => {
  it('returns undefined when there is no template and no custom items', () => {
    expect(composeWorkOrderChecklist()).toBeUndefined();
    expect(composeWorkOrderChecklist({ customItems: [{ label: '   ' }] })).toBeUndefined();
  });

  it('seeds only from a template when no custom items are provided', () => {
    const checklist = composeWorkOrderChecklist({
      templateSections: [kitchen],
      templateId: 'tpl-1',
      seededAt: 42,
    });
    expect(checklist?.sections).toHaveLength(1);
    expect(checklist?.sections[0].title).toBe('Kitchen');
    expect(checklist?.templateId).toBe('tpl-1');
    expect(checklist?.seededAt).toBe(42);
  });

  it('builds a custom-only checklist without a template', () => {
    const checklist = composeWorkOrderChecklist({
      customItems: [
        { label: 'Anniversary setup', required: true },
        { label: 'Extra pillows' },
      ],
      seededAt: 99,
    });
    expect(checklist?.sections).toHaveLength(1);
    expect(checklist?.sections[0].id).toBe(CUSTOM_CHECKLIST_SECTION_ID);
    expect(checklist?.sections[0].items.map((i) => i.label)).toEqual([
      'Anniversary setup',
      'Extra pillows',
    ]);
    expect(checklist?.sections[0].items[0].required).toBe(true);
    expect(checklist?.seededAt).toBe(99);
  });

  it('appends stay-specific items after template sections without mutating the template shape', () => {
    const checklist = composeWorkOrderChecklist({
      templateSections: [kitchen],
      customItems: [{ label: 'Welcome basket' }],
    });
    expect(checklist?.sections.map((s) => s.title)).toEqual(['Kitchen', 'Stay-specific']);
    expect(checklist?.sections[1].items[0].id).toBe(`${CUSTOM_CHECKLIST_SECTION_ID}.custom-1`);
  });
});
