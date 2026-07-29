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
  VERTICAL_EXTENSION_KEYS,
  VERTICAL_KEYS,
  authoredVerticalKeys,
  packFor,
} from '../src/verticals';
import type { VerticalPack } from '../src/verticals';
import { DEFAULT_CLEAN_FREQUENCIES } from '../src/types/clean';
import { DEFAULT_CLEAN_TEMPLATES } from '../src/notifications/defaults';
import { catalogById } from '../src/onboarding/catalogs';

const AUTHORED: VerticalPack[] = [CLEANING_PACK, STR_TURNOVER_PACK];

describe('registry completeness', () => {
  it('registers every authored pack under its own key', () => {
    for (const pack of AUTHORED) {
      expect(packFor(pack.key)).toBe(pack);
    }
  });

  it('authors exactly the phase-A trades', () => {
    // Canary, not a limit: phase E adds pool / lawn / handyman and updates this
    // list deliberately. VERTICAL_KEYS stays the full domain meanwhile.
    expect(authoredVerticalKeys()).toEqual(['cleaning', 'str_turnover']);
    expect(VERTICAL_KEYS).toContain('pool');
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

  it('inherits the shipped notification copy verbatim', () => {
    // Packs carry overrides; a pack with none renders the code defaults. This
    // is what makes the phase-B golden test (TURNWRK-317) reachable.
    const merged = { ...DEFAULT_CLEAN_TEMPLATES, ...CLEANING_PACK.notificationCopy };
    expect(merged).toEqual(DEFAULT_CLEAN_TEMPLATES);
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
