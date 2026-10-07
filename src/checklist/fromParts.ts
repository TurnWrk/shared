/**
 * Server-side checklist composition for a new work order: pick the template
 * (explicit `checklistTemplateId`, else the org's per-type default), then
 * compose it with any stay-specific items. Pure over already-loaded parts, so
 * every work-order writer — dispatch's API routes and Accept, cortex's
 * auto-accept — composes the same checklist from the same inputs.
 */
import type { ChecklistInputType, ChecklistTemplateSection, WorkOrderChecklist } from '../types/checklist';
import { composeWorkOrderChecklist, type ChecklistCustomItemInput } from './compose';
import { templateSections } from './seed';

/** The slice of a `cmms_pmTemplates` doc composition reads. */
export interface ChecklistTemplatePart {
  id: string;
  name?: string;
  sections?: ChecklistTemplateSection[];
  checklistItems?: Array<{ id: string; label: string; inputType: ChecklistInputType }>;
}

export interface WorkOrderChecklistParts {
  workOrder: {
    type: string;
    /** `''` means explicitly no checklist; undefined falls back to the org default. */
    checklistTemplateId?: string;
    checklistCustomItems?: ChecklistCustomItemInput[];
  };
  org: { cmms?: { checklistDefaults?: Record<string, string> } } | null | undefined;
  templates: ChecklistTemplatePart[];
  property: { supply?: { beds?: number; baths?: number } } | null | undefined;
  now?: number;
}

export function buildWorkOrderChecklistFromParts(args: WorkOrderChecklistParts): WorkOrderChecklist | undefined {
  const templateId = args.workOrder.checklistTemplateId !== undefined
    ? (args.workOrder.checklistTemplateId || undefined)
    : args.org?.cmms?.checklistDefaults?.[args.workOrder.type];

  const template = templateId ? args.templates.find((t) => t.id === templateId) : undefined;
  const sections = template ? templateSections(template) : [];

  return composeWorkOrderChecklist({
    templateSections: sections,
    customItems: args.workOrder.checklistCustomItems,
    ...(templateId ? { templateId } : {}),
    ...(template?.name ? { templateName: template.name } : {}),
    propertyCounts: {
      beds: args.property?.supply?.beds,
      baths: args.property?.supply?.baths,
    },
    ...(args.now !== undefined ? { seededAt: args.now } : {}),
  });
}
