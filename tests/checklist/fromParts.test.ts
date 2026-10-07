/**
 * `buildWorkOrderChecklistFromParts` — moved here from dispatch
 * (lib/dispatch/checklistCompose.ts) by TURNWRK-737 so cortex's auto-accept
 * composes the same checklist a human Accept does.
 */
import { describe, expect, it } from 'vitest';
import { buildWorkOrderChecklistFromParts } from '../../src/checklist';

const template = {
  id: 'tpl-guest',
  name: 'Guest baseline',
  sections: [
    {
      id: 'amenities',
      title: 'Amenities',
      items: [{ id: 'wifi', label: 'Wi-Fi check', inputType: 'checkbox' as const }],
    },
  ],
};

describe('buildWorkOrderChecklistFromParts', () => {
  it('composes template sections with stay-specific items', () => {
    const checklist = buildWorkOrderChecklistFromParts({
      workOrder: {
        type: 'GuestExperience',
        checklistTemplateId: 'tpl-guest',
        checklistCustomItems: [{ label: 'Anniversary setup' }],
      },
      org: null,
      templates: [template],
      property: null,
      now: 1,
    });
    expect(checklist?.sections.map((s) => s.title)).toEqual(['Amenities', 'Stay-specific']);
    expect(checklist?.sections[1].items[0].label).toBe('Anniversary setup');
  });

  it('supports custom-only checklists when no template resolves', () => {
    const checklist = buildWorkOrderChecklistFromParts({
      workOrder: { type: 'GuestExperience', checklistCustomItems: [{ label: 'Extra crib' }] },
      org: null,
      templates: [],
      property: null,
    });
    expect(checklist?.sections).toHaveLength(1);
    expect(checklist?.sections[0].items[0].label).toBe('Extra crib');
  });

  it("falls back to the org's per-type default, and '' means explicitly none", () => {
    const org = { cmms: { checklistDefaults: { Repair: 'tpl-guest' } } };
    const parts = { org, templates: [template], property: null, now: 1 };
    expect(buildWorkOrderChecklistFromParts({ ...parts, workOrder: { type: 'Repair' } })?.templateId).toBe('tpl-guest');
    expect(buildWorkOrderChecklistFromParts({ ...parts, workOrder: { type: 'Repair', checklistTemplateId: '' } })).toBeUndefined();
  });
});
