/**
 * The `landscaping` pack (TURNWRK-329) — the second design-partner trade.
 *
 * Named `landscaping`, NOT `lawn`: NAMING DECISION 2026-07-29 (Alan). TURNWRK-292
 * already shipped that spelling in `RouteTemplate.vertical` (dispatch/types.ts)
 * and it is canonical; this card renames the `VerticalKey` member to match.
 *
 * A recurring booked service like pool/cleaning. Its one distinguishing need is
 * the seasonal shift — mow cadence drops in dormant months while billing may
 * continue — which is the `seasonal_billing` extension (TURNWRK-293), not a
 * code branch here.
 */
import type { VerticalPack } from '../types';

export const LANDSCAPING_PACK: VerticalPack = {
  key: 'landscaping',
  label: 'Landscaping',
  terminology: {
    service: 'landscaping',
    job: 'visit',
    jobPlural: 'visits',
    /** Landscaping is crew-dispatched rather than single-worker. */
    worker: 'crew',
    workerPlural: 'crews',
    customer: 'customer',
    customerPlural: 'customers',
    site: 'property',
    sitePlural: 'properties',
  },
  /** 'Cleaning' — the booked recurring-service path, as with pool. See POOL_PACK. */
  workOrderType: 'Cleaning',
  /**
   * Mow cadences plus the seasonal shift the card names. `seasonal` is the
   * reduced dormant-season cadence; billing continuity across it is the
   * `seasonal_billing` extension, not a cadence property. Discounts are
   * org-overridable defaults.
   */
  cadences: [
    { key: 'once', widgetLabel: 'One-time', discountPct: 0 },
    { key: 'weekly', widgetLabel: 'Weekly', discountPct: 15 },
    { key: 'fortnightly', widgetLabel: 'Fortnightly', discountPct: 10 },
    { key: 'seasonal', widgetLabel: 'Seasonal (dormant)', discountPct: 0 },
  ],
  /**
   * A starting catalog. `weekly_mow` attaches the `landscaping_visit` checklist;
   * the seasonal cleanups and trims are one-off jobs. Prices are minor units and
   * org-overridable.
   */
  serviceSeeds: [
    {
      key: 'weekly_mow',
      name: 'Weekly Mow',
      description: 'Recurring visit: mow, edge, trim and blow clean.',
      basePriceMinor: 5500,
      baseMinutes: 45,
      checklistKey: 'landscaping_visit',
    },
    {
      key: 'spring_cleanup',
      name: 'Spring Cleanup',
      description: 'One-time seasonal cleanup: debris, bed edging, first mow.',
      basePriceMinor: 25000,
      baseMinutes: 180,
    },
    {
      key: 'fall_cleanup',
      name: 'Fall Cleanup',
      description: 'One-time leaf removal and end-of-season cutback.',
      basePriceMinor: 25000,
      baseMinutes: 180,
    },
    {
      key: 'hedge_trim',
      name: 'Hedge & Shrub Trim',
      description: 'Trim and shape hedges and shrubs, clippings removed.',
      basePriceMinor: 14000,
      baseMinutes: 90,
    },
  ],
  /** The mow-visit service checklist proving the visit happened. */
  checklistTemplates: [
    {
      key: 'landscaping_visit',
      title: 'Landscaping Visit',
      sections: [
        {
          id: 'landscaping_service',
          title: 'Service',
          items: [
            { id: 'mow', label: 'Mow all turf areas', inputType: 'checkbox', required: true },
            { id: 'edge', label: 'Edge walkways, drives and beds', inputType: 'checkbox', required: true },
            { id: 'trim', label: 'String-trim fence lines and obstacles', inputType: 'checkbox', required: true },
            { id: 'blow', label: 'Blow clean hard surfaces', inputType: 'checkbox', required: true },
            { id: 'gate', label: 'Gates closed, no pets or tools left behind', inputType: 'checkbox-mandatory', required: true },
            {
              id: 'finished_photo',
              label: 'Photo of the finished yard',
              inputType: 'photo-required',
              photoRequired: true,
            },
          ],
        },
      ],
    },
  ],
  /** Inherits the shared default copy; no landscaping-specific overrides yet. */
  notificationCopy: {},
  /** No landscaping-specific onboarding catalog ships yet. */
  onboarding: {},
  /** Visits carry no repeatable booking params, so section repeats resolve to 1. */
  repeatSources: [],
  /**
   * Seasonal (dormant-month) billing plus operator-declared rain-out bulk
   * reschedule (TURNWRK-296) — both shared extension keys, not lawn-only branches.
   */
  extensions: ['seasonal_billing', 'rain_reschedule'],
};
