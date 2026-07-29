/**
 * Org → vertical resolution (TURNWRK-315), mirroring `normalizeEnabledApps`
 * (src/types/org.ts): absent data resolves to today's behaviour so nothing has
 * to be backfilled before the seam is usable.
 *
 * Note what is deliberately absent: suspension and entitlement. A suspended or
 * unpaid org still HAS a trade — `orgAppEnabled` decides whether they may act
 * on it. Mixing the two axes here is exactly the mess the decision record
 * forbids.
 */
import type { Org } from '../types/org';
import type { VerticalKey } from './types';
import { isVerticalKey } from './registry';

type OrgVerticalSource = Pick<Org, 'verticals' | 'primaryVertical' | 'enabledApps'>;

/**
 * The trades an org operates.
 *
 * Explicit `Org.verticals` wins (deduped, unknown keys dropped). Otherwise it
 * derives from the apps they run, per the decision record: Clean-enabled ⇒
 * `['cleaning']`, Dispatch-only ⇒ `['str_turnover']`. Absent `enabledApps`
 * follows `orgAppEnabled`'s default — hostfixCmms on — and so lands on
 * `['str_turnover']`.
 */
export function resolveOrgVerticals(
  org: OrgVerticalSource | null | undefined,
): VerticalKey[] {
  const declared = org?.verticals;
  if (Array.isArray(declared)) {
    const seen = new Set<VerticalKey>();
    for (const value of declared) {
      if (isVerticalKey(value)) seen.add(value);
    }
    if (seen.size > 0) return [...seen];
  }

  const apps = org?.enabledApps;
  if (!apps) return ['str_turnover'];
  if (apps.clean === true) return ['cleaning'];
  if (apps.hostfixCmms === true || apps.cmms === true) return ['str_turnover'];
  return [];
}

/**
 * The trade driving terminology defaults. Explicit `primaryVertical` wins when
 * it is a known key; otherwise the first resolved vertical. Undefined only
 * when the org runs neither Clean nor Dispatch.
 */
export function resolvePrimaryVertical(
  org: OrgVerticalSource | null | undefined,
): VerticalKey | undefined {
  const declared = org?.primaryVertical;
  if (isVerticalKey(declared)) return declared;
  return resolveOrgVerticals(org)[0];
}
