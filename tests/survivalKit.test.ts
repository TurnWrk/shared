import { describe, it, expect } from 'vitest';
import {
  isValidSurvivalKitLine,
  normalizeSurvivalKitLines,
  survivalKitUnitCount,
} from '../src/types/survivalKit';

/**
 * TURNWRK-33 — the kit is a description a cleaner reads, so a line that cannot
 * be rendered has no business being stored.
 */

describe('isValidSurvivalKitLine', () => {
  it('accepts a named line with a positive quantity', () => {
    expect(isValidSurvivalKitLine({ name: 'Trash bags', quantity: 4 })).toBe(true);
  });

  it('rejects a line nobody could read', () => {
    expect(isValidSurvivalKitLine({ name: '', quantity: 4 })).toBe(false);
    expect(isValidSurvivalKitLine({ name: '   ', quantity: 4 })).toBe(false);
    expect(isValidSurvivalKitLine({ quantity: 4 })).toBe(false);
  });

  it('rejects a quantity that is not a countable number of things', () => {
    expect(isValidSurvivalKitLine({ name: 'Soap', quantity: 0 })).toBe(false);
    expect(isValidSurvivalKitLine({ name: 'Soap', quantity: -2 })).toBe(false);
    expect(isValidSurvivalKitLine({ name: 'Soap', quantity: Number.NaN })).toBe(false);
    expect(isValidSurvivalKitLine({ name: 'Soap', quantity: '4' })).toBe(false);
  });

  it('rejects non-objects outright', () => {
    expect(isValidSurvivalKitLine(null)).toBe(false);
    expect(isValidSurvivalKitLine('Trash bags')).toBe(false);
  });
});

describe('normalizeSurvivalKitLines', () => {
  it('drops unusable lines instead of storing them', () => {
    expect(
      normalizeSurvivalKitLines([
        { name: 'Trash bags', quantity: 4 },
        { name: '', quantity: 4 },
        { name: 'Soap', quantity: 0 },
      ]),
    ).toEqual([{ name: 'Trash bags', quantity: 4 }]);
  });

  it('omits blank optional fields rather than writing empty strings', () => {
    // No undefined and no '' may reach a Firestore payload — a productId of ''
    // reads as a catalog link that resolves to nothing.
    const [line] = normalizeSurvivalKitLines([
      { name: ' Trash bags ', quantity: 2, productId: '  ', itemType: '' },
    ]);
    expect(line).toEqual({ name: 'Trash bags', quantity: 2 });
    expect('productId' in line).toBe(false);
    expect('itemType' in line).toBe(false);
  });

  it('sums duplicates of the same product rather than listing it twice', () => {
    expect(
      normalizeSurvivalKitLines([
        { name: 'Toilet paper', productId: 'p-1', quantity: 2 },
        { name: 'TP (bulk)', productId: 'p-1', quantity: 3 },
      ]),
    ).toEqual([{ name: 'Toilet paper', productId: 'p-1', quantity: 5 }]);
  });

  it('falls back to itemType then to the name when matching duplicates', () => {
    expect(
      normalizeSurvivalKitLines([
        { name: 'Trash bags', itemType: 'trash_bags', quantity: 1 },
        { name: 'Bin liners', itemType: 'trash_bags', quantity: 2 },
        { name: 'Sponge', quantity: 1 },
        { name: 'sponge', quantity: 1 },
      ]),
    ).toEqual([
      { name: 'Trash bags', itemType: 'trash_bags', quantity: 3 },
      { name: 'Sponge', quantity: 2 },
    ]);
  });

  it('survives junk input', () => {
    expect(normalizeSurvivalKitLines(undefined)).toEqual([]);
    expect(normalizeSurvivalKitLines('trash bags')).toEqual([]);
    expect(normalizeSurvivalKitLines([null, 7, {}])).toEqual([]);
  });
});

describe('survivalKitUnitCount', () => {
  it('counts units, not lines — a kit of 3 lines can be 12 things', () => {
    expect(
      survivalKitUnitCount({
        lines: [
          { name: 'Trash bags', quantity: 4 },
          { name: 'Toilet paper', quantity: 6 },
          { name: 'Sponge', quantity: 2 },
        ],
      }),
    ).toBe(12);
  });

  it('is zero for an empty kit', () => {
    expect(survivalKitUnitCount({ lines: [] })).toBe(0);
  });
});
