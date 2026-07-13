/**
 * Geo distance math (Change Order 2) — pure, no I/O. Used by the bounty
 * submission geofence; deliberately tiny (no geo library).
 */

export interface GeoPointLike {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in meters (haversine). */
export function haversineMeters(a: GeoPointLike, b: GeoPointLike): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
