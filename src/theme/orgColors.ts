/**
 * Deterministic multi-org context-dot palette (Turnwrk Suite Design System).
 *
 * Promoted from dispatch/lib/orgColors.ts so every app that shows a vendor's
 * multi-org membership tags dots them the same, index-stable way. Org identity,
 * not brand — intentionally distinct from the terracotta accent slot.
 */
const ORG_DOT_COLORS = [
  'bg-violet-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-fuchsia-500',
] as const;

/** Deterministic dot color class for an org within a vendor's membership list. */
export function getOrgDotColor(orgId: string, orgIds: string[]): string {
  const idx = orgIds.indexOf(orgId);
  const slot = idx >= 0 ? idx : orgId.split('').reduce((h, c) => h + c.charCodeAt(0), 0);
  return ORG_DOT_COLORS[slot % ORG_DOT_COLORS.length];
}
