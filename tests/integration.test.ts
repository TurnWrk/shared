import { describe, it, expect } from 'vitest';
import {
  usesSyncedBookings,
  isExternallyManagedBookingSource,
} from '../src/types/integration';

describe('usesSyncedBookings', () => {
  it('is true for any non-manual source (occupancy derivation)', () => {
    for (const src of ['akita', 'external-sync', 'airbnb', 'vrbo', 'ics-sync'] as const) {
      expect(usesSyncedBookings(src)).toBe(true);
    }
  });

  it('is false for manual, null, and undefined', () => {
    expect(usesSyncedBookings('manual')).toBe(false);
    expect(usesSyncedBookings(null)).toBe(false);
    expect(usesSyncedBookings(undefined)).toBe(false);
  });
});

describe('isExternallyManagedBookingSource', () => {
  it('is true only for PMS-owned sources (akita, external-sync)', () => {
    expect(isExternallyManagedBookingSource('akita')).toBe(true);
    expect(isExternallyManagedBookingSource('external-sync')).toBe(true);
  });

  it('is false for self-managed ICS feed sources', () => {
    expect(isExternallyManagedBookingSource('airbnb')).toBe(false);
    expect(isExternallyManagedBookingSource('vrbo')).toBe(false);
    expect(isExternallyManagedBookingSource('ics-sync')).toBe(false);
  });

  it('is false for manual, null, and undefined', () => {
    expect(isExternallyManagedBookingSource('manual')).toBe(false);
    expect(isExternallyManagedBookingSource(null)).toBe(false);
    expect(isExternallyManagedBookingSource(undefined)).toBe(false);
  });
});
