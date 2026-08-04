/**
 * Compose a per-job checklist from an optional template plus stay-specific items.
 *
 * Templates are read once and copied into the work-order instance — custom items
 * never write back to cmms_pmTemplates.
 */

import type {
  ChecklistInputType,
  ChecklistTemplateSection,
  WorkOrderChecklist,
} from '../types/checklist';
import { type SeedChecklistOptions, seedChecklistFromTemplate } from './seed';

export interface ChecklistCustomItemInput {
  label: string;
  inputType?: ChecklistInputType;
  required?: boolean;
}

export const CUSTOM_CHECKLIST_SECTION_ID = 'stay-specific';
export const CUSTOM_CHECKLIST_SECTION_TITLE = 'Stay-specific';

export interface ComposeWorkOrderChecklistOptions extends SeedChecklistOptions {
  templateSections?: ChecklistTemplateSection[];
  customItems?: ChecklistCustomItemInput[];
  customSectionTitle?: string;
}

function normalizedCustomItems(items: ChecklistCustomItemInput[] | undefined): ChecklistCustomItemInput[] {
  if (!items) return [];
  return items
    .map((item) => ({ ...item, label: item.label.trim() }))
    .filter((item) => item.label.length > 0);
}

/**
 * Materialize a checklist instance from template sections and/or custom items.
 * Returns undefined when neither source yields content.
 */
export function composeWorkOrderChecklist(
  opts: ComposeWorkOrderChecklistOptions = {},
): WorkOrderChecklist | undefined {
  const templateSections = opts.templateSections?.filter((s) => s.items.length > 0) ?? [];
  const customItems = normalizedCustomItems(opts.customItems);
  const hasTemplate = templateSections.length > 0;

  if (!hasTemplate && customItems.length === 0) return undefined;

  const checklist: WorkOrderChecklist = hasTemplate
    ? seedChecklistFromTemplate(templateSections, opts)
    : {
        ...(opts.templateId !== undefined ? { templateId: opts.templateId } : {}),
        ...(opts.templateName !== undefined ? { templateName: opts.templateName } : {}),
        seededAt: opts.seededAt ?? Date.now(),
        sections: [],
      };

  if (customItems.length === 0) return checklist;

  const sectionId = CUSTOM_CHECKLIST_SECTION_ID;
  const sectionTitle = opts.customSectionTitle ?? CUSTOM_CHECKLIST_SECTION_TITLE;
  checklist.sections.push({
    id: sectionId,
    title: sectionTitle,
    items: customItems.map((item, index) => ({
      id: `${sectionId}.custom-${index + 1}`,
      label: item.label,
      inputType: item.inputType ?? 'checkbox',
      ...(item.required !== undefined ? { required: item.required } : {}),
    })),
  });

  return checklist;
}
