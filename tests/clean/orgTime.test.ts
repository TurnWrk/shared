import { describe, it, expect } from 'vitest';
import { zonedTimeToUtcMs, preauthDueAtFor, todayYmdInTz } from '../../src/clean/orgTime';

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

describe('todayYmdInTz', () => {
  it('returns a YYYY-MM-DD date for a named zone', () => {
    expect(todayYmdInTz('America/Chicago')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('zones west of UTC are not ahead of the UTC date', () => {
    // The UTC-evening rollover bug this exists to prevent: a US zone must never
    // report a LATER date than UTC.
    const utcToday = new Date().toISOString().slice(0, 10);
    expect(todayYmdInTz('America/Los_Angeles') <= utcToday).toBe(true);
  });

  it('falls back to the UTC date for an unknown zone', () => {
    expect(todayYmdInTz('Not/AZone')).toBe(new Date().toISOString().slice(0, 10));
  });

  it('defaults to America/Chicago when no zone is given', () => {
    expect(todayYmdInTz()).toBe(todayYmdInTz('America/Chicago'));
    expect(todayYmdInTz('')).toBe(todayYmdInTz('America/Chicago'));
  });
});
