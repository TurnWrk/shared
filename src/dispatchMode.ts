/**
 * How an org's work orders reach a technician (TURNWRK-767).
 *
 * - `marketplace` (default): auto-assign OFFERS a work order to a tech with an
 *   `expiresAt` clock; an unacknowledged offer is released and re-offered.
 * - `in-house`: the org services its own work with one named technician
 *   (`dispatch.inHouseTechId`). Work orders are assigned to that tech already
 *   accepted (`acknowledgedAt`), never carry an offer clock, and are never
 *   offered, warned, escalated or released.
 *
 * An in-house org whose tech cannot be resolved (unset, deleted, inactive, or
 * not in the org) fails safe: work stays unassigned on the queue, surfaced to
 * dispatchers, and is still never offered or released.
 */

export type DispatchMode = 'marketplace' | 'in-house';

export const DEFAULT_DISPATCH_MODE: DispatchMode = 'marketplace';

/** The org fields this module reads; any org doc shape satisfies it. */
export interface DispatchModeOrgLike {
  dispatch?: { mode?: unknown; inHouseTechId?: unknown } | null;
}

/** Only the exact string `'in-house'` turns the mode on; anything else is marketplace. */
export function orgDispatchMode(org: DispatchModeOrgLike | null | undefined): DispatchMode {
  return org?.dispatch?.mode === 'in-house' ? 'in-house' : DEFAULT_DISPATCH_MODE;
}

export function isInHouseOrg(org: DispatchModeOrgLike | null | undefined): boolean {
  return orgDispatchMode(org) === 'in-house';
}

/** The configured in-house tech id, or null when unset/blank. */
export function inHouseTechIdOf(org: DispatchModeOrgLike | null | undefined): string | null {
  const id = org?.dispatch?.inHouseTechId;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

export interface InHouseTechLike {
  id: string;
  status?: unknown;
  orgIds?: unknown;
}

export type InHouseTechUnresolved = 'no-in-house-tech' | 'tech-not-found' | 'tech-inactive' | 'tech-not-in-org';

export type InHouseTechResolution =
  | { ok: true; techId: string }
  | { ok: false; reason: InHouseTechUnresolved };

/**
 * Resolve an in-house org's technician against the tech doc the caller loaded
 * for `inHouseTechIdOf(org)` (null when it does not exist). Callers check
 * `isInHouseOrg` first; this does not.
 */
export function resolveInHouseTech(
  orgId: string,
  org: DispatchModeOrgLike | null | undefined,
  tech: InHouseTechLike | null | undefined,
): InHouseTechResolution {
  const techId = inHouseTechIdOf(org);
  if (!techId) return { ok: false, reason: 'no-in-house-tech' };
  if (!tech || tech.id !== techId) return { ok: false, reason: 'tech-not-found' };
  if (tech.status !== 'Active') return { ok: false, reason: 'tech-inactive' };
  if (!Array.isArray(tech.orgIds) || !tech.orgIds.includes(orgId)) return { ok: false, reason: 'tech-not-in-org' };
  return { ok: true, techId };
}

/** The fields that make a work order assigned to, and accepted by, the in-house tech. */
export function inHouseAcceptedFields(techId: string, now: number): { assignedTechId: string; acknowledgedAt: number } {
  return { assignedTechId: techId, acknowledgedAt: now };
}

/** Statuses a new work order can be handed to the in-house tech in. */
const IN_HOUSE_CREATE_STATUSES: ReadonlySet<string> = new Set(['Backlog', 'Scheduled']);

/**
 * Hand a NEW work-order payload of an in-house org to its tech, accepted, before
 * it is written. Every creation path calls this one function. Skipped (payload
 * untouched): it already names a tech (e.g. an intake rule's assignee), it is
 * an emergency (broadcast-accept flow), or it is not open work. `unresolved`:
 * the tech could not be resolved, so the job stays unassigned for a human.
 * Mutates `payload`.
 */
export function applyInHouseToNewWorkOrder(
  payload: Record<string, unknown>,
  resolution: InHouseTechResolution,
  now: number,
): 'assigned' | 'unresolved' | 'skipped' {
  if (payload.assignedTechId || payload.isEmergency === true) return 'skipped';
  if (!IN_HOUSE_CREATE_STATUSES.has(String(payload.status))) return 'skipped';
  if ('reason' in resolution) return 'unresolved';
  Object.assign(payload, inHouseAcceptedFields(resolution.techId, now));
  return 'assigned';
}

/**
 * Offer-cycle fields an in-house work order must not carry: the offer clock,
 * the release marker, and the per-offer notification/attempt stamps. Writers
 * delete these with their SDK's delete sentinel.
 */
export const IN_HOUSE_CLEARED_FIELDS = [
  'expiresAt',
  'releasedAt',
  'releasedReason',
  'offerExpiringNotifiedAt',
  'slaSecondaryNotifiedAt',
  'slaBreachNotifiedAt',
  'autoAssignLastAttemptAt',
] as const;
