/**
 * Geo-clustering utilities for location-aware scheduling (Verticals C7 —
 * TURNWRK-326). Extracted from dispatch/lib/geo-clustering.ts so the booking
 * app can plan routes too, not only Dispatch. Pure math — the Google Routes API
 * call stays in Dispatch, which owns the Maps credentials.
 */
import { haversineMeters } from '../clean/geo';
// Reuse the suite's canonical GeoPoint rather than redeclaring it — dispatch's
// copy was a structural duplicate of the one already in @turnwrk/shared/types.
import type { GeoPoint } from '../types/property';

export type { GeoPoint };

const METERS_PER_MILE = 1609.344;



/**
 * Great-circle miles between two points.
 *
 * Delegates to the suite's single haversine (`@turnwrk/shared/clean` geo, the
 * same helper the bounty and clock geofences use) rather than carrying a second
 * copy of the formula — the implementations were already identical apart from
 * the radius unit.
 */
export function distanceMiles(a: GeoPoint, b: GeoPoint): number {
    return haversineMeters(a, b) / METERS_PER_MILE;
}

export function centroid(points: GeoPoint[]): GeoPoint {
    if (points.length === 0) return { lat: 0, lng: 0 };
    const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
    return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/**
 * Score how well a new stop fits with existing stops for a day.
 * Returns 0.0 (perfect fit) to 1.0 (very far). 0.5 when there are no existing stops.
 */
export function geoFitScore(
    existingStops: GeoPoint[],
    newStop: GeoPoint,
    maxRadiusMiles: number = 15,
): number {
    if (existingStops.length === 0) return 0.5;
    const center = centroid(existingStops);
    const dist = distanceMiles(center, newStop);
    return Math.min(dist / maxRadiusMiles, 1.0);
}

export function clusterProperties(
    properties: Array<{ id: string; geo: GeoPoint }>,
    radiusMiles: number = 5,
): string[][] {
    const remaining = new Set(properties.map((_, i) => i));
    const clusters: string[][] = [];

    while (remaining.size > 0) {
        const seedIdx = remaining.values().next().value;
        if (seedIdx === undefined) break;
        remaining.delete(seedIdx);

        const cluster: number[] = [seedIdx];
        let clusterCenter = properties[seedIdx].geo;

        let changed = true;
        while (changed) {
            changed = false;
            for (const idx of remaining) {
                if (distanceMiles(clusterCenter, properties[idx].geo) <= radiusMiles) {
                    cluster.push(idx);
                    remaining.delete(idx);
                    clusterCenter = centroid(cluster.map(i => properties[i].geo));
                    changed = true;
                }
            }
        }

        clusters.push(cluster.map(i => properties[i].id));
    }

    clusters.sort((a, b) => b.length - a.length);
    return clusters;
}
