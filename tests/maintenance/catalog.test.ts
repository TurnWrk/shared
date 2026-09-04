import { describe, expect, it } from 'vitest';
import {
  AMENITY_MAINTENANCE_CATALOG,
  ASSET_MAINTENANCE_CATALOG,
  MAINTENANCE_TRADES,
  classifyAsset,
} from '../../src/maintenance';
import type { PreventiveTaskSpec } from '../../src/maintenance';

const allTasks: PreventiveTaskSpec[] = [
  ...AMENITY_MAINTENANCE_CATALOG.flatMap((s) => [...s.preventive]),
  ...ASSET_MAINTENANCE_CATALOG.flatMap((s) => [...s.preventive]),
];

describe('amenity catalog shape', () => {
  it('lists each amenity class once', () => {
    const keys = AMENITY_MAINTENANCE_CATALOG.map((s) => s.amenity);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every preventive task a unique key across amenities and assets', () => {
    const keys = allTasks.map((t) => t.key);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dupes).toEqual([]);
  });

  it('keeps cadences expressible as a PM schedule and minutes as positive integers', () => {
    for (const t of allTasks) {
      expect(t.cadenceValue, t.key).toBeGreaterThan(0);
      expect(Number.isInteger(t.cadenceValue), t.key).toBe(true);
      expect(['days', 'weeks', 'months']).toContain(t.cadenceUnit);
      expect(Number.isInteger(t.minutes) && t.minutes > 0, t.key).toBe(true);
      expect(MAINTENANCE_TRADES).toContain(t.trade);
      expect(['High', 'Medium', 'Low']).toContain(t.priority);
      expect(t.sections.length, t.key).toBeGreaterThan(0);
      for (const section of t.sections) {
        const ids = section.items.map((i) => i.id);
        expect(new Set(ids).size, `${t.key}/${section.id}`).toBe(ids.length);
        expect(section.items.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps per-turn item ids unique across the whole walk', () => {
    const ids = AMENITY_MAINTENANCE_CATALOG.flatMap((s) => s.perTurn?.items.map((i) => i.id) ?? []);
    const dupes = ids.filter((k, i) => ids.indexOf(k) !== i);
    expect(dupes).toEqual([]);
    for (const s of AMENITY_MAINTENANCE_CATALOG) {
      if (!s.perTurn) continue;
      expect(Number.isInteger(s.perTurn.minutes) && s.perTurn.minutes > 0, s.amenity).toBe(true);
      // Namespaced `<amenity>.<check>` so a composed walk never collides across sections.
      for (const item of s.perTurn.items) expect(item.id, item.id).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  it('routes corrective calls to a known trade', () => {
    for (const s of [...AMENITY_MAINTENANCE_CATALOG, ...ASSET_MAINTENANCE_CATALOG]) {
      if (!s.corrective) continue;
      expect(MAINTENANCE_TRADES).toContain(s.corrective.trade);
      expect(s.corrective.callsPerYear).toBeGreaterThan(0);
      expect(s.corrective.minutes).toBeGreaterThan(0);
    }
  });

  it('starts the walk at the pool', () => {
    expect(AMENITY_MAINTENANCE_CATALOG[0]?.amenity).toBe('pool');
  });
});

describe('classifyAsset', () => {
  it('recognises equipment from free text on the register', () => {
    expect(classifyAsset({ id: 'a1', name: 'Water heater', brand: 'Rheem', model: '50 gal' })).toBe('water_heater');
    expect(classifyAsset({ id: 'a2', name: 'Pool heat pump', brand: 'AquaCal' })).toBe('pool_heater');
    expect(classifyAsset({ id: 'a3', name: 'Variable speed pump', brand: 'Pentair' })).toBe('pool_pump');
    expect(classifyAsset({ id: 'a4', name: 'Front door', model: 'Schlage Encode' })).toBe('smart_lock');
    expect(classifyAsset({ id: 'a5', name: 'Garage opener', brand: 'LiftMaster' })).toBe('garage_door');
  });

  it('prefers the pool heater over the pool pump when both words appear', () => {
    expect(classifyAsset({ id: 'a6', name: 'Pentair pool heater' })).toBe('pool_heater');
  });

  it('returns null rather than guessing', () => {
    expect(classifyAsset({ id: 'a7', name: 'Dining table' })).toBeNull();
    expect(classifyAsset({ id: 'a8', name: '' })).toBeNull();
  });
});
