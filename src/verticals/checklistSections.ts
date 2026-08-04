/**
 * Resolve checklist sections for a pack service — primary template plus any
 * extension-gated templates the pack opts into. No trade-specific branching:
 * the pack's `extensions` array is the only gate.
 */
import type { ChecklistTemplateSection } from '../types/checklist';
import type { VerticalPack } from './types';

export function resolvePackChecklistSections(
  pack: VerticalPack,
  primaryKey: string,
): ChecklistTemplateSection[] {
  const primary = pack.checklistTemplates.find((t) => t.key === primaryKey);
  if (!primary) return [];

  const sections: ChecklistTemplateSection[] = [...primary.sections];

  for (const template of pack.checklistTemplates) {
    if (template.key === primaryKey) continue;
    const ext = template.requiresExtension;
    if (ext && pack.extensions.includes(ext)) {
      sections.push(...template.sections);
    }
  }

  return sections;
}
