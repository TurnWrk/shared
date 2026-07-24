/**
 * Structured work checklists carried on cmms_workOrders (`WorkOrder.checklist`).
 *
 * Instance-driven by design: the vendor app renders whatever sections/items the
 * WO document carries and never looks templates up by `wo.type` — templates
 * (cmms_pmTemplates) are consulted once, at WO creation, by whichever writer
 * owns that path (clean booking confirm, functions cleanWorkers, PM generator,
 * dispatch). Legacy flat `inspectionResults` on old WOs is a separate field and
 * is left untouched; readers presence-route between the two.
 */

/**
 * Same value set as hostfix-cmms `InspectionInputType` (types.ts) — hostfix
 * aliases its union to this one. Keep in sync with the widget set in
 * hostfix-cmms components/ui/InspectionInputs.tsx.
 */
export type ChecklistInputType =
  | 'checkbox'
  | 'checkbox-mandatory'
  | 'yes-no-photo'
  | 'checkbox-text'
  | 'checkbox-date'
  | 'textarea-photo'
  | 'photo-required'
  | 'photo-location';

export type ChecklistItemStatus = 'Pass' | 'Fail' | 'NA' | 'Flagged';

/** Mutable per-item completion state (all optional — absent until touched). */
export interface ChecklistItemState {
  done?: boolean;
  status?: ChecklistItemStatus;
  value?: string | boolean;
  /** YYYY-MM-DD for checkbox-date items. */
  dateValue?: string;
  note?: string;
  /**
   * TimelineEntry ids on the same WO. Item photos are normal timeline entries
   * (offline-first upload queue, blob→URL swap) — never raw URLs here.
   */
  photoEntryIds?: string[];
  /** Marked not applicable; UI asks for a short note on required items. */
  notApplicable?: boolean;
  /** Quick WO raised from this item ("Report issue"). */
  issueWoId?: string;
  completedAt?: number;
  /** Technician/vendor id — disambiguates multi-cleaner crews. */
  completedBy?: string;
}

export interface ChecklistItem extends ChecklistItemState {
  /** Stable instance id: `${sectionInstanceId}.${templateItemId}`. */
  id: string;
  label: string;
  inputType: ChecklistInputType;
  /** Counts toward the soft finish warning. */
  required?: boolean;
  /** Item is only complete once it carries at least one photo. */
  photoRequired?: boolean;
  instructions?: string;
  placeholder?: string;
  suffix?: string;
}

export interface ChecklistSection {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface WorkOrderChecklist {
  /** cmms_pmTemplates provenance, when seeded from a template. */
  templateId?: string;
  templateName?: string;
  seededAt: number;
  sections: ChecklistSection[];
}

/** Template-side item shape (no state fields). */
export interface ChecklistTemplateItem {
  id: string;
  label: string;
  inputType: ChecklistInputType;
  required?: boolean;
  photoRequired?: boolean;
  instructions?: string;
  placeholder?: string;
  suffix?: string;
}

/**
 * Template-side section. `repeatPerParamLabel` multiplies the section per
 * booking param quantity (e.g. title "Bedroom" + repeatPerParamLabel
 * "Bedrooms" × qty 3 → "Bedroom 1/2/3"), falling back to property beds/baths
 * counts when no params are available (turnovers created without a booking).
 */
export interface ChecklistTemplateSection {
  id: string;
  title: string;
  repeatPerParamLabel?: string;
  items: ChecklistTemplateItem[];
}
