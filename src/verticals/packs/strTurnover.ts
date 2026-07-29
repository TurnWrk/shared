/**
 * The `str_turnover` pack (TURNWRK-316) — the Dispatch-only short-term-rental
 * operator, the vertical `resolveOrgVerticals` falls back to.
 *
 * Two deliberate differences from `cleaning`, both grounded rather than
 * stylistic: the work order is a `Turnover` (occupancy-driven, no booking and
 * no payment) and the payer is the property owner, not a retail customer.
 */
import type { VerticalPack } from '../types';

export const STR_TURNOVER_PACK: VerticalPack = {
  key: 'str_turnover',
  label: 'STR Turnover',
  terminology: {
    service: 'turnover',
    job: 'turnover',
    jobPlural: 'turnovers',
    worker: 'cleaner',
    workerPlural: 'cleaners',
    /** Dispatch bills the property owner, not a booking customer. */
    customer: 'owner',
    customerPlural: 'owners',
    site: 'property',
    sitePlural: 'properties',
  },
  /** WOType 'Turnover': "Auto-created from occupancy checkouts (no booking/payment)". */
  workOrderType: 'Turnover',
  /**
   * One-off only. A turnover is triggered by a guest checkout, not booked on a
   * recurrence, so the pack declares the single `once` cadence rather than
   * cloning cleaning's discount ladder — a weekly-discount option on a
   * checkout-driven job would be copy that never renders. The occupancy
   * extension below is what actually schedules these.
   */
  cadences: [{ key: 'once', widgetLabel: 'One-time', discountPct: 0 }],
  /** No shipped default catalog — see the same note on CLEANING_PACK. */
  serviceSeeds: [],
  /** No code-owned template — org-owned cmms_pmTemplates, as with cleaning. */
  checklistTemplates: [],
  /** No overrides; turnover copy is the shared default set. */
  notificationCopy: {},
  onboarding: { catalogId: 'hostfix-admin' },
  /**
   * Turnovers carry no booking params, so repeats resolve from property counts
   * — the case src/checklist/seed.ts:31 documents as "fallback when no booking
   * params exist (turnovers)".
   */
  repeatSources: ['bed', 'bath'],
  extensions: ['occupancy'],
};
