/**
 * Which stay a guest report or SMS binding belongs to (TURNWRK-741/742): occupancy's in-stay test,
 * except that on checkout morning the departing guest is still in the house.
 */
import { describe, it, expect } from 'vitest';
import { findOccupyingBooking, matchReportBooking, type OccupancyBookingLike } from '../src/occupancy';

type Row = OccupancyBookingLike & { id: string };
const b = (id: string, checkIn: string, checkOut: string, status = 'active'): Row => ({ id, checkIn, checkOut, status });

const departing = b('departing', '2026-10-02', '2026-10-06');
const arriving = b('arriving', '2026-10-06', '2026-10-09');

describe('matchReportBooking', () => {
    it('matches the stay in progress mid-stay', () => {
        expect(matchReportBooking([departing], '2026-10-04', '14:00', '10:00')?.id).toBe('departing');
    });

    it('matches the departing guest on checkout morning, before check-out time', () => {
        expect(matchReportBooking([departing, arriving], '2026-10-06', '08:30', '10:00')?.id).toBe('departing');
    });

    it('matches the arriving guest on a turnover day after check-out time', () => {
        expect(matchReportBooking([departing, arriving], '2026-10-06', '16:00', '10:00')?.id).toBe('arriving');
    });

    it('matches nobody after check-out on a checkout day with no arrival', () => {
        expect(matchReportBooking([departing], '2026-10-06', '11:00', '10:00')).toBeUndefined();
    });

    it('ignores cancelled stays', () => {
        const cancelled = b('cancelled', '2026-10-02', '2026-10-08', 'cancelled');
        expect(matchReportBooking([cancelled], '2026-10-04', '14:00', '10:00')).toBeUndefined();
        expect(matchReportBooking([{ ...departing, status: 'cancelled' }], '2026-10-06', '08:00', '10:00')).toBeUndefined();
    });

    it('matches nobody when the property is empty', () => {
        expect(matchReportBooking([], '2026-10-04', '14:00', '10:00')).toBeUndefined();
    });

    it('agrees with the occupancy test outside checkout morning', () => {
        expect(findOccupyingBooking([departing, arriving], '2026-10-06')?.id).toBe('arriving');
    });
});
