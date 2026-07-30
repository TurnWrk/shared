/**
 * Pure Google Maps directions-URL builders. No network or env access, so this
 * module is safe to import from client components (unlike ./google-maps, which
 * holds the API key and fetch logic).
 */

/** Google Maps dir URLs accept at most 9 intermediate waypoints. */
const MAX_URL_WAYPOINTS = 9;

type UrlPoint = { lat: number; lng: number; address?: string };

const pointStr = (p: UrlPoint) =>
  p.address ? encodeURIComponent(p.address) : `${p.lat},${p.lng}`;

/**
 * Build one leg URL. A null origin omits the `origin` param entirely, which
 * makes Google Maps start navigation from the device's current location.
 */
const buildLegUrl = (
  origin: UrlPoint | null,
  destination: UrlPoint,
  waypoints: UrlPoint[]
): string => {
  let url = `https://www.google.com/maps/dir/?api=1`;
  if (origin) url += `&origin=${pointStr(origin)}`;
  url += `&destination=${pointStr(destination)}&travelmode=driving`;
  if (waypoints.length > 0) {
    url += `&waypoints=${waypoints.map(pointStr).join("|")}`;
  }
  return url;
};

/**
 * Split an ordered point chain into navigation legs. Routes with more than 9
 * intermediate waypoints are split into consecutive legs where each leg's
 * destination is the next leg's origin. The first point may be null, in which
 * case only the first leg omits its origin (current location); later legs start
 * from a real point.
 */
const buildLegUrls = (points: Array<UrlPoint | null>): string[] => {
  const urls: string[] = [];
  let start = 0;
  while (start < points.length - 1) {
    const end = Math.min(start + MAX_URL_WAYPOINTS + 1, points.length - 1);
    urls.push(
      buildLegUrl(
        points[start],
        points[end] as UrlPoint,
        points.slice(start + 1, end) as UrlPoint[]
      )
    );
    start = end;
  }
  return urls;
};

/**
 * Build shareable Google Maps navigation URLs for origin → waypoints →
 * destination.
 */
export function generateGoogleMapsUrls(
  origin: UrlPoint,
  destination: UrlPoint,
  waypoints: UrlPoint[]
): string[] {
  return buildLegUrls([origin, ...waypoints, destination]);
}

/**
 * Build navigation URLs that start from the device's current location (origin
 * omitted) and run one-way through the stops, ending at the last stop — no
 * return leg to home base. Returns [] when there are no stops.
 */
export function generateCurrentLocationUrls(
  stops: Array<{ lat: number; lng: number; formattedAddress?: string; address?: string }>
): string[] {
  const pts: UrlPoint[] = stops.map(s => ({
    lat: s.lat,
    lng: s.lng,
    address: s.formattedAddress || s.address,
  }));
  if (pts.length === 0) return [];
  return buildLegUrls([null, ...pts]);
}
