import { describe, it, expect } from 'vitest';
import {
  storageLocationFromRestockRow,
  pickRestockStorageForPurpose,
  resolvePropertyStorageSlots,
  applyResolvedStorageToMaintenance,
} from '../src/propertyStorage';

describe('storageLocationFromRestockRow', () => {
  it('maps location + image + access note', () => {
    expect(
      storageLocationFromRestockRow({
        locationDescription: 'Hall closet',
        imageUrl: 'https://example.com/a.jpg',
        accessNote: 'Staff only',
        isActive: true,
      }),
    ).toEqual({
      location: 'Hall closet',
      imageUrl: 'https://example.com/a.jpg',
      accessRestrictionNote: 'Staff only',
    });
  });

  it('skips inactive and empty rows', () => {
    expect(
      storageLocationFromRestockRow({
        locationDescription: 'x',
        isActive: false,
      }),
    ).toBeNull();
    expect(storageLocationFromRestockRow({ purpose: 'owner' })).toBeNull();
  });
});

describe('resolvePropertyStorageSlots dual-read', () => {
  const legacy = {
    ownerStorage: { location: 'Legacy owner closet' },
    cleaningStorage: { location: 'Legacy cleaning shelf' },
  };

  it('falls back to maintenance when no restock rows (old doc)', () => {
    expect(resolvePropertyStorageSlots({ maintenance: legacy, restockRows: [] })).toEqual(
      legacy,
    );
  });

  it('prefers restock_storage over maintenance (new doc)', () => {
    expect(
      resolvePropertyStorageSlots({
        maintenance: legacy,
        restockRows: [
          {
            purpose: 'owner',
            locationDescription: 'Canonical owner',
            imageUrl: 'https://cdn/o.jpg',
            isActive: true,
            updatedAt: 100,
          },
          {
            purpose: 'cleaning',
            locationDescription: 'Canonical cleaning',
            isActive: true,
            updatedAt: 200,
          },
        ],
      }),
    ).toEqual({
      ownerStorage: {
        location: 'Canonical owner',
        imageUrl: 'https://cdn/o.jpg',
      },
      cleaningStorage: { location: 'Canonical cleaning' },
    });
  });

  it('picks newest restock row per purpose', () => {
    expect(
      pickRestockStorageForPurpose(
        [
          {
            purpose: 'owner',
            locationDescription: 'older',
            isActive: true,
            updatedAt: 1,
          },
          {
            purpose: 'owner',
            locationDescription: 'newer',
            isActive: true,
            updatedAt: { seconds: 99 },
          },
        ],
        'owner',
      )?.location,
    ).toBe('newer');
  });

  it('applies slots onto property.maintenance without dropping other fields', () => {
    const property = {
      id: 'p1',
      maintenance: {
        accessCode: '1234',
        ownerStorage: { location: 'Legacy' },
      },
    };
    const merged = applyResolvedStorageToMaintenance(property, [
      {
        purpose: 'owner',
        locationDescription: 'From restock',
        isActive: true,
      },
    ]);
    expect(merged.maintenance?.accessCode).toBe('1234');
    expect(merged.maintenance?.ownerStorage?.location).toBe('From restock');
  });
});
