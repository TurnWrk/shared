/**
 * Loop-direction heuristics for right-turn-friendly routes.
 * Pure math — no external API calls.
 *
 * Google Routes API v2 has no left-turn penalty, so the cheap proxy is loop
 * direction: in right-hand-traffic countries a clockwise loop makes most
 * perimeter turns right-hand turns. Reversing a Google-optimized loop
 * preserves stop adjacency, so distance is near-identical; duration differs
 * only via one-ways/traffic, which the caller prices with a second
 * computeRoutes call before adopting the reversal.
 */

import type { GeoPoint } from './clustering';

/** Duration penalty we accept to drive the loop clockwise (2%). */
export const CLOCKWISE_TOLERANCE = 0.02;

/** Signed areas smaller than this (in normalized degrees²) are treated as
 *  collinear/degenerate loops where orientation is meaningless. */
const DEGENERATE_AREA_EPSILON = 1e-10;

export type LoopOrientation = 'cw' | 'ccw' | 'degenerate';

/**
 * Orientation of a closed loop through `points` (in visit order; the closing
 * edge back to points[0] is implied). Trapezoid-form shoelace sum on a local
 * planar projection (x = lng·cos(meanLat), y = lat): a positive sum means the
 * loop winds clockwise as seen on a north-up map.
 */
export function loopOrientation(points: GeoPoint[]): LoopOrientation {
    if (points.length < 3) return 'degenerate';

    const meanLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const cosLat = Math.cos(meanLat * (Math.PI / 180));

    let sum = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const x1 = a.lng * cosLat;
        const x2 = b.lng * cosLat;
        sum += (x2 - x1) * (b.lat + a.lat);
    }

    if (Math.abs(sum) < DEGENERATE_AREA_EPSILON) return 'degenerate';
    // sum > 0 ⇒ vertices wind clockwise when north is up.
    return sum > 0 ? 'cw' : 'ccw';
}

/**
 * Whether the reversed (clockwise) ordering should be adopted given priced
 * durations for both directions.
 */
export function preferReversed(
    forwardSeconds: number,
    reversedSeconds: number,
    tolerance: number = CLOCKWISE_TOLERANCE,
): boolean {
    if (forwardSeconds <= 0 || reversedSeconds <= 0) return false;
    return reversedSeconds <= forwardSeconds * (1 + tolerance);
}
