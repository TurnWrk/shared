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
  const reason = activeOrgTechProblem(orgId, techId, tech);
  return reason ? { ok: false, reason } : { ok: true, techId };
}

/** Why `tech` is not the active org tech `techId`, or null when it is. */
function activeOrgTechProblem(
  orgId: string,
  techId: string,
  tech: InHouseTechLike | null | undefined,
): Exclude<InHouseTechUnresolved, 'no-in-house-tech'> | null {
  if (!tech || tech.id !== techId) return 'tech-not-found';
  if (tech.status !== 'Active') return 'tech-inactive';
  if (!Array.isArray(tech.orgIds) || !tech.orgIds.includes(orgId)) return 'tech-not-in-org';
  return null;
}

/** The fields that make a work order assigned to, and accepted by, the in-house tech. */
export function inHouseAcceptedFields(techId: string, now: number): { assignedTechId: string; acknowledgedAt: number } {
  return { assignedTechId: techId, acknowledgedAt: now };
}

/** Statuses a new work order can be handed to the in-house tech in. */
const IN_HOUSE_CREATE_STATUSES: ReadonlySet<string> = new Set(['Backlog', 'Scheduled']);

/** What a creation path knows about an in-house org when it builds new work orders. */
export interface InHouseCreateContext {
  orgId: string;
  /** `resolveInHouseTech` for the org. */
  inHouse: InHouseTechResolution;
  /** The org's tech docs, to vet a payload's already-named assignee (e.g. an intake rule's). */
  orgTechs: readonly InHouseTechLike[];
}

/**
 * Make a NEW work-order payload of an in-house org accepted before it is
 * written — nothing in an in-house org sits unaccepted. Every creation path
 * calls this one function. Mutates `payload`.
 *
 * - `kept`: it already names an active tech of the org (an intake rule's
 *   assignee): that tech keeps it, accepted.
 * - `assigned`: unassigned, or named someone who is not an active org tech:
 *   the in-house tech takes it, accepted.
 * - `unresolved`: the in-house tech cannot be resolved: left unassigned (an
 *   invalid named assignee is cleared) for a human, never offered.
 * - `skipped`, untouched: an emergency (broadcast-accept flow) or not open work.
 */
export function applyInHouseToNewWorkOrder(
  payload: Record<string, unknown>,
  ctx: InHouseCreateContext,
  now: number,
): 'kept' | 'assigned' | 'unresolved' | 'skipped' {
  if (payload.isEmergency === true) return 'skipped';
  if (!IN_HOUSE_CREATE_STATUSES.has(String(payload.status))) return 'skipped';
  const named = typeof payload.assignedTechId === 'string' && payload.assignedTechId ? payload.assignedTechId : null;
  if (named && !activeOrgTechProblem(ctx.orgId, named, ctx.orgTechs.find((t) => t.id === named))) {
    Object.assign(payload, inHouseAcceptedFields(named, now));
    return 'kept';
  }
  if ('reason' in ctx.inHouse) {
    if (named) payload.assignedTechId = null;
    return 'unresolved';
  }
  Object.assign(payload, inHouseAcceptedFields(ctx.inHouse.techId, now));
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
