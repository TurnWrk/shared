/**
 * The `pool` pack (TURNWRK-329, content blessed TURNWRK-339) — one of the two
 * design-partner trades the module system exists for. A recurring, booked
 * service that produces a visit with a service checklist and a proof-of-service
 * report, structurally the same path as cleaning; the differences are all data.
 *
 * Scope boundaries:
 * - `water_chemistry` flags the readings widget (TURNWRK-294). Ranges are
 *   CDC/MAHC-tightened warn-only hints (TURNWRK-339). No LSI.
 * - `equipment_check` is NOT a separate SKU — equipment inspection lives on the
 *   weekly visit checklist (Alan red-line 2026-08-06).
 * - Worker noun is `tech` / `techs` (Alan red-line 2026-08-06), not technician.
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
    worker: 'tech',
    workerPlural: 'techs',
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
   * Bi-weekly is also a starter *service* seed (TURNWRK-339), not only a cadence.
   */
  cadences: [
    { key: 'once', widgetLabel: 'One-time', discountPct: 0 },
    { key: 'weekly', widgetLabel: 'Weekly', discountPct: 15 },
    { key: 'fortnightly', widgetLabel: 'Bi-weekly', discountPct: 10 },
    { key: 'every_10_days', widgetLabel: 'Every 10 days', discountPct: 10 },
    { key: 'monthly', widgetLabel: 'Monthly', discountPct: 5 },
  ],
  /**
   * Starter catalog (TURNWRK-339). Weekly + bi-weekly maintenance, opening,
   * closing, filter clean, green-to-clean. No separate equipment SKU.
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
      key: 'biweekly_pool_service',
      name: 'Bi-weekly Pool Service',
      description:
        'Recurring maintenance every other week: skim, brush, vacuum, baskets, equipment check.',
      basePriceMinor: 16000,
      baseMinutes: 60,
      checklistKey: 'pool_visit',
    },
    {
      key: 'pool_opening',
      name: 'Pool Opening',
      description: 'Seasonal opening: uncover, inspect, start equipment, balance water.',
      basePriceMinor: 25000,
      baseMinutes: 120,
      checklistKey: 'pool_visit',
    },
    {
      key: 'pool_closing',
      name: 'Pool Closing / Winterizing',
      description: 'Seasonal closing: lower water, winterize equipment, cover.',
      basePriceMinor: 27500,
      baseMinutes: 120,
      checklistKey: 'pool_visit',
    },
    {
      key: 'filter_clean',
      name: 'Filter Clean',
      description: 'Deep-clean cartridge or DE filter elements.',
      basePriceMinor: 15000,
      baseMinutes: 60,
    },
    {
      key: 'green_to_clean',
      name: 'Green-to-Clean Restoration',
      description: 'One-time recovery of a neglected or algae-green pool.',
      basePriceMinor: 35000,
      baseMinutes: 180,
    },
  ],
  /**
   * Physical proof-of-service plus extension-gated chemistry readings.
   * Equipment inspection is on the visit checklist (not a separate SKU).
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
            {
              id: 'equipment',
              label: 'Inspect pump, heater and timer',
              inputType: 'checkbox',
              required: true,
            },
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
    {
      key: 'pool_water_chemistry',
      title: 'Water Chemistry',
      requiresExtension: 'water_chemistry',
      sections: [
        {
          id: 'chemistry',
          title: 'Readings',
          items: [
            {
              id: 'chlorine',
              label: 'Free chlorine',
              inputType: 'number',
              suffix: 'ppm',
              // CDC Healthy Swimming: min FAC 1 ppm; MAHC: shall not exceed 10.0.
              minValue: 1,
              maxValue: 10,
              placeholder: 'e.g. 3',
            },
            {
              id: 'ph',
              label: 'pH',
              inputType: 'number',
              // CDC: maintain pH 7.0–7.8.
              minValue: 7.0,
              maxValue: 7.8,
              placeholder: 'e.g. 7.4',
            },
            {
              id: 'alkalinity',
              label: 'Total alkalinity',
              inputType: 'number',
              suffix: 'ppm',
              minValue: 60,
              maxValue: 180,
            },
            {
              id: 'cya',
              label: 'Cyanuric acid (CYA)',
              inputType: 'number',
              suffix: 'ppm',
              // CDC MAHC cheat sheet: CYA operating ≤ 90 ppm.
              minValue: 0,
              maxValue: 90,
            },
            {
              id: 'calcium',
              label: 'Calcium hardness',
              inputType: 'number',
              suffix: 'ppm',
              minValue: 150,
              maxValue: 400,
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
