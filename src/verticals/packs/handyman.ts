/**
 * The `handyman` pack (TURNWRK-329) — the first pack authored fresh rather than
 * restated from a shipped constant. There is no "today's handyman behaviour" to
 * mirror, so `serviceSeeds` here is a genuine starting catalog, not the empty
 * "orgs author their own" of the cleaning/str_turnover packs. A handyman org
 * that seeds these can quote → schedule → invoice on day one.
 *
 * Pure data by decision (docs/projects/VERTICAL-MODULES.md § E5): a one-off
 * repair is the Dispatch estimate → work-order → invoice flow that already
 * ships. The pack adds no extension — nothing here is a handyman-only behaviour;
 * it is the generic one-off job path with handyman terminology and seeds.
 */
import type { VerticalPack } from '../types';

export const HANDYMAN_PACK: VerticalPack = {
  key: 'handyman',
  label: 'Handyman',
  terminology: {
    service: 'handyman service',
    /** One-off, so the unit of work is a "job", not a recurring "visit". */
    job: 'job',
    jobPlural: 'jobs',
    worker: 'technician',
    workerPlural: 'technicians',
    customer: 'customer',
    customerPlural: 'customers',
    site: 'property',
    sitePlural: 'properties',
  },
  /**
   * 'Repair' — the existing one-off Dispatch work-order type. A handyman job is
   * a repair-shaped job (quote → job → paid), so it rides that path rather than
   * introducing a `Handyman` WOType, which the acceptance forbids as a new code
   * path. Terminology above is what makes it read as "handyman" in the UI.
   */
  workOrderType: 'Repair',
  /**
   * One-off only: the acceptance is explicit that handyman needs no recurring
   * cadence. Declaring just `once` keeps a weekly-discount option that would
   * never render off the booking widget.
   */
  cadences: [{ key: 'once', widgetLabel: 'One-time', discountPct: 0 }],
  /**
   * A starting catalog of common one-off jobs. Prices are minor units (cents)
   * and are org-overridable defaults, not fixed rates — an operator edits them
   * in their catalog. `key` is stable; the seeder mints the catalog id from it.
   */
  serviceSeeds: [
    {
      key: 'handyman_hourly',
      name: 'Handyman — Hourly',
      description: 'General labour billed by the hour for miscellaneous tasks.',
      basePriceMinor: 9500,
      baseMinutes: 60,
    },
    {
      key: 'furniture_assembly',
      name: 'Furniture Assembly',
      description: 'Assemble flat-pack furniture, one item.',
      basePriceMinor: 8000,
      baseMinutes: 60,
    },
    {
      key: 'tv_mounting',
      name: 'TV Mounting',
      description: 'Wall-mount a TV, bracket supplied by customer.',
      basePriceMinor: 12000,
      baseMinutes: 90,
    },
    {
      key: 'drywall_repair',
      name: 'Drywall Patch & Repair',
      description: 'Patch and finish a small drywall hole, paint not included.',
      basePriceMinor: 15000,
      baseMinutes: 120,
    },
    {
      key: 'faucet_replacement',
      name: 'Faucet Replacement',
      description: 'Swap a kitchen or bathroom faucet, fixture supplied by customer.',
      basePriceMinor: 14000,
      baseMinutes: 90,
    },
  ],
  /** No mandated checklist — a one-off job carries whatever the estimate scoped. */
  checklistTemplates: [],
  /** Inherits the shared default copy; nothing handyman-specific to override. */
  notificationCopy: {},
  /** No handyman-specific onboarding catalog ships yet. */
  onboarding: {},
  /** One-off jobs carry no repeatable booking params, so repeats resolve to 1. */
  repeatSources: [],
  /** No vertical-only behaviour — handyman is the generic one-off job path. */
  extensions: [],
};
