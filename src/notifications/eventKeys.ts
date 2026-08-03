import type { CleanNotificationEventKey, CanonicalCleanNotificationEventKey } from './types';

/**
 * Dual-read for renamed notification event keys (Verticals C6 — TURNWRK-325).
 *
 * Saved org override docs and callers may still use `cleaner_en_route`; the
 * canonical registry key is `worker_en_route`. Resolution checks the canonical
 * key first, then legacy aliases.
 */
export const NOTIFICATION_EVENT_KEY_ALIASES: Readonly<
  Partial<Record<CanonicalCleanNotificationEventKey, readonly CleanNotificationEventKey[]>>
> = Object.freeze({
  worker_en_route: ['cleaner_en_route'],
});

const LEGACY_TO_CANONICAL = new Map<CleanNotificationEventKey, CleanNotificationEventKey>();
for (const [canonical, aliases] of Object.entries(NOTIFICATION_EVENT_KEY_ALIASES)) {
  for (const alias of aliases) {
    LEGACY_TO_CANONICAL.set(alias as CleanNotificationEventKey, canonical as CleanNotificationEventKey);
  }
}

/** Map a stored or caller event key to the canonical registry key. */
export function canonicalNotificationEventKey(
  eventKey: CleanNotificationEventKey,
): CanonicalCleanNotificationEventKey {
  return (LEGACY_TO_CANONICAL.get(eventKey) ?? eventKey) as CanonicalCleanNotificationEventKey;
}

/** Keys to consult when loading org overrides (canonical first, then legacy). */
export function notificationEventKeyLookupOrder(
  eventKey: CleanNotificationEventKey,
): CleanNotificationEventKey[] {
  const canonical = canonicalNotificationEventKey(eventKey);
  const aliases = NOTIFICATION_EVENT_KEY_ALIASES[canonical] ?? [];
  return [canonical, ...aliases.filter((k) => k !== canonical)];
}
