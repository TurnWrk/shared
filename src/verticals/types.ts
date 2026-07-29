/**
 * Vertical (trade) packs — the shape axis (TURNWRK-315).
 *
 * A vertical is DATA: terminology, cadences, service seeds, checklist seeds,
 * notification copy and onboarding, plus named extension keys for the rare
 * vertical-only feature. Design record: docs/projects/VERTICAL-MODULES.md.
 *
 * The one rule that keeps this from collapsing into the entitlement system:
 * **verticals choose shape; `enabledApps` / `features` / plan choose
 * entitlement.** A vertical never gates a paid feature, and `Org.verticals` is
 * deliberately NOT privileged (see `Org.verticals` in src/types/org.ts).
 */
import type { ChecklistTemplateSection } from '../types/checklist';
import type { CleanNotificationEventKey } from '../types/clean';
import type { CleanTemplateDefault } from '../clean/notificationDefaults';
import type { WOType } from '../types/workOrder';

/** Trades the suite models. Packs land per phase — see `VERTICAL_REGISTRY`. */
export type VerticalKey =
  | 'cleaning'
  | 'str_turnover'
  | 'pool'
  | 'lawn'
  | 'handyman';

/** Iteration order for registry completeness checks and pickers. */
export const VERTICAL_KEYS: readonly VerticalKey[] = [
  'cleaning',
  'str_turnover',
  'pool',
  'lawn',
  'handyman',
] as const;

/**
 * Named vertical-only behaviours. A pack opts in by listing the key; the code
 * that implements it checks `pack.extensions.includes(...)` rather than
 * branching on `pack.key`, so a second vertical can reuse it.
 */
export type VerticalExtensionKey =
  /** STR occupancy sync: checkout-driven turnovers, guest-stay windows. */
  | 'occupancy'
  /** Pool chemistry readings captured on the visit. */
  | 'water_chemistry'
  /** Seasonal (dormant-month) billing schedules. */
  | 'seasonal_billing'
  /** Proof-of-service report sent after a visit (TURNWRK-291). */
  | 'proof_report';

export const VERTICAL_EXTENSION_KEYS: readonly VerticalExtensionKey[] = [
  'occupancy',
  'water_chemistry',
  'seasonal_billing',
  'proof_report',
] as const;

/**
 * Customer- and operator-facing nouns. Only fields that genuinely differ
 * between trades live here — adding one is additive, so start narrow.
 */
export interface VerticalTerminology {
  /** The trade as a noun phrase: "cleaning", "pool service". */
  service: string;
  /** One unit of work as the customer sees it: "clean", "visit". */
  job: string;
  jobPlural: string;
  /** Who performs it: "cleaner", "technician". */
  worker: string;
  workerPlural: string;
  /** Who pays: "customer", "owner". */
  customer: string;
  customerPlural: string;
  /** Where it happens: "property", "site". */
  site: string;
  sitePlural: string;
}

/**
 * A recurrence option offered at booking. Structurally identical to
 * `CleanFrequency` (src/types/clean.ts) so the closed four-value
 * `CleanFrequencyKey` can open onto pack-declared cadences in phase B
 * (TURNWRK-318) without a shape change.
 */
export interface VerticalCadence {
  /** Stable key persisted on bookings/series. */
  key: string;
  /** Label shown in the booking widget ("Weekly"). */
  widgetLabel: string;
  /** Whole percent, e.g. 25. */
  discountPct: number;
}

/**
 * A catalog service an org starts with. Mirrors the writable subset of
 * `CleanService` — no `id` (the seeder mints it) and no `extraIds` (org data).
 */
export interface VerticalServiceSeed {
  /** Stable within the pack; the seeder derives the catalog id from it. */
  key: string;
  name: string;
  description?: string;
  basePriceMinor: number;
  baseMinutes: number;
  /** Key of a `checklistTemplates` entry attached to jobs for this service. */
  checklistKey?: string;
}

/** A checklist template an org starts with, as data rather than a doc id. */
export interface VerticalChecklistSeed {
  /** Stable within the pack; the seeder derives the cmms_pmTemplates id. */
  key: string;
  title: string;
  /** WO types this template is the default for when the org has set none. */
  defaultForTypes?: readonly WOType[];
  sections: readonly ChecklistTemplateSection[];
}

/**
 * Per-event overrides layered on `DEFAULT_CLEAN_TEMPLATES`. A pack that ships
 * no override inherits the code default verbatim — which is how the `cleaning`
 * pack reproduces today's copy losslessly (TURNWRK-316) and how the phase-B
 * golden test (TURNWRK-317) stays honest.
 */
export type VerticalNotificationCopy = Readonly<
  Partial<Record<CleanNotificationEventKey, CleanTemplateDefault>>
>;

export interface VerticalOnboarding {
  /** `OnboardingCatalog.id` driving the operator's first-run tours. */
  catalogId?: string;
}

/** One trade, expressed entirely as data. */
export interface VerticalPack {
  key: VerticalKey;
  /** Operator-facing name of the trade ("Cleaning", "STR Turnover"). */
  label: string;
  terminology: VerticalTerminology;
  /** WO type stamped on work orders this vertical creates. */
  workOrderType: WOType;
  cadences: readonly VerticalCadence[];
  serviceSeeds: readonly VerticalServiceSeed[];
  checklistTemplates: readonly VerticalChecklistSeed[];
  notificationCopy: VerticalNotificationCopy;
  onboarding: VerticalOnboarding;
  /**
   * Labels whose booking-param quantity drives checklist section repeats
   * ("bedrooms", "bathrooms"). Replaces the hardcoded bed/bath heuristic in
   * src/checklist/seed.ts in phase B (TURNWRK-317); a no-match still yields 1.
   */
  repeatSources: readonly string[];
  extensions: readonly VerticalExtensionKey[];
}
