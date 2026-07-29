/**
 * The `cleaning` pack (TURNWRK-316) — today's Turnwrk Clean behaviour restated
 * as data. Nothing consumes it yet; phase B (TURNWRK-317) flips the three
 * cleaning-coded sites onto it behind a golden test.
 *
 * Every value here mirrors a constant that already ships, and
 * tests/verticalPacks.test.ts asserts the mirror rather than trusting it. Where
 * no shipped constant exists the field is empty with the reason stated — the
 * point of this card is to find out whether the pack shape can hold today's
 * behaviour, which an invented default would hide.
 */
import type { VerticalPack } from '../types';

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
   * Empty on purpose: no default catalog ships. Operators author services in
   * ServicesConfigView (clean/src/components/clean/ServicesConfigView.tsx:629
   * starts a blank service at basePriceMinor 0) and pricing reads
   * `clean_catalogs/{orgId}`. Seeds would be invention, not a mirror.
   */
  serviceSeeds: [],
  /**
   * Also empty on purpose: today's cleaning checklist is an org-owned
   * cmms_pmTemplates doc referenced by `CleanService.checklistTemplateId` or
   * `Org.cmms.checklistDefaults['Cleaning']` (resolveCleanChecklistTemplateId,
   * clean/src/lib/clean/server.ts:59-66). No code-owned template exists to
   * mirror; `workOrderType` above is the key that lookup already uses.
   */
  checklistTemplates: [],
  /** No overrides — cleaning IS the copy in DEFAULT_CLEAN_TEMPLATES. */
  notificationCopy: {},
  onboarding: { catalogId: 'clean-operator' },
  /**
   * The substrings resolveRepeatCount matches against `repeatPerParamLabel`
   * before falling back to property counts (src/checklist/seed.ts:65-70).
   */
  repeatSources: ['bed', 'bath'],
  /**
   * Proof-of-service reports ship on for Clean orgs
   * (CleanOrgSettings.visitReportEnabled, "default true" — src/types/clean.ts).
   */
  extensions: ['proof_report'],
};
