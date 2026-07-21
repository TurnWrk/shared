/**
 * Pure onboarding engine logic (TURNWRK-194).
 * Apps supply signals + user state; this package never touches React or I/O.
 */
import type {
  ChecklistItemDefinition,
  OnboardingSignals,
  TourDefinition,
  TourId,
  TourProgressEntry,
  UserOnboardingState,
} from './types';

export interface ChecklistProgress {
  total: number;
  completed: number;
  /** 0–100 integer. */
  percent: number;
  /** Item ids whose signal is currently true. */
  doneIds: string[];
  /** Item ids still outstanding. */
  remainingIds: string[];
}

/** Minimal storage surface for the kill-switch check (window.localStorage). */
export interface TourSuppressionStorage {
  getItem(key: string): string | null;
}

/**
 * True when the user (or e2e harness) has set the per-app tours-off flag.
 * Values: any non-empty string counts as suppressed (`'1'`, `'true'`, …).
 */
export function isTourSuppressed(
  storage: TourSuppressionStorage | null | undefined,
  key: string,
): boolean {
  if (!storage) return false;
  const v = storage.getItem(key);
  return typeof v === 'string' && v.length > 0;
}

function entryFor(
  state: UserOnboardingState | undefined,
  tourId: TourId,
): TourProgressEntry | undefined {
  return state?.[tourId];
}

/** User has already finished or skipped this tour. */
export function isTourSettled(
  state: UserOnboardingState | undefined,
  tourId: TourId,
): boolean {
  const entry = entryFor(state, tourId);
  return !!(entry?.completedAt || entry?.dismissedAt);
}

/**
 * Auto-start requires: unsettled tour, optional zero-completions signal true,
 * and no kill switch. Force-start (`?tour=`) bypasses this helper.
 */
export function shouldAutoStartTour(
  def: TourDefinition,
  userState: UserOnboardingState | undefined,
  signals: OnboardingSignals,
  opts?: { suppressed?: boolean; anotherTourActive?: boolean },
): boolean {
  if (opts?.suppressed || opts?.anotherTourActive) return false;
  if (isTourSettled(userState, def.id)) return false;
  if (def.zeroCompletionsSignal) {
    if (!signals[def.zeroCompletionsSignal]) return false;
  }
  return true;
}

export function checklistProgress(
  items: ChecklistItemDefinition[],
  signals: OnboardingSignals,
): ChecklistProgress {
  const doneIds: string[] = [];
  const remainingIds: string[] = [];
  for (const item of items) {
    if (signals[item.signal]) doneIds.push(item.id);
    else remainingIds.push(item.id);
  }
  const total = items.length;
  const completed = doneIds.length;
  const percent = total === 0 ? 100 : Math.round((completed / total) * 100);
  return { total, completed, percent, doneIds, remainingIds };
}

/** Reducer: mark a tour completed (immutable). */
export function completeTour(
  state: UserOnboardingState | undefined,
  tourId: TourId,
  version: number,
  now: number = Date.now(),
): UserOnboardingState {
  return {
    ...(state ?? {}),
    [tourId]: {
      ...(state?.[tourId] ?? {}),
      completedAt: now,
      version,
      dismissedAt: undefined,
    },
  };
}

/** Reducer: mark a tour dismissed / skipped (immutable). */
export function dismissTour(
  state: UserOnboardingState | undefined,
  tourId: TourId,
  version: number,
  now: number = Date.now(),
): UserOnboardingState {
  return {
    ...(state ?? {}),
    [tourId]: {
      ...(state?.[tourId] ?? {}),
      dismissedAt: now,
      version,
      completedAt: undefined,
    },
  };
}

/**
 * Pseudo-tour id for checklist collapse/dismiss preference
 * (e.g. `checklist:hostfix`). Same User.onboarding map.
 */
export function checklistPreferenceTourId(app: string): TourId {
  return `checklist:${app}`;
}
