import { describe, it, expect } from 'vitest';
import {
  bookingsToOccupiedRanges,
  isOccupiedOn,
  propertyOccupiedRanges,
  firstVacantDayOnOrAfter,
  classifyDay,
  buildOccupancyIndex,
  propertyOccupancyIndex,
  occupancyKindOn,
  isDayBlocked,
  firstSchedulableDayOnOrAfter,
  normalizeTimeOfDay,
  resolveOccupancyWindow,
  DEFAULT_CHECK_IN_TIME,
  DEFAULT_CHECK_OUT_TIME,
} from '../src/occupancy';

const booking = (checkIn: string, checkOut: string, status = 'active', propertyId = 'p1') => ({
  propertyId,
  checkIn,
  checkOut,
  status,
});

describe('bookingsToOccupiedRanges', () => {
  it('drops cancelled and malformed bookings', () => {
    expect(
      bookingsToOccupiedRanges([
        booking('2026-07-10', '2026-07-12', 'cancelled'),
        booking('2026-07-15', '2026-07-15'), // zero-length
        booking('2026-07-20', '2026-07-18'), // inverted
        { checkIn: '', checkOut: '2026-07-22', status: 'active' },
      ]),
    ).toEqual([]);
  });

  it('merges overlapping and back-to-back stays into one block', () => {
    expect(
      bookingsToOccupiedRanges([
        booking('2026-07-14', '2026-07-16'), // back-to-back: next checkIn == prev checkOut
        booking('2026-07-10', '2026-07-12'),
        booking('2026-07-11', '2026-07-14'), // overlaps first
      ]),
    ).toEqual([{ start: '2026-07-10', end: '2026-07-16' }]);
  });

  it('keeps gapped stays as separate ranges', () => {
    expect(
      bookingsToOccupiedRanges([booking('2026-07-10', '2026-07-12'), booking('2026-07-13', '2026-07-15')]),
    ).toEqual([
      { start: '2026-07-10', end: '2026-07-12' },
      { start: '2026-07-13', end: '2026-07-15' },
    ]);
  });
});

describe('isOccupiedOn', () => {
  const ranges = bookingsToOccupiedRanges([booking('2026-07-10', '2026-07-13')]);

  it('check-in day is occupied, checkout day is vacant', () => {
    expect(isOccupiedOn(ranges, '2026-07-10')).toBe(true);
    expect(isOccupiedOn(ranges, '2026-07-12')).toBe(true);
    expect(isOccupiedOn(ranges, '2026-07-13')).toBe(false); // checkout day
    expect(isOccupiedOn(ranges, '2026-07-09')).toBe(false);
  });
});

describe('propertyOccupiedRanges', () => {
  it('filters to the requested property before merging', () => {
    const mixed = [
      booking('2026-07-10', '2026-07-12', 'active', 'p1'),
      booking('2026-07-11', '2026-07-20', 'active', 'p2'),
    ];
    expect(propertyOccupiedRanges(mixed, 'p1')).toEqual([{ start: '2026-07-10', end: '2026-07-12' }]);
    expect(propertyOccupiedRanges(mixed, 'p3')).toEqual([]);
  });
});

describe('firstVacantDayOnOrAfter', () => {
  it('returns the from-date unchanged when vacant', () => {
    const ranges = bookingsToOccupiedRanges([booking('2026-07-20', '2026-07-25')]);
    expect(firstVacantDayOnOrAfter(ranges, '2026-07-15')).toEqual({
      dateStr: '2026-07-15',
      skippedOccupiedDays: false,
      capped: false,
    });
  });

  it('jumps to the checkout day when inside a range', () => {
    const ranges = bookingsToOccupiedRanges([booking('2026-07-10', '2026-07-14')]);
    expect(firstVacantDayOnOrAfter(ranges, '2026-07-11')).toEqual({
      dateStr: '2026-07-14',
      skippedOccupiedDays: true,
      capped: false,
    });
  });

  it('jumps past merged back-to-back bookings in one hop', () => {
    const ranges = bookingsToOccupiedRanges([
      booking('2026-07-10', '2026-07-14'),
      booking('2026-07-14', '2026-07-18'),
    ]);
    expect(firstVacantDayOnOrAfter(ranges, '2026-07-11').dateStr).toBe('2026-07-18');
  });

  it('walks consecutive gapped ranges when the landing day is occupied again', () => {
    const ranges = bookingsToOccupiedRanges([
      booking('2026-07-10', '2026-07-14'),
      booking('2026-07-14', '2026-07-20'), // merges with first
      booking('2026-07-20', '2026-07-22'), // merges too (back-to-back)
    ]);
    expect(firstVacantDayOnOrAfter(ranges, '2026-07-11').dateStr).toBe('2026-07-22');
  });

  it('flags capped when the vacant day is beyond the lookahead', () => {
    const ranges = bookingsToOccupiedRanges([booking('2026-07-01', '2026-10-01')]);
    const result = firstVacantDayOnOrAfter(ranges, '2026-07-10', 60);
    expect(result.dateStr).toBe('2026-10-01');
    expect(result.skippedOccupiedDays).toBe(true);
    expect(result.capped).toBe(true);
  });

  it('handles month boundaries in the cap comparison', () => {
    const ranges = bookingsToOccupiedRanges([booking('2026-07-28', '2026-08-03')]);
    expect(firstVacantDayOnOrAfter(ranges, '2026-07-30', 60)).toEqual({
      dateStr: '2026-08-03',
      skippedOccupiedDays: true,
      capped: false,
    });
  });

  it('no ranges → from-date, uncapped', () => {
    expect(firstVacantDayOnOrAfter([], '2026-07-10')).toEqual({
      dateStr: '2026-07-10',
      skippedOccupiedDays: false,
      capped: false,
    });
  });
});

describe('classifyDay', () => {
  it('classifies each day of a single stay', () => {
    const stay = [booking('2026-07-10', '2026-07-13')];
    expect(classifyDay(stay, '2026-07-09')).toBe('vacant');
    expect(classifyDay(stay, '2026-07-10')).toBe('checkin');
    expect(classifyDay(stay, '2026-07-11')).toBe('occupied');
    expect(classifyDay(stay, '2026-07-12')).toBe('occupied');
    expect(classifyDay(stay, '2026-07-13')).toBe('checkout');
    expect(classifyDay(stay, '2026-07-14')).toBe('vacant');
  });

  it('marks the seam between back-to-back stays as a turnover', () => {
    const backToBack = [booking('2026-07-10', '2026-07-14'), booking('2026-07-14', '2026-07-18')];
    expect(classifyDay(backToBack, '2026-07-14')).toBe('turnover');
  });

  it('a checkout landing inside another stay is fully occupied, not a window', () => {
    const overlapping = [booking('2026-07-01', '2026-07-10'), booking('2026-07-05', '2026-07-08')];
    expect(classifyDay(overlapping, '2026-07-08')).toBe('occupied'); // B checks out, A still in residence
    expect(classifyDay(overlapping, '2026-07-05')).toBe('occupied'); // B checks in, A still in residence
    expect(classifyDay(overlapping, '2026-07-10')).toBe('checkout'); // A alone ends here
  });

  it('drops cancelled, zero-night, inverted, and empty-date bookings', () => {
    expect(classifyDay([booking('2026-07-10', '2026-07-13', 'cancelled')], '2026-07-11')).toBe('vacant');
    expect(classifyDay([booking('2026-07-15', '2026-07-15')], '2026-07-15')).toBe('vacant');
    expect(classifyDay([booking('2026-07-20', '2026-07-18')], '2026-07-19')).toBe('vacant');
    expect(classifyDay([{ checkIn: '', checkOut: '2026-07-22', status: 'active' }], '2026-07-22')).toBe(
      'vacant',
    );
  });

  it('empty date is vacant', () => {
    expect(classifyDay([booking('2026-07-10', '2026-07-13')], '')).toBe('vacant');
  });
});

describe('buildOccupancyIndex', () => {
  it('agrees with classifyDay across a back-to-back chain', () => {
    const bookings = [
      booking('2026-07-10', '2026-07-14'),
      booking('2026-07-14', '2026-07-16'),
      booking('2026-07-20', '2026-07-22'),
    ];
    const index = buildOccupancyIndex(bookings);
    for (const day of [
      '2026-07-09', '2026-07-10', '2026-07-11', '2026-07-13', '2026-07-14',
      '2026-07-15', '2026-07-16', '2026-07-19', '2026-07-20', '2026-07-22', '2026-07-23',
    ]) {
      expect([day, occupancyKindOn(index, day)]).toEqual([day, classifyDay(bookings, day)]);
    }
  });

  it('omits vacant days so absent keys read as vacant', () => {
    const index = buildOccupancyIndex([booking('2026-07-10', '2026-07-12')]);
    expect([...index.keys()].sort()).toEqual(['2026-07-10', '2026-07-11', '2026-07-12']);
    expect(occupancyKindOn(index, '2026-07-01')).toBe('vacant');
  });

  it('clamps to the window without changing kinds for a straddling stay', () => {
    const straddling = [booking('2026-06-01', '2026-09-01')];
    const index = buildOccupancyIndex(straddling, {
      fromDateStr: '2026-07-01',
      toDateStr: '2026-07-03',
    });
    expect([...index.keys()].sort()).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(occupancyKindOn(index, '2026-07-02')).toBe('occupied');
    // The stay's own boundaries fall outside the window and are not emitted.
    expect(index.has('2026-06-01')).toBe(false);
    expect(index.has('2026-09-01')).toBe(false);
  });

  it('drops a stay entirely outside the window', () => {
    const index = buildOccupancyIndex([booking('2026-01-10', '2026-01-20')], {
      fromDateStr: '2026-07-01',
      toDateStr: '2026-07-31',
    });
    expect(index.size).toBe(0);
  });
});

describe('propertyOccupancyIndex', () => {
  it('filters to the requested property', () => {
    const mixed = [
      booking('2026-07-10', '2026-07-12', 'active', 'p1'),
      booking('2026-07-11', '2026-07-20', 'active', 'p2'),
    ];
    expect(occupancyKindOn(propertyOccupancyIndex(mixed, 'p1'), '2026-07-11')).toBe('occupied');
    expect(occupancyKindOn(propertyOccupancyIndex(mixed, 'p1'), '2026-07-15')).toBe('vacant');
    expect(propertyOccupancyIndex(mixed, 'p3').size).toBe(0);
  });
});

describe('isDayBlocked', () => {
  it('blocks only fully-occupied days', () => {
    expect(isDayBlocked('occupied')).toBe(true);
    expect(isDayBlocked('turnover')).toBe(false);
    expect(isDayBlocked('checkin')).toBe(false);
    expect(isDayBlocked('checkout')).toBe(false);
    expect(isDayBlocked('vacant')).toBe(false);
  });
});

describe('firstSchedulableDayOnOrAfter', () => {
  it('stops at the intermediate turnover day that firstVacantDayOnOrAfter skips', () => {
    const bookings = [booking('2026-07-01', '2026-07-05'), booking('2026-07-05', '2026-07-09')];
    const index = buildOccupancyIndex(bookings);
    expect(firstSchedulableDayOnOrAfter(index, '2026-07-03')).toEqual({
      dateStr: '2026-07-05',
      skippedOccupiedDays: true,
      capped: false,
    });
    // The merged-range path jumps clear past the turnover to the final checkout.
    expect(firstVacantDayOnOrAfter(bookingsToOccupiedRanges(bookings), '2026-07-03').dateStr).toBe(
      '2026-07-09',
    );
  });

  it('returns the from-date unchanged on a boundary or vacant day', () => {
    const index = buildOccupancyIndex([booking('2026-07-10', '2026-07-14')]);
    expect(firstSchedulableDayOnOrAfter(index, '2026-07-10').dateStr).toBe('2026-07-10'); // check-in day
    expect(firstSchedulableDayOnOrAfter(index, '2026-07-14')).toEqual({
      dateStr: '2026-07-14',
      skippedOccupiedDays: false,
      capped: false,
    });
    expect(firstSchedulableDayOnOrAfter(index, '2026-08-01').dateStr).toBe('2026-08-01');
  });

  it('walks day by day out of a mid-stay block, crossing a month boundary', () => {
    const index = buildOccupancyIndex([booking('2026-07-28', '2026-08-03')]);
    expect(firstSchedulableDayOnOrAfter(index, '2026-07-30')).toEqual({
      dateStr: '2026-08-03',
      skippedOccupiedDays: true,
      capped: false,
    });
  });

  it('flags capped beyond the lookahead', () => {
    const index = buildOccupancyIndex([booking('2026-07-01', '2026-10-01')]);
    const result = firstSchedulableDayOnOrAfter(index, '2026-07-10', 60);
    expect(result.skippedOccupiedDays).toBe(true);
    expect(result.capped).toBe(true);
  });

  it('empty index → from-date, uncapped', () => {
    expect(firstSchedulableDayOnOrAfter(new Map(), '2026-07-10')).toEqual({
      dateStr: '2026-07-10',
      skippedOccupiedDays: false,
      capped: false,
    });
  });
});

describe('normalizeTimeOfDay', () => {
  it('passes through valid HH:MM', () => {
    expect(normalizeTimeOfDay('16:00', DEFAULT_CHECK_OUT_TIME)).toBe('16:00');
    expect(normalizeTimeOfDay('00:00', DEFAULT_CHECK_OUT_TIME)).toBe('00:00');
    expect(normalizeTimeOfDay('23:59', DEFAULT_CHECK_OUT_TIME)).toBe('23:59');
    expect(normalizeTimeOfDay(' 09:30 ', DEFAULT_CHECK_OUT_TIME)).toBe('09:30');
  });

  it('falls back on anything else reachable from a free-form string field', () => {
    for (const raw of [undefined, '', '3pm', '15:00:00', '25:00', '12:60', '9:5', 'noon']) {
      expect(normalizeTimeOfDay(raw, '10:00')).toBe('10:00');
    }
  });
});

describe('resolveOccupancyWindow', () => {
  const times = { checkOutTime: '10:00', checkInTime: '16:00' };

  it('derives the window for each kind', () => {
    expect(resolveOccupancyWindow('vacant', times)).toEqual({
      kind: 'vacant', from: '00:00', to: '24:00', hasWindow: true,
    });
    expect(resolveOccupancyWindow('checkout', times)).toEqual({
      kind: 'checkout', from: '10:00', to: '24:00', hasWindow: true,
    });
    expect(resolveOccupancyWindow('turnover', times)).toEqual({
      kind: 'turnover', from: '10:00', to: '16:00', hasWindow: true,
    });
    expect(resolveOccupancyWindow('checkin', times)).toEqual({
      kind: 'checkin', from: '00:00', to: '16:00', hasWindow: true,
    });
    expect(resolveOccupancyWindow('occupied', times)).toEqual({
      kind: 'occupied', from: '', to: '', hasWindow: false,
    });
  });

  it('a turnover with no real gap has no window', () => {
    expect(resolveOccupancyWindow('turnover', { checkOutTime: '16:00', checkInTime: '16:00' }).hasWindow)
      .toBe(false);
    expect(resolveOccupancyWindow('turnover', { checkOutTime: '17:00', checkInTime: '16:00' }).hasWindow)
      .toBe(false);
  });

  it('falls back to the shared defaults when times are unset or malformed', () => {
    expect(resolveOccupancyWindow('turnover')).toEqual({
      kind: 'turnover',
      from: DEFAULT_CHECK_OUT_TIME,
      to: DEFAULT_CHECK_IN_TIME,
      hasWindow: true,
    });
    expect(resolveOccupancyWindow('turnover', { checkOutTime: '3pm', checkInTime: '' })).toEqual({
      kind: 'turnover',
      from: DEFAULT_CHECK_OUT_TIME,
      to: DEFAULT_CHECK_IN_TIME,
      hasWindow: true,
    });
  });
});
