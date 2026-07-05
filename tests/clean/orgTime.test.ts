import { describe, it, expect } from 'vitest';
import { zonedTimeToUtcMs, preauthDueAtFor } from '../../src/clean/orgTime';

describe('zonedTimeToUtcMs', () => {
  it('converts Chicago winter time (CST, UTC-6)', () => {
    expect(zonedTimeToUtcMs('2026-01-15', '09:00', 'America/Chicago'))
      .toBe(Date.UTC(2026, 0, 15, 15, 0, 0));
  });

  it('converts Chicago summer time (CDT, UTC-5)', () => {
    expect(zonedTimeToUtcMs('2026-07-15', '09:00', 'America/Chicago'))
      .toBe(Date.UTC(2026, 6, 15, 14, 0, 0));
  });

  it('handles the spring-forward day', () => {
    // 2026-03-08 09:00 Chicago is after the 2am DST jump → CDT (UTC-5)
    expect(zonedTimeToUtcMs('2026-03-08', '09:00', 'America/Chicago'))
      .toBe(Date.UTC(2026, 2, 8, 14, 0, 0));
  });

  it('handles UTC and eastern zones', () => {
    expect(zonedTimeToUtcMs('2026-07-15', '09:00', 'UTC'))
      .toBe(Date.UTC(2026, 6, 15, 9, 0, 0));
    expect(zonedTimeToUtcMs('2026-07-15', '09:00', 'America/New_York'))
      .toBe(Date.UTC(2026, 6, 15, 13, 0, 0));
  });

  it('falls back to America/Chicago when the org has no timezone', () => {
    expect(zonedTimeToUtcMs('2026-01-15', '09:00', undefined))
      .toBe(Date.UTC(2026, 0, 15, 15, 0, 0));
  });
});

describe('preauthDueAtFor', () => {
  it('is exactly 48 hours before the window start', () => {
    const start = Date.UTC(2026, 6, 15, 14, 0, 0);
    expect(preauthDueAtFor(start)).toBe(start - 48 * 3600 * 1000);
  });
});
