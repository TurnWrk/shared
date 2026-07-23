import { describe, it, expect } from 'vitest';
import {
  bookingsToOccupiedRanges,
  isOccupiedOn,
  propertyOccupiedRanges,
  firstVacantDayOnOrAfter,
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
