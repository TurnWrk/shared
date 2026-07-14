import { describe, it, expect } from 'vitest';
import {
  buildIntegrationMatchKey,
  legacyAkitaWorkOrderToIntegrationMetadata,
  legacyAkitaMaintenanceToCanonicalPatches,
} from '../src/integrationBackfill';
import { getIntegrationOwnerSnapshot } from '../src/types/integration';

describe('buildIntegrationMatchKey', () => {
  it('normalizes source, wo id, and title', () => {
    expect(buildIntegrationMatchKey('Akita', ' WO-1 ', 'Fix  Sink')).toBe(
      'src:akita|wo:wo-1|title:fix-sink',
    );
  });

  it('includes optional externalItemId', () => {
    expect(buildIntegrationMatchKey('akita', 'wo-1', 't', 'item-9')).toBe(
      'src:akita|wo:wo-1|item:item-9|title:t',
    );
  });
});

describe('legacyAkitaWorkOrderToIntegrationMetadata', () => {
  it('builds canonical metadata from akitaWorkOrderId', () => {
    expect(
      legacyAkitaWorkOrderToIntegrationMetadata({
        akitaWorkOrderId: ' 123 ',
        title: 'Leak',
      }),
    ).toEqual({
      source: 'akita',
      externalWorkOrderId: '123',
      externalParentId: '123',
      matchKey: 'src:akita|wo:123|title:leak',
    });
  });

  it('returns null for empty id', () => {
    expect(legacyAkitaWorkOrderToIntegrationMetadata({ akitaWorkOrderId: '  ' })).toBeNull();
  });
});

describe('old-doc read + new-doc write alignment', () => {
  it('canonical maintenance patches match getIntegrationOwnerSnapshot reads', () => {
    const legacyMaintenance = {
      akitaOwnerName: 'Ada',
      akitaOwnerPhone: '+15551212',
      akitaPropertyName: 'Beach House',
    };
    const patches = legacyAkitaMaintenanceToCanonicalPatches(legacyMaintenance);
    expect(patches).toEqual({
      'maintenance.integrationOwnerName': 'Ada',
      'maintenance.integrationOwnerPhone': '+15551212',
      'maintenance.externalPropertyName': 'Beach House',
    });

    const afterWrite = {
      ...legacyMaintenance,
      integrationOwnerName: patches['maintenance.integrationOwnerName'],
      integrationOwnerPhone: patches['maintenance.integrationOwnerPhone'],
      externalPropertyName: patches['maintenance.externalPropertyName'],
    };
    expect(getIntegrationOwnerSnapshot(afterWrite)).toEqual({
      name: 'Ada',
      phone: '+15551212',
      externalPropertyName: 'Beach House',
    });
    // Legacy-only docs still resolve via dual-read
    expect(getIntegrationOwnerSnapshot(legacyMaintenance)).toEqual({
      name: 'Ada',
      phone: '+15551212',
      externalPropertyName: 'Beach House',
    });
  });

  it('skips pairs when canonical already set', () => {
    expect(
      legacyAkitaMaintenanceToCanonicalPatches({
        akitaOwnerName: 'Old',
        integrationOwnerName: 'New',
        akitaPropertyName: 'Legacy Villa',
        externalPropertyName: 'Canonical Villa',
      }),
    ).toEqual({});
  });
});
