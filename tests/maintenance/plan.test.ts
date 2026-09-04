import { describe, expect, it } from 'vitest';
import {
  DAYS_PER_MONTH,
  hoursCeil,
  occurrencesPerMonth,
  planForProperty,
} from '../../src/maintenance';
import type { MaintenancePlan } from '../../src/maintenance';
import {
  PALMSHINE_ALL_AMENITIES,
  PALMSHINE_AIRBNB_AMENITIES,
  PALMSHINE_TURNS_PER_MONTH,
} from './fixtures/palmshine';

function tradeRow(plan: MaintenancePlan, trade: string) {
  return plan.load.byTrade.find((r) => r.trade === trade);
}

describe('occurrencesPerMonth', () => {
  it('amortises a cadence over an average month', () => {
    expect(occurrencesPerMonth(7, 'days')).toBeCloseTo(DAYS_PER_MONTH / 7, 6);
    expect(occurrencesPerMonth(2, 'weeks')).toBeCloseTo(DAYS_PER_MONTH / 14, 6);
    expect(occurrencesPerMonth(3, 'months')).toBeCloseTo(1 / 3, 6);
    expect(occurrencesPerMonth(0, 'days')).toBe(0);
  });
});

describe('planForProperty: three-amenity baseline', () => {
  const plan = planForProperty({ amenities: ['kitchen', 'laundry', 'pool'], turnsPerMonth: 4 });

  it('creates one schedule per preventive task, in catalog order', () => {
    expect(plan.schedules.map((s) => s.key)).toEqual([
      'pool_service_verification',
      'pool_equipment_inspection',
      'pool_filter_clean',
      'kitchen_appliance_service',
      'dryer_vent_clean',
    ]);
    expect(plan.matchedAmenities).toEqual(['pool', 'kitchen', 'laundry']);
  });

  it('composes the per-turn inspection from each amenity section', () => {
    expect(plan.perTurnInspection.sections.map((s) => s.id)).toEqual([
      'amenity.pool',
      'amenity.kitchen',
      'amenity.laundry',
    ]);
    // 10 + 3 + 2 minutes per walk.
    expect(plan.perTurnInspection.minutes).toBe(15);
    expect(plan.load.perTurnMinutesPerTurn).toBe(15);
    expect(plan.load.perTurnMinutesPerMonth).toBe(60);
  });

  it('splits the load by trade with the handyman in-house by default', () => {
    const handyman = tradeRow(plan, 'handyman');
    const pool = tradeRow(plan, 'pool');
    const appliance = tradeRow(plan, 'appliance');
    expect(handyman?.inHouse).toBe(true);
    expect(pool?.inHouse).toBe(false);
    expect(appliance?.inHouse).toBe(false);
    // Per-turn walks are always the field seat's minutes.
    expect(handyman?.perTurnMinutesPerMonth).toBe(60);
    // Weekly verification (15 min) plus a quarterly filter clean (60 min).
    expect(pool?.preventiveMinutesPerMonth).toBe(Math.round((DAYS_PER_MONTH / 7) * 15 + 60 / 3));
    // Six pool calls a year at an hour each.
    expect(pool?.correctiveMinutesPerMonth).toBe(30);
  });

  it('sums by-trade rows into the totals exactly', () => {
    const rows = plan.load.byTrade;
    const sum = (k: 'perTurnMinutesPerMonth' | 'preventiveMinutesPerMonth' | 'correctiveMinutesPerMonth' | 'totalMinutesPerMonth') =>
      rows.reduce((acc, r) => acc + r[k], 0);
    expect(plan.load.perTurnMinutesPerMonth).toBe(sum('perTurnMinutesPerMonth'));
    expect(plan.load.preventiveMinutesPerMonth).toBe(sum('preventiveMinutesPerMonth'));
    expect(plan.load.correctiveMinutesPerMonth).toBe(sum('correctiveMinutesPerMonth'));
    expect(plan.load.totalMinutesPerMonth).toBe(sum('totalMinutesPerMonth'));
    expect(plan.load.inHouseMinutesPerMonth + plan.load.specialtyMinutesPerMonth).toBe(plan.load.totalMinutesPerMonth);
    for (const r of rows) {
      expect(r.totalMinutesPerMonth).toBe(r.perTurnMinutesPerMonth + r.preventiveMinutesPerMonth + r.correctiveMinutesPerMonth);
      expect(Number.isInteger(r.totalMinutesPerMonth)).toBe(true);
    }
  });

  it('is deterministic', () => {
    const again = planForProperty({ amenities: ['kitchen', 'laundry', 'pool'], turnsPerMonth: 4 });
    expect(again).toEqual(plan);
  });
});

describe('planForProperty: options and edges', () => {
  it('honours the org in-house trade list', () => {
    const plan = planForProperty({ amenities: ['pool'], turnsPerMonth: 4, inHouseTrades: ['handyman', 'pool'] });
    expect(tradeRow(plan, 'pool')?.inHouse).toBe(true);
    expect(plan.schedules.every((s) => s.inHouse)).toBe(true);
    expect(plan.load.specialtyMinutesPerMonth).toBe(0);
  });

  it('zero turns means no per-turn load but the preventive plan still stands', () => {
    const plan = planForProperty({ amenities: ['pool'], turnsPerMonth: 0 });
    expect(plan.load.perTurnMinutesPerMonth).toBe(0);
    expect(plan.perTurnInspection.minutes).toBe(10);
    expect(plan.schedules.length).toBe(3);
  });

  it('keeps unknown labels visible and leaves ignored labels out of the plan', () => {
    const plan = planForProperty({ amenities: ['Pool', 'Helipad', 'Shampoo', 'Unavailable: Hot tub'], turnsPerMonth: 1 });
    expect(plan.matchedAmenities).toEqual(['pool']);
    expect(plan.unmappedAmenities).toEqual(['Helipad']);
    expect(plan.ignoredAmenities).toEqual(['Shampoo', 'Unavailable: Hot tub']);
  });

  it('adds asset-driven schedules once per class and reports unknown assets', () => {
    const plan = planForProperty({
      amenities: [],
      turnsPerMonth: 2,
      assets: [
        { id: 'wh', name: 'Water heater', brand: 'Rheem' },
        { id: 'ac1', name: 'Air handler', brand: 'Carrier' },
        { id: 'ac2', name: 'Condenser', brand: 'Carrier', location: 'side yard' },
        { id: 'x', name: 'Dining table' },
      ],
    });
    expect(plan.matchedAssets).toEqual([
      { assetId: 'wh', assetClass: 'water_heater' },
      { assetId: 'ac1', assetClass: 'hvac_unit' },
      { assetId: 'ac2', assetClass: 'hvac_unit' },
    ]);
    expect(plan.unmappedAssets).toEqual(['Dining table']);
    expect(plan.schedules.map((s) => s.key)).toEqual(['asset_water_heater_flush', 'asset_hvac_tune_up']);
    expect(plan.schedules[1]?.source).toEqual({ kind: 'asset', assetClass: 'hvac_unit', assetId: 'ac1' });
    expect(tradeRow(plan, 'plumbing')?.inHouse).toBe(false);
  });

  it('rounds hours up for a retainer', () => {
    expect(hoursCeil(61)).toBe(2);
    expect(hoursCeil(60)).toBe(1);
    expect(hoursCeil(0)).toBe(0);
  });
});

describe('planForProperty: Palmshine Hideaway', () => {
  const plan = planForProperty({ amenities: PALMSHINE_ALL_AMENITIES, turnsPerMonth: PALMSHINE_TURNS_PER_MONTH });

  it('places every row of the live Airbnb amenities modal', () => {
    const modalOnly = planForProperty({ amenities: PALMSHINE_AIRBNB_AMENITIES, turnsPerMonth: PALMSHINE_TURNS_PER_MONTH });
    expect(modalOnly.unmappedAmenities).toEqual([]);
    expect(modalOnly.matchedAmenities).toEqual(
      expect.arrayContaining(['pool', 'hot-tub', 'arcade', 'game-room', 'putting-green', 'fire-pit', 'outdoor-grill', 'hvac', 'laundry', 'kitchen', 'safety-equipment']),
    );
    // The Not included rows are absences, not gaps.
    expect(modalOnly.ignoredAmenities).toEqual(expect.arrayContaining(['Unavailable: Essentials', 'Unavailable: Private entrance']));
  });

  it('picks up the description-only outdoor features', () => {
    expect(plan.unmappedAmenities).toEqual([]);
    expect(plan.matchedAmenities).toEqual(
      expect.arrayContaining(['heated-pool', 'pickleball-court', 'basketball-hoop', 'outdoor-bar']),
    );
  });

  it('is a heavy home: a long walk, many schedules, and at least four trades', () => {
    expect(plan.perTurnInspection.minutes).toBeGreaterThanOrEqual(60);
    expect(plan.schedules.length).toBeGreaterThanOrEqual(20);
    const trades = plan.load.byTrade.map((r) => r.trade);
    expect(trades).toEqual(expect.arrayContaining(['handyman', 'pool', 'arcade', 'court_surface']));
    expect(trades.length).toBeGreaterThanOrEqual(4);
    expect(tradeRow(plan, 'handyman')?.inHouse).toBe(true);
    expect(tradeRow(plan, 'pool')?.inHouse).toBe(false);
    expect(plan.load.inHouseMinutesPerMonth).toBeGreaterThan(plan.load.specialtyMinutesPerMonth);
    expect(hoursCeil(plan.load.totalMinutesPerMonth)).toBeGreaterThan(10);
  });

  it('has a pool chemistry reading on the walk, so the numeric widget gets used', () => {
    const poolSection = plan.perTurnInspection.sections.find((s) => s.id === 'amenity.pool');
    expect(poolSection?.items.some((i) => i.inputType === 'number' && i.id === 'pool.chlorine')).toBe(true);
  });
});
