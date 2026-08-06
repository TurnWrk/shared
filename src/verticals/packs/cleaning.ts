/**
 * The `cleaning` pack (TURNWRK-316, starter catalog TURNWRK-339) — today's
 * Turnwrk Clean behaviour restated as data, plus net-new opt-in service and
 * checklist seeds for new vertical choice / F3 seeding (TURNWRK-332).
 *
 * Seeds are starter-catalog only: existing orgs that already authored catalogs
 * are not rewritten. Cadences still mirror `DEFAULT_CLEAN_FREQUENCIES`.
 */
import type { VerticalPack } from '../types';
import { CLEANING_NOTIFICATION_COPY } from './cleaningNotificationCopy';

export const CLEANING_PACK: VerticalPack = {
  key: 'cleaning',
  label: 'Cleaning',
  terminology: {
    service: 'cleaning',
    job: 'clean',
    jobPlural: 'cleans',
    worker: 'cleaner',
    workerPlural: 'cleaners',
    customer: 'customer',
    customerPlural: 'customers',
    site: 'property',
    sitePlural: 'properties',
  },
  /** src/lib/clean/server.ts stamps this on every booking's work order. */
  workOrderType: 'Cleaning',
  /**
   * The four `CleanFrequencyKey` values, restated rather than re-exported: the
   * pack becomes the source when phase B (TURNWRK-318) opens that closed union,
   * so the constant will derive from here, not the other way round.
   * Mirrors DEFAULT_CLEAN_FREQUENCIES (src/types/clean.ts).
   */
  cadences: [
    { key: 'once', widgetLabel: 'One-time', discountPct: 0 },
    { key: 'weekly', widgetLabel: 'Weekly', discountPct: 25 },
    { key: 'fortnightly', widgetLabel: 'Fortnightly', discountPct: 20 },
    { key: 'monthly', widgetLabel: 'Monthly', discountPct: 10 },
  ],
  /**
   * Net-new starter catalog (TURNWRK-339). Opt-in for new vertical choice /
   * F3 seeding — not a rewrite of existing org catalogs.
   */
  serviceSeeds: [
    {
      key: 'standard_clean',
      name: 'Standard Clean',
      description: 'Recurring maintenance clean: kitchen, baths, bedrooms, living areas.',
      basePriceMinor: 18500,
      baseMinutes: 180,
      checklistKey: 'standard_clean_visit',
    },
    {
      key: 'deep_clean',
      name: 'Deep Clean',
      description: 'Thorough clean including baseboards, appliance interiors, fans and vents.',
      basePriceMinor: 32000,
      baseMinutes: 300,
      checklistKey: 'deep_clean_visit',
    },
    {
      key: 'move_out_clean',
      name: 'Move-Out Clean',
      description: 'Vacate clean: cabinets, appliances, closets and wall spot-clean.',
      basePriceMinor: 45000,
      baseMinutes: 420,
      checklistKey: 'move_out_clean_visit',
    },
  ],
  /**
   * Starter visit checklists keyed from the service seeds above. Bed/bath
   * sections multiply via `repeatSources` + `repeatPerParamLabel`.
   */
  checklistTemplates: [
    {
      key: 'standard_clean_visit',
      title: 'Standard Clean',
      sections: [
        {
          id: 'kitchen',
          title: 'Kitchen',
          items: [
            {
              id: 'kitchen_surfaces',
              label: 'Counters, sink, appliance exteriors, floors',
              inputType: 'checkbox',
              required: true,
            },
          ],
        },
        {
          id: 'bathrooms',
          title: 'Bathroom',
          repeatPerParamLabel: 'bathrooms',
          items: [
            {
              id: 'bath_surfaces',
              label: 'Toilet, sink, tub/shower, mirror, floor',
              inputType: 'checkbox',
              required: true,
            },
          ],
        },
        {
          id: 'bedrooms',
          title: 'Bedroom',
          repeatPerParamLabel: 'bedrooms',
          items: [
            {
              id: 'bedroom_surfaces',
              label: 'Dust surfaces, vacuum/mop, make beds',
              inputType: 'checkbox',
              required: true,
            },
          ],
        },
        {
          id: 'living',
          title: 'Living areas',
          items: [
            { id: 'living_surfaces', label: 'Dust and floors', inputType: 'checkbox', required: true },
            { id: 'trash', label: 'Trash emptied', inputType: 'checkbox' },
            {
              id: 'finished_photo',
              label: 'Finished photo',
              inputType: 'photo-required',
              photoRequired: true,
            },
          ],
        },
      ],
    },
    {
      key: 'deep_clean_visit',
      title: 'Deep Clean',
      sections: [
        {
          id: 'kitchen',
          title: 'Kitchen',
          items: [
            {
              id: 'kitchen_surfaces',
              label: 'Counters, sink, appliance exteriors, floors',
              inputType: 'checkbox',
              required: true,
            },
            {
              id: 'kitchen_appliances',
              label: 'Appliance interiors (oven/fridge light clean)',
              inputType: 'checkbox',
              required: true,
            },
          ],
        },
        {
          id: 'bathrooms',
          title: 'Bathroom',
          repeatPerParamLabel: 'bathrooms',
          items: [
            {
              id: 'bath_surfaces',
              label: 'Toilet, sink, tub/shower, mirror, floor',
              inputType: 'checkbox',
              required: true,
            },
          ],
        },
        {
          id: 'bedrooms',
          title: 'Bedroom',
          repeatPerParamLabel: 'bedrooms',
          items: [
            {
              id: 'bedroom_surfaces',
              label: 'Dust surfaces, vacuum/mop, make beds',
              inputType: 'checkbox',
              required: true,
            },
          ],
        },
        {
          id: 'living',
          title: 'Living areas',
          items: [
            { id: 'living_surfaces', label: 'Dust and floors', inputType: 'checkbox', required: true },
            { id: 'baseboards', label: 'Baseboards wiped', inputType: 'checkbox', required: true },
            { id: 'fans_vents', label: 'Ceiling fans and vents dusted', inputType: 'checkbox' },
            { id: 'trash', label: 'Trash emptied', inputType: 'checkbox' },
            {
              id: 'finished_photo',
              label: 'Finished photo',
              inputType: 'photo-required',
              photoRequired: true,
            },
          ],
        },
      ],
    },
    {
      key: 'move_out_clean_visit',
      title: 'Move-Out Clean',
      sections: [
        {
          id: 'kitchen',
          title: 'Kitchen',
          items: [
            {
              id: 'kitchen_surfaces',
              label: 'Counters, sink, appliance exteriors, floors',
              inputType: 'checkbox',
              required: true,
            },
            {
              id: 'kitchen_cabinets',
              label: 'Inside cabinets and drawers',
              inputType: 'checkbox',
              required: true,
            },
            {
              id: 'kitchen_appliances',
              label: 'Inside fridge and oven',
              inputType: 'checkbox',
              required: true,
            },
          ],
        },
        {
          id: 'bathrooms',
          title: 'Bathroom',
          repeatPerParamLabel: 'bathrooms',
          items: [
            {
              id: 'bath_surfaces',
              label: 'Toilet, sink, tub/shower, mirror, floor',
              inputType: 'checkbox',
              required: true,
            },
          ],
        },
        {
          id: 'bedrooms',
          title: 'Bedroom',
          repeatPerParamLabel: 'bedrooms',
          items: [
            {
              id: 'bedroom_surfaces',
              label: 'Dust surfaces, vacuum/mop, make beds',
              inputType: 'checkbox',
              required: true,
            },
            {
              id: 'closet_interiors',
              label: 'Closet interiors wiped',
              inputType: 'checkbox',
              required: true,
            },
          ],
        },
        {
          id: 'living',
          title: 'Living areas',
          items: [
            { id: 'living_surfaces', label: 'Dust and floors', inputType: 'checkbox', required: true },
            { id: 'baseboards', label: 'Baseboards wiped', inputType: 'checkbox', required: true },
            { id: 'wall_spots', label: 'Wall spot-clean', inputType: 'checkbox' },
            { id: 'fans_vents', label: 'Ceiling fans and vents dusted', inputType: 'checkbox' },
            { id: 'trash', label: 'Trash emptied', inputType: 'checkbox' },
            {
              id: 'finished_photo',
              label: 'Finished photo',
              inputType: 'photo-required',
              photoRequired: true,
            },
          ],
        },
      ],
    },
  ],
  /** Restores pre-neutralisation cleaning wording (TURNWRK-325). */
  notificationCopy: CLEANING_NOTIFICATION_COPY,
  onboarding: { catalogId: 'clean-operator' },
  /**
   * The substrings resolveRepeatCount matches against `repeatPerParamLabel`
   * before falling back to property counts (src/checklist/seed.ts:65-70).
   */
  repeatSources: ['bed', 'bath'],
  /**
   * Clean orgs get the proof-of-service capability, but the auto-send is
   * opt-in per org (CleanOrgSettings.visitReportEnabled, "default false" —
   * src/types/clean.ts; owner decision 2026-07-29).
   */
  extensions: ['proof_report'],
};
