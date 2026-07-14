/**
 * Dual-read CleanAssignment.vendorId (TURNWRK-82).
 *
 * New assignments stamp `vendorId` from `cmms_technicians.vendorId` at assign
 * time. Legacy assignment docs omit it — readers fall back to the tech doc
 * so payout/bounty lines still link to the cross-org vendor identity.
 */
export function resolveAssignmentVendorId(input: {
  assignment?: { vendorId?: string | null } | null;
  tech?: { vendorId?: string | null } | null;
}): string | undefined {
  const fromAssignment = (input.assignment?.vendorId || '').trim();
  if (fromAssignment) return fromAssignment;
  const fromTech = (input.tech?.vendorId || '').trim();
  if (fromTech) return fromTech;
  return undefined;
}

/**
 * Backfill patch when assignment.vendorId is missing. Returns null when the
 * tech has no linked vendor either (nothing to stamp).
 */
export function legacyAssignmentVendorPatch(
  assignment: { vendorId?: string | null },
  tech?: { vendorId?: string | null } | null,
  opts?: { force?: boolean },
): { vendorId: string } | null {
  const existing = (assignment.vendorId || '').trim();
  if (existing && !opts?.force) return null;
  const vendorId = resolveAssignmentVendorId({ assignment, tech });
  if (!vendorId) return null;
  return { vendorId };
}
