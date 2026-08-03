/**
 * The `pool` pack (TURNWRK-329) — one of the two design-partner trades the
 * module system exists for. A recurring, booked service that produces a visit
 * with a service checklist and a proof-of-service report, structurally the same
 * path as cleaning; the differences are all data.
 *
 * Scope boundaries the card draws explicitly:
 * - The `water_chemistry` extension only *flags* that the chemistry widget
 *   attaches. The widget itself — the generic number checklist input and the
 *   pool template that logs chlorine / pH / alkalinity / CYA / calcium as raw
 *   readings — is TURNWRK-294. Computed LSI (Langelier saturation index) is now
 *   owned by this extension key but stays UNBUILT: it needs two domain answers
 *   the card says not to guess (which formula, and where water temperature and
 *   TDS come from). So this pack's checklist is the *physical* service tasks
 *   only; no chemistry readings live here.
 */
import type { VerticalPack } from '../types';
import { POOL_NOTIFICATION_COPY } from './poolNotificationCopy';

export const POOL_PACK: VerticalPack = {
  key: 'pool',
  label: 'Pool Service',
  terminology: {
    service: 'pool service',
    /** Recurring, so a unit of work is a "visit". */
    job: 'visit',
    jobPlural: 'visits',
    worker: 'technician',
    workerPlural: 'technicians',
    customer: 'customer',
    customerPlural: 'customers',
    site: 'property',
    sitePlural: 'properties',
  },
  /**
   * 'Cleaning' — the existing booked-service work-order type. A pool visit is
   * booked in the catalog and yields a checklist'd visit + proof, exactly the
   * path cleaning already runs; reusing that type is the "no new code path" the
   * acceptance requires (a `Pool` WOType would be a design escape). Terminology
   * above makes it read as a "pool visit", not a "clean".
   */
  workOrderType: 'Cleaning',
  /**
   * Weekly and 10-day are the pool cadences the card names; `every_10_days` is a
   * key the closed four-value `CleanFrequencyKey` could not express, which is
   * why phase B opened it (TURNWRK-318). Discounts are org-overridable defaults.
   */
  cadences: [
    { key: 'once', widgetLabel: 'One-time', discountPct: 0 },
    { key: 'weekly', widgetLabel: 'Weekly', discountPct: 15 },
    { key: 'every_10_days', widgetLabel: 'Every 10 days', discountPct: 10 },
    { key: 'monthly', widgetLabel: 'Monthly', discountPct: 5 },
  ],
  /**
   * A starting catalog. The recurring `weekly_pool_service` attaches the
   * `pool_visit` service checklist below; the one-off restorations do not.
   * Prices are minor units and org-overridable.
   */
  serviceSeeds: [
    {
      key: 'weekly_pool_service',
      name: 'Weekly Pool Service',
      description: 'Recurring maintenance visit: skim, brush, vacuum, baskets, equipment check.',
      basePriceMinor: 12000,
      baseMinutes: 45,
      checklistKey: 'pool_visit',
    },
    {
      key: 'green_to_clean',
      name: 'Green-to-Clean Restoration',
      description: 'One-time recovery of a neglected or algae-green pool.',
      basePriceMinor: 35000,
      baseMinutes: 180,
    },
    {
      key: 'filter_clean',
      name: 'Filter Clean',
      description: 'Deep-clean cartridge or DE filter elements.',
      basePriceMinor: 15000,
      baseMinutes: 60,
    },
    {
      key: 'equipment_check',
      name: 'Equipment Inspection',
      description: 'Inspect pump, heater, timer and plumbing for faults.',
      basePriceMinor: 9000,
      baseMinutes: 45,
    },
  ],
  /**
   * The service checklist proving the visit happened — physical tasks only.
   * Water-chemistry readings are deliberately absent: they belong to the
   * `water_chemistry` extension (TURNWRK-294), not to this proof-of-service set.
   */
  checklistTemplates: [
    {
      key: 'pool_visit',
      title: 'Pool Service Visit',
      sections: [
        {
          id: 'pool_service',
          title: 'Service',
          items: [
            { id: 'skim', label: 'Skim surface debris', inputType: 'checkbox', required: true },
            { id: 'brush', label: 'Brush walls, steps and tile line', inputType: 'checkbox', required: true },
            { id: 'vacuum', label: 'Vacuum pool floor', inputType: 'checkbox', required: true },
            { id: 'baskets', label: 'Empty skimmer and pump baskets', inputType: 'checkbox', required: true },
            { id: 'filter', label: 'Check filter pressure, backwash if needed', inputType: 'checkbox' },
            { id: 'equipment', label: 'Inspect pump, heater and timer', inputType: 'checkbox' },
            {
              id: 'finished_photo',
              label: 'Photo of the finished pool',
              inputType: 'photo-required',
              photoRequired: true,
            },
          ],
        },
      ],
    },
  ],
  /** Trade-appropriate en-route and review copy (TURNWRK-325). */
  notificationCopy: POOL_NOTIFICATION_COPY,
  /** No pool-specific onboarding catalog ships yet. */
  onboarding: {},
  /** Visits carry no repeatable booking params, so section repeats resolve to 1. */
  repeatSources: [],
  /**
   * `water_chemistry` (the readings widget, TURNWRK-294) and `proof_report` (the
   * proof-of-service report the card wants on). Both are shared extension keys,
   * not pool-only branches.
   */
  extensions: ['water_chemistry', 'proof_report'],
};
