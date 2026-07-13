/**
 * Bounty submission validation core (Change Order 2, doc 09 §3.4) — pure,
 * unit-testable against acceptance B3/B4. The server layer queries the data
 * and executes; the rules live here.
 *
 * Trust model (stated plainly): `capturedAt` and `geo` are asserted by the
 * device — offline sync means the server cannot observe capture directly.
 * The in-app camera-only capture + check-in session window is the real
 * control (doc §3.4); EXIF is stored for audit but never trusted.
 */
import type { CleanGeoStamp } from '../types/clean';
import { haversineMeters, type GeoPointLike } from './geo';

/** Offline submissions must reach the server within this window after checkout. */
export const BOUNTY_SYNC_GRACE_MS = 48 * 60 * 60 * 1000;

export interface CaptureWindowInput {
  /** Client capture time — the validated instant (B3 evaluates THIS, not sync time). */
  capturedAt: number;
  checkedInAt: number;
  /** Absent while still on-site. */
  checkedOutAt?: number;
  /** Server receipt time. */
  receivedAt: number;
}

export type CaptureWindowResult =
  | { ok: true }
  | { ok: false; code: 'outside_checkin_window' | 'sync_too_late' };

/**
 * The capture must happen inside the submitter's checked-in window, and an
 * offline-synced submission must arrive within the grace window of checkout.
 */
export function checkCaptureWindow(input: CaptureWindowInput): CaptureWindowResult {
  if (input.capturedAt < input.checkedInAt) {
    return { ok: false, code: 'outside_checkin_window' };
  }
  if (input.checkedOutAt !== undefined && input.capturedAt > input.checkedOutAt) {
    return { ok: false, code: 'outside_checkin_window' };
  }
  const syncDeadline = (input.checkedOutAt ?? input.capturedAt) + BOUNTY_SYNC_GRACE_MS;
  if (input.receivedAt > syncDeadline) {
    return { ok: false, code: 'sync_too_late' };
  }
  return { ok: true };
}

export interface GeofenceInput {
  submissionGeo?: CleanGeoStamp;
  /** Property.geo when the property has been geocoded (hostfix routes do this lazily). */
  propertyGeo?: GeoPointLike;
  /** The submitter's check-in fix — weaker anchor when the property is ungeocoded. */
  checkInGeo?: CleanGeoStamp;
  radiusM: number;
}

export interface GeofenceResult {
  ok: boolean;
  /** Which rung of the enforcement ladder applied; 'unverified' = accepted, flagged. */
  basis: 'property' | 'check_in' | 'unverified';
  distanceM?: number;
}

/**
 * Enforcement ladder (recon: Property.geo is NOT guaranteed — populated only
 * by hostfix route geocoding): (1) property fix when available; (2) else the
 * check-in fix; (3) else — or when the submission carries no geo — accept
 * flagged 'unverified' so the reviewer sees it rather than punishing cleaners
 * for missing reference data.
 */
export function resolveGeofence(input: GeofenceInput): GeofenceResult {
  if (!input.submissionGeo) return { ok: true, basis: 'unverified' };
  if (input.propertyGeo) {
    const distanceM = haversineMeters(input.submissionGeo, input.propertyGeo);
    return { ok: distanceM <= input.radiusM, basis: 'property', distanceM };
  }
  if (input.checkInGeo) {
    const distanceM = haversineMeters(input.submissionGeo, input.checkInGeo);
    return { ok: distanceM <= input.radiusM, basis: 'check_in', distanceM };
  }
  return { ok: true, basis: 'unverified' };
}
