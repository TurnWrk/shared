/**
 * In-app onboarding framework types (TURNWRK-194).
 * Pure data — no React. See docs/projects/ONBOARDING-FRAMEWORK.md.
 */

/** Namespaced tour id, e.g. `hostfix:create-work-order`, `clean:first-booking`. */
export type TourId = string;

/** How a coach-mark step advances to the next. */
export type TourAdvanceOn = 'next' | 'click' | 'predicate';

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export interface TourStep {
  id: string;
  /** CSS selector or `data-tour` value the overlay anchors to. */
  anchor: string;
  title: string;
  body: string;
  placement?: TourPlacement;
  advanceOn: TourAdvanceOn;
}

export type TourTrigger = 'mount' | 'surface' | 'manual';

export interface TourDefinition {
  id: TourId;
  steps: TourStep[];
  trigger: TourTrigger;
  /**
   * Org-level signal key that must be true for auto-start (e.g. `zeroWorkOrders`).
   * Orientation tours omit this and auto-start once per user.
   */
  zeroCompletionsSignal?: string;
  /** Schema version stamped on complete (v1 does not re-show on bump). */
  version: number;
}

/**
 * Checklist item — completion is always derived from live signals, never stored.
 */
export interface ChecklistItemDefinition {
  id: string;
  label: string;
  description?: string;
  /** In-app deep link (may include `?tour=`). */
  href: string;
  /** Optional tour to force-start from this item. */
  tourId?: TourId;
  /** Key into the signals map (`properties>=1`, etc.). */
  signal: string;
}

/** Per-tour progress persisted on `User.onboarding` (TURNWRK-195). */
export interface TourProgressEntry {
  completedAt?: number;
  dismissedAt?: number;
  version: number;
}

export type UserOnboardingState = Record<TourId, TourProgressEntry>;

/** Live org/user signals the engine evaluates (boolean map). */
export type OnboardingSignals = Record<string, boolean>;

/** localStorage key pattern for the per-app kill switch. */
export type TourSuppressionStorageKey =
  | 'hostfix:tours-off'
  | 'restock:tours-off'
  | 'clean:tours-off'
  | (string & {});
