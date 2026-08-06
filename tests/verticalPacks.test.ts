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
      '{{org.name}}: your technician is on the way',
    );
    expect(merged.review_request.channels.email?.subject).toBe(
      'How was your {{org.name}} pool service?',
    );
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

  it('carries no seeds, because none ship today', () => {
    // Deliberate: orgs author their own catalog and checklist templates. An
    // invented default would make the phase-B golden test pass dishonestly.
    expect(CLEANING_PACK.serviceSeeds).toEqual([]);
    expect(CLEANING_PACK.checklistTemplates).toEqual([]);
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
