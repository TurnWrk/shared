/**
 * Pure template → checklist-instance seeding. No firebase imports — runs in
 * Next server routes, Cloud Functions (mirrored copy in
 * dispatch/functions/src/checklistSeed.ts), and vitest.
 *
 * Firestore constraint: emitted objects must never carry `undefined` values —
 * optional fields are omitted, not set to undefined.
 */

import type {
  ChecklistInputType,
  ChecklistItem,
  ChecklistSection,
  ChecklistTemplateItem,
  ChecklistTemplateSection,
  WorkOrderChecklist,
} from '../types/checklist';

/** Minimal structural view of CleanParamSnapshot (label + qty is all we need). */
export interface ChecklistRepeatParam {
  paramId?: string;
  label?: string;
  qty: number;
}

/** Countables a section can repeat over. `beds`/`baths` are the historical keys. */
export type PropertyCounts = Record<string, number | undefined>;

/**
 * The bed/bath heuristic this module carried before packs existed. Kept as the
 * default so un-migrated callers are unchanged; pack-aware callers pass
 * `VerticalPack.repeatSources` instead. Remove once every caller resolves a
 * pack (phase C).
 */
export const DEFAULT_REPEAT_SOURCES: readonly string[] = ['bed', 'bath'];

export interface SeedChecklistOptions {
  templateId?: string;
  templateName?: string;
  /** Booking params ("Bedrooms" ×3) — primary repeat-count source. */
  paramsSnapshot?: ChecklistRepeatParam[];
  /**
   * Property counts — fallback when no booking params exist (turnovers).
   * Conventionally `beds` / `baths`; keyed openly so a vertical can supply its
   * own countable ("bays", "zones") alongside its `repeatSources`.
   */
  propertyCounts?: PropertyCounts;
  /**
   * Label substrings whose match lets a section repeat from `propertyCounts`
   * — `VerticalPack.repeatSources` (TURNWRK-317). Absent falls back to
   * DEFAULT_REPEAT_SOURCES so callers that do not yet resolve a pack (dispatch
   * PM generation, the Cloud Functions mirror) keep today's behaviour.
   */
  repeatSources?: readonly string[];
  /** Injectable for tests; defaults to Date.now(). */
  seededAt?: number;
}

/** Guard against template misconfiguration exploding a checklist. */
export const MAX_SECTION_REPEAT = 12;

const normalize = (s: string): string => s.trim().toLowerCase();

/**
 * How many copies of a template section to emit. Matching order:
 * 1. paramsSnapshot entry whose label or paramId matches `repeatPerParamLabel`
 * 2. a `repeatSources` entry the label mentions, resolved against propertyCounts
 * 3. 1 (single copy)
 * A matched qty of 0 drops the section entirely (return 0).
 *
 * Step 2 used to hardcode bed → `propertyCounts.beds` and bath → `.baths`
 * (TURNWRK-317). It now walks pack-provided sources in order, accepting both
 * the bare source and its plural as the count key so `['bed','bath']` still
 * reads today's `{ beds, baths }` callers unchanged.
 */
export function resolveRepeatCount(
  section: ChecklistTemplateSection,
  opts: Pick<SeedChecklistOptions, 'paramsSnapshot' | 'propertyCounts' | 'repeatSources'>,
): number {
  const label = section.repeatPerParamLabel;
  if (!label) return 1;
  const wanted = normalize(label);

  const param = opts.paramsSnapshot?.find(
    (p) =>
      (p.label !== undefined && normalize(p.label) === wanted) ||
      (p.paramId !== undefined && normalize(p.paramId) === wanted),
  );
  if (param) return clampRepeat(param.qty);

  const sources = opts.repeatSources ?? DEFAULT_REPEAT_SOURCES;
  for (const source of sources) {
    const key = normalize(source);
    if (!key || !wanted.includes(key)) continue;
    const count = opts.propertyCounts?.[key] ?? opts.propertyCounts?.[`${key}s`];
    if (typeof count === 'number') return clampRepeat(count);
  }
  return 1;
}

function clampRepeat(qty: number): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return Math.min(Math.floor(qty), MAX_SECTION_REPEAT);
}

function seedItem(sectionInstanceId: string, item: ChecklistTemplateItem): ChecklistItem {
  return {
    id: `${sectionInstanceId}.${item.id}`,
    label: item.label,
    inputType: item.inputType,
    ...(item.required !== undefined ? { required: item.required } : {}),
    ...(item.photoRequired !== undefined ? { photoRequired: item.photoRequired } : {}),
    ...(item.instructions !== undefined ? { instructions: item.instructions } : {}),
    ...(item.placeholder !== undefined ? { placeholder: item.placeholder } : {}),
    ...(item.suffix !== undefined ? { suffix: item.suffix } : {}),
    ...(item.minValue !== undefined ? { minValue: item.minValue } : {}),
    ...(item.maxValue !== undefined ? { maxValue: item.maxValue } : {}),
  };
}

/**
 * Materialize a checklist instance from template sections. Sections whose
 * repeat count resolves to 0 (e.g. "Half Bath" on a property with none) are
 * omitted. Repeated sections get ` ${n}` title suffixes and `-n` id suffixes
 * only when more than one copy is emitted.
 */
export function seedChecklistFromTemplate(
  sections: ChecklistTemplateSection[],
  opts: SeedChecklistOptions = {},
): WorkOrderChecklist {
  const out: ChecklistSection[] = [];
  for (const section of sections) {
    const count = resolveRepeatCount(section, opts);
    for (let i = 1; i <= count; i++) {
      const instanceId = count > 1 ? `${section.id}-${i}` : section.id;
      const title = count > 1 ? `${section.title} ${i}` : section.title;
      out.push({
        id: instanceId,
        title,
        items: section.items.map((item) => seedItem(instanceId, item)),
      });
    }
  }
  return {
    ...(opts.templateId !== undefined ? { templateId: opts.templateId } : {}),
    ...(opts.templateName !== undefined ? { templateName: opts.templateName } : {}),
    seededAt: opts.seededAt ?? Date.now(),
    sections: out,
  };
}

/**
 * Dual-read helper for templates: sectioned templates win; a legacy flat
 * `checklistItems` template renders as one "Checklist" section. Structural arg
 * so hostfix `PMTemplate` and API payloads both satisfy it.
 */
export function templateSections(template: {
  sections?: ChecklistTemplateSection[];
  checklistItems?: Array<{ id: string; label: string; inputType: ChecklistInputType }>;
}): ChecklistTemplateSection[] {
  if (template.sections && template.sections.length > 0) return template.sections;
  if (template.checklistItems && template.checklistItems.length > 0) {
    return [{ id: 'checklist', title: 'Checklist', items: template.checklistItems }];
  }
  return [];
}
