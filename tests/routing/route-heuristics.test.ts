import { describe, it, expect } from 'vitest';
import { loopOrientation, preferReversed, CLOCKWISE_TOLERANCE } from '../../src/routing/heuristics';

describe('loopOrientation', () => {
    // North-up square loop: bottom-left → top-left → top-right → bottom-right
    // (north, then east, then south) reads clockwise on a map.
    const clockwiseSquare = [
        { lat: 30.0, lng: -95.0 },
        { lat: 30.1, lng: -95.0 },
        { lat: 30.1, lng: -94.9 },
        { lat: 30.0, lng: -94.9 },
    ];

    it('detects a clockwise loop', () => {
        expect(loopOrientation(clockwiseSquare)).toBe('cw');
    });

    it('detects a counter-clockwise loop', () => {
        expect(loopOrientation([...clockwiseSquare].reverse())).toBe('ccw');
    });

    it('is degenerate for fewer than 3 points', () => {
        expect(loopOrientation(clockwiseSquare.slice(0, 2))).toBe('degenerate');
    });

    it('is degenerate for collinear stops', () => {
        expect(loopOrientation([
            { lat: 30.0, lng: -95.0 },
            { lat: 30.1, lng: -95.0 },
            { lat: 30.2, lng: -95.0 },
        ])).toBe('degenerate');
    });

    it('orientation flips when the loop is reversed', () => {
        const irregular = [
            { lat: 28.5, lng: -81.4 },
            { lat: 28.6, lng: -81.3 },
            { lat: 28.55, lng: -81.2 },
            { lat: 28.45, lng: -81.25 },
            { lat: 28.4, lng: -81.35 },
        ];
        const forward = loopOrientation(irregular);
        const backward = loopOrientation([...irregular].reverse());
        expect(forward).not.toBe('degenerate');
        expect(backward).not.toBe(forward);
    });
});

describe('preferReversed', () => {
    it('adopts the reversal when it is faster', () => {
        expect(preferReversed(3600, 3500)).toBe(true);
    });

    it('adopts the reversal within the tolerance', () => {
        expect(preferReversed(3600, 3600 * (1 + CLOCKWISE_TOLERANCE))).toBe(true);
    });

    it('rejects the reversal beyond the tolerance', () => {
        expect(preferReversed(3600, 3600 * 1.05)).toBe(false);
    });

    it('rejects when durations are missing or zero', () => {
        expect(preferReversed(0, 3600)).toBe(false);
        expect(preferReversed(3600, 0)).toBe(false);
    });
});
