/**
 * The on-call technician from an org's SOP-05 weekly rotation (TURNWRK-738).
 *
 * Lifted from dispatch's `lib/onCall.ts` so cortex can page on-call for a
 * detected emergency without a copy of its own (cortex's twin,
 * `resolveOnCallTechIdFromRotation`, went with the offer jobs in TURNWRK-680).
 * Same rule: the entry whose week contains `now`, else the last entry.
 */
import type { OnCallRotationEntry } from './types/org';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function resolveOnCallTechId(
  org: { onCallRotation?: OnCallRotationEntry[] | null } | null | undefined,
  now: number = Date.now(),
): string | undefined {
  const rotation = org?.onCallRotation ?? [];
  if (rotation.length === 0) return undefined;
  for (const entry of rotation) {
    if (!entry.techId || !entry.weekStart) continue;
    const start = new Date(`${entry.weekStart}T00:00:00`).getTime();
    if (now >= start && now < start + WEEK_MS) return entry.techId;
  }
  return rotation[rotation.length - 1]?.techId;
}
