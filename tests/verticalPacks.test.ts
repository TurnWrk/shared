/**
 * Phase A gate (TURNWRK-316): the two behaviours that ship today must be
 * expressible as packs. These tests assert the pack reads back identical to the
 * constant it describes — if that stops holding, the pack shape is wrong and
 * phase B's flip (TURNWRK-317) would silently change customer-facing behaviour.
 */
import { describe, it, expect } from 'vitest';
import {
  CLEANING_PACK,
  STR_TURNOVER_PACK,
  HANDYMAN_PACK,
  POOL_PACK,
  LANDSCAPING_PACK,
  VERTICAL_EXTENSION_KEYS,
  VERTICAL_KEYS,
  authoredVerticalKeys,
  packFor,
  resolveOrgVerticals,
  resolvePrimaryVertical,
} from '../src/verticals';
import type { VerticalPack } from '../src/verticals';
import type { Org } from '../src/types/org';
import { DEFAULT_CLEAN_FREQUENCIES } from '../src/types/clean';
import type { CleanFrequency, CleanFrequencyKey } from '../src/types/clean';
import { DEFAULT_CLEAN_TEMPLATES } from '../src/notifications/defaults';
import { catalogById } from '../src/onboarding/catalogs';

const AUTHORED: VerticalPack[] = [
  CLEANING_PACK,
  STR_TURNOVER_PACK,
  POOL_PACK,
  LANDSCAPING_PACK,
  HANDYMAN_PACK,
];

describe('registry completeness', () => {
  it('registers every authored pack under its own key', () => {
    for (const pack of AUTHORED) {
      expect(packFor(pack.key)).toBe(pack);
    }
  });

  it('authors every trade in VERTICAL_KEYS order', () => {
    // Phase E (TURNWRK-329) completed the set — every VerticalKey now has a pack,
    // in registry order. If a future key is added unauthored this fails loudly.
    expect(authoredVerticalKeys()).toEqual([
      'cleaning',
      'str_turnover',
      'pool',
      'landscaping',
      'handyman',
    ]);
    expect(authoredVerticalKeys()).toEqual([...VERTICAL_KEYS]);
  });

  it('references only extension keys that exist', () => {
    for (const pack of AUTHORED) {
      for (const ext of pack.extensions) {
        expect(VERTICAL_EXTENSION_KEYS).toContain(ext);
      }
    }
  });

  it('references only onboarding catalogs that exist', () => {
    for (const pack of AUTHORED) {
      const id = pack.onboarding.catalogId;
      if (id) expect(catalogById(id)).toBeDefined();
    }
  });

  it('gives every pack a non-empty terminology set', () => {
    for (const pack of AUTHORED) {
      for (const [field, value] of Object.entries(pack.terminology)) {
        expect(value, `${pack.key}.terminology.${field}`).toMatch(/\S/);
      }
    }
  });

  it('keeps cadence keys unique within a pack', () => {
    for (const pack of AUTHORED) {
      const keys = pack.cadences.map((c) => c.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('keeps service-seed keys unique within a pack', () => {
    for (const pack of AUTHORED) {
      const keys = pack.serviceSeeds.map((s) => s.key);
      expect(new Set(keys).size, pack.key).toBe(keys.length);
    }
  });

  it('only attaches checklistKeys the pack actually declares', () => {
    for (const pack of AUTHORED) {
      const templateKeys = new Set(pack.checklistTemplates.map((t) => t.key));
      for (const seed of pack.serviceSeeds) {
        if (seed.checklistKey) {
          expect(templateKeys, `${pack.key}.${seed.key}`).toContain(seed.checklistKey);
        }
      }
    }
  });

  it('gives every priced seed a positive duration and non-negative price', () => {
    for (const pack of AUTHORED) {
      for (const seed of pack.serviceSeeds) {
        expect(seed.baseMinutes, `${pack.key}.${seed.key}`).toBeGreaterThan(0);
        expect(seed.basePriceMinor, `${pack.key}.${seed.key}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('phase-E packs (TURNWRK-329)', () => {
  const org = (patch: Partial<Org>): Org =>
    ({ id: 'o1', name: 'Org', createdAt: 0, updatedAt: 0, ...patch }) as Org;

  it('handyman is a one-off repair job with a starting catalog', () => {
    expect(HANDYMAN_PACK.workOrderType).toBe('Repair');
    expect(HANDYMAN_PACK.cadences).toEqual([
      { key: 'once', widgetLabel: 'One-time', discountPct: 0 },
    ]);
    expect(HANDYMAN_PACK.extensions).toEqual([]);
    // Unlike cleaning/str_turnover, handyman ships seeds — it has no prior
    // behaviour to mirror, so the seeds ARE the starting catalog.
    expect(HANDYMAN_PACK.serviceSeeds.length).toBeGreaterThan(0);
  });

  it('pool books recurring visits and opts into water chemistry', () => {
    expect(POOL_PACK.workOrderType).toBe('Cleaning');
    const cadenceKeys = POOL_PACK.cadences.map((c) => c.key);
    expect(cadenceKeys).toContain('weekly');
    expect(cadenceKeys).toContain('every_10_days'); // the 10-day cadence the card names
    // proof-of-service is modelled by the proof_report extension (the cleaning
    // precedent); water_chemistry flags the readings widget (TURNWRK-294).
    expect(POOL_PACK.extensions).toContain('water_chemistry');
    expect(POOL_PACK.extensions).toContain('proof_report');
    // The service checklist is physical tasks only — no chemistry readings here.
    expect(POOL_PACK.checklistTemplates.map((t) => t.key)).toContain('pool_visit');
    expect(POOL_PACK.checklistTemplates.map((t) => t.key)).toContain('pool_water_chemistry');
  });

  it('landscaping carries mow cadences plus a seasonal shift', () => {
    expect(LANDSCAPING_PACK.key).toBe('landscaping'); // renamed from `lawn`
    expect(LANDSCAPING_PACK.workOrderType).toBe('Cleaning');
    const cadenceKeys = LANDSCAPING_PACK.cadences.map((c) => c.key);
    expect(cadenceKeys).toContain('weekly');
    expect(cadenceKeys).toContain('seasonal');
    expect(LANDSCAPING_PACK.extensions).toEqual(['seasonal_billing', 'rain_reschedule']);
  });

  it('phase-E packs without notification overrides inherit neutral defaults', () => {
    for (const pack of [HANDYMAN_PACK, LANDSCAPING_PACK]) {
      const merged = { ...DEFAULT_CLEAN_TEMPLATES, ...pack.notificationCopy };
      expect(merged, pack.key).toEqual(DEFAULT_CLEAN_TEMPLATES);
    }
  });

  it('pool pack supplies trade-appropriate notification copy', () => {
    const merged = { ...DEFAULT_CLEAN_TEMPLATES, ...POOL_PACK.notificationCopy };
    expect(merged.worker_en_route.channels.email?.subject).toBe(
      '{{org.name}}: your tech is on the way',
    );
    expect(merged.review_request.channels.email?.subject).toBe(
      'How was your {{org.name}} pool service?',
    );
  });

  it('pool starter catalog matches TURNWRK-339 (weekly + bi-weekly, no equipment SKU)', () => {
    const keys = POOL_PACK.serviceSeeds.map((s) => s.key);
    expect(keys).toEqual([
      'weekly_pool_service',
      'biweekly_pool_service',
      'pool_opening',
      'pool_closing',
      'filter_clean',
      'green_to_clean',
    ]);
    expect(keys).not.toContain('equipment_check');
    expect(POOL_PACK.terminology.worker).toBe('tech');
    expect(POOL_PACK.terminology.workerPlural).toBe('techs');
    expect(POOL_PACK.cadences.map((c) => c.key)).toContain('fortnightly');

    const chemistry = POOL_PACK.checklistTemplates.find((t) => t.key === 'pool_water_chemistry');
    const readings = chemistry?.sections[0]?.items ?? [];
    const byId = Object.fromEntries(readings.map((i) => [i.id, i]));
    expect(byId.chlorine?.minValue).toBe(1);
    expect(byId.chlorine?.maxValue).toBe(10);
    expect(byId.ph?.minValue).toBe(7.0);
    expect(byId.ph?.maxValue).toBe(7.8);
    expect(byId.cya?.maxValue).toBe(90);

    const visit = POOL_PACK.checklistTemplates.find((t) => t.key === 'pool_visit');
    expect(visit?.sections[0]?.items.some((i) => i.id === 'equipment' && i.required)).toBe(true);
  });

  it('a multi-service org resolves terminology from primaryVertical and offers both catalogs', () => {
    // The card's acceptance: verticals: ['pool','handyman'] resolves terminology
    // from primaryVertical and offers both packs' services in one catalog.
    const multi = org({ verticals: ['pool', 'handyman'], primaryVertical: 'pool' });
    expect(resolveOrgVerticals(multi)).toEqual(['pool', 'handyman']);
    expect(resolvePrimaryVertical(multi)).toBe('pool');

    const primary = packFor(resolvePrimaryVertical(multi)!)!;
    expect(primary.terminology.job).toBe('visit'); // pool terminology wins

    const offered = resolveOrgVerticals(multi).flatMap((k) => packFor(k)!.serviceSeeds);
    const offeredKeys = offered.map((s) => s.key);
    expect(offeredKeys).toContain('weekly_pool_service'); // a recurring pool visit
    expect(offeredKeys).toContain('biweekly_pool_service');
    expect(offeredKeys).toContain('handyman_hourly'); // a one-off repair
  });
});

describe('cleaning pack reproduces today’s cleaning behaviour', () => {
  it('stamps the work-order type Clean bookings already use', () => {
    expect(CLEANING_PACK.workOrderType).toBe('Cleaning');
  });

  it('declares cadences identical to DEFAULT_CLEAN_FREQUENCIES', () => {
    expect(CLEANING_PACK.cadences).toEqual(DEFAULT_CLEAN_FREQUENCIES);
  });

  it('covers exactly the four CleanFrequencyKey values', () => {
    expect(CLEANING_PACK.cadences.map((c) => c.key)).toEqual([
      'once',
      'weekly',
      'fortnightly',
      'monthly',
    ]);
  });

  it('restores cleaning-specific notification copy over neutral defaults', () => {
    const merged = { ...DEFAULT_CLEAN_TEMPLATES, ...CLEANING_PACK.notificationCopy };
    expect(merged.booking_assigned.channels.email?.heading).toBe('Your cleaner is assigned');
    expect(merged).not.toEqual(DEFAULT_CLEAN_TEMPLATES);
    expect(merged.receipt).toEqual(DEFAULT_CLEAN_TEMPLATES.receipt);
  });

  it('drives checklist repeats off the labels seed.ts already matches', () => {
    expect(CLEANING_PACK.repeatSources).toEqual(['bed', 'bath']);
  });

  it('ships TURNWRK-339 starter seeds (net-new; opt-in for F3 seeding)', () => {
    // DECISION 2026-08-06: empty seeds were deliberate in TURNWRK-316 so phase-B
    // goldens could not pass against invented catalog data. Alan approved
    // Standard / Deep / Move-Out as starter SKUs — opt-in for new vertical
    // choice (TURNWRK-332), not a rewrite of existing org catalogs. This
    // assertion flip is intentional and called out in the ship note / PR body.
    expect(CLEANING_PACK.serviceSeeds.map((s) => s.key)).toEqual([
      'standard_clean',
      'deep_clean',
      'move_out_clean',
    ]);
    expect(CLEANING_PACK.checklistTemplates.map((t) => t.key)).toEqual([
      'standard_clean_visit',
      'deep_clean_visit',
      'move_out_clean_visit',
    ]);
  });
});

describe('str_turnover pack', () => {
  it('stamps the occupancy-driven work-order type', () => {
    expect(STR_TURNOVER_PACK.workOrderType).toBe('Turnover');
  });

  it('opts into the occupancy extension', () => {
    expect(STR_TURNOVER_PACK.extensions).toEqual(['occupancy']);
  });

  it('offers one-off scheduling only — turnovers follow checkouts', () => {
    expect(STR_TURNOVER_PACK.cadences).toEqual([
      { key: 'once', widgetLabel: 'One-time', discountPct: 0 },
    ]);
  });

  it('names the payer the owner, not a booking customer', () => {
    expect(STR_TURNOVER_PACK.terminology.customer).toBe('owner');
    expect(CLEANING_PACK.terminology.customer).toBe('customer');
  });

  it('inherits the shipped notification copy verbatim', () => {
    const merged = { ...DEFAULT_CLEAN_TEMPLATES, ...STR_TURNOVER_PACK.notificationCopy };
    expect(merged).toEqual(DEFAULT_CLEAN_TEMPLATES);
  });
});

describe('cadence keys are open to pack declarations (TURNWRK-318)', () => {
  it('still accepts the four cleaning literals', () => {
    const keys: CleanFrequencyKey[] = ['once', 'weekly', 'fortnightly', 'monthly'];
    expect(keys).toEqual(CLEANING_PACK.cadences.map((c) => c.key));
  });

  it('accepts a cadence key the old enum could not express', () => {
    // The pool case the card names: 10-day and seasonal cycles.
    const tenDay: CleanFrequency = { key: 'every_10_days', widgetLabel: 'Every 10 days', discountPct: 15 };
    const seasonal: CleanFrequency = { key: 'seasonal', widgetLabel: 'Seasonal', discountPct: 0 };
    expect([tenDay.key, seasonal.key]).toEqual(['every_10_days', 'seasonal']);
  });

  it('lets a pack cadence be used directly as a catalog frequency', () => {
    // VerticalCadence and CleanFrequency stay structurally identical, so a pack
    // can seed catalog.frequencies with no mapping layer.
    const asFrequencies: CleanFrequency[] = [...CLEANING_PACK.cadences];
    expect(asFrequencies).toEqual(DEFAULT_CLEAN_FREQUENCIES);
  });
});
