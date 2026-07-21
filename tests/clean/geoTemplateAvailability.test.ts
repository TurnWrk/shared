import { describe, it, expect } from 'vitest';
import { haversineMeters } from '../../src/clean/geo';
import { renderTemplate, extractTemplateVars } from '../../src/clean/templateRender';
import {
  dowForDate,
  timeToMinutes,
  techAvailableForWindow,
  timeOffCovers,
  availableTechCountForSlot,
  hasContractorAvailabilityData,
  effectiveSlotCapacity,
} from '../../src/clean/availability';
import type { CleanContractorAvailability, CleanTimeOff } from '../../src/types/clean';

describe('haversineMeters', () => {
  it('is ~0 for identical points and ~111km for 1° latitude', () => {
    expect(haversineMeters({ lat: 40, lng: -74 }, { lat: 40, lng: -74 })).toBe(0);
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});

describe('renderTemplate / extractTemplateVars (TURNWRK-101)', () => {
  it('substitutes tokens and fails closed on missing / empty', () => {
    expect(renderTemplate('Hi {{customer.first_name}}', { 'customer.first_name': 'Ada' })).toEqual({
      ok: true,
      text: 'Hi Ada',
    });
    expect(renderTemplate('Pay {{invoice.pay_url}}', {})).toEqual({
      ok: false,
      missing: ['invoice.pay_url'],
    });
    expect(
      renderTemplate('Hi {{customer.first_name}}', { 'customer.first_name': '' }),
    ).toEqual({ ok: false, missing: ['customer.first_name'] });
    expect(extractTemplateVars('{{a}} and {{b.c}} {{a}}')).toEqual(['a', 'b.c']);
    expect(renderTemplate('{{ org.name }}', { 'org.name': 'Acme' })).toEqual({
      ok: true,
      text: 'Acme',
    });
  });
});

describe('availability helpers', () => {
  const window = { start: '09:00', end: '11:00' };

  it('dowForDate and timeToMinutes are pure calendar/clock math', () => {
    // 2026-07-14 is a Tuesday (UTC)
    expect(dowForDate('2026-07-14')).toBe(2);
    expect(timeToMinutes('09:30')).toBe(570);
  });

  it('techAvailableForWindow: absent/inactive = always; active must cover window', () => {
    expect(techAvailableForWindow(undefined, window, 2)).toBe(true);
    const inactive = {
      id: 'a',
      orgId: 'o',
      techId: 't1',
      weekly: [],
      active: false,
      updatedBy: 'u',
      createdAt: 0,
      updatedAt: 0,
    } satisfies CleanContractorAvailability;
    expect(techAvailableForWindow(inactive, window, 2)).toBe(true);

    const active: CleanContractorAvailability = {
      ...inactive,
      active: true,
      weekly: [{ dow: 2, start: '08:00', end: '12:00' }],
    };
    expect(techAvailableForWindow(active, window, 2)).toBe(true);
    expect(techAvailableForWindow(active, window, 3)).toBe(false);
  });

  it('timeOffCovers only approved inclusive ranges', () => {
    const row: CleanTimeOff = {
      id: '1',
      orgId: 'o',
      techId: 't1',
      type: 'pto',
      status: 'approved',
      startDate: '2026-07-10',
      endDate: '2026-07-12',
      requestedBy: 'u',
      createdAt: 0,
      updatedAt: 0,
    };
    expect(timeOffCovers(row, '2026-07-11')).toBe(true);
    expect(timeOffCovers({ ...row, status: 'requested' }, '2026-07-11')).toBe(false);
  });

  it('availableTechCountForSlot + capacity respect time-off and availability data gate', () => {
    const avail: CleanContractorAvailability = {
      id: 'a',
      orgId: 'o',
      techId: 't1',
      weekly: [{ dow: 2, start: '08:00', end: '12:00' }],
      active: true,
      updatedBy: 'u',
      createdAt: 0,
      updatedAt: 0,
    };
    const off: CleanTimeOff = {
      id: '1',
      orgId: 'o',
      techId: 't2',
      type: 'pto',
      status: 'approved',
      startDate: '2026-07-14',
      endDate: '2026-07-14',
      requestedBy: 'u',
      createdAt: 0,
      updatedAt: 0,
    };
    const count = availableTechCountForSlot({
      techIds: ['t1', 't2'],
      availabilityByTech: { t1: avail },
      approvedTimeOff: [off],
      date: '2026-07-14',
      window,
    });
    expect(count).toBe(1); // t2 on PTO

    expect(hasContractorAvailabilityData([avail], [])).toBe(true);
    expect(hasContractorAvailabilityData([], [])).toBe(false);
    expect(effectiveSlotCapacity(3, 1, true)).toBe(1);
    expect(effectiveSlotCapacity(3, 1, false)).toBe(3);
  });
});
