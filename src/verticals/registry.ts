/**
 * The vertical registry (TURNWRK-315) — static and frozen, mirroring
 * `ONBOARDING_CATALOGS` (src/onboarding/catalogs/index.ts). No runtime
 * registration: a pack exists because it is authored here, so the whole set is
 * knowable from a typecheck.
 */
import type { VerticalKey, VerticalPack } from './types';
import { VERTICAL_KEYS } from './types';
import { CLEANING_PACK } from './packs/cleaning';
import { STR_TURNOVER_PACK } from './packs/strTurnover';
import { POOL_PACK } from './packs/pool';
import { LANDSCAPING_PACK } from './packs/landscaping';
import { HANDYMAN_PACK } from './packs/handyman';

/**
 * Packs land per phase (docs/projects/VERTICAL-MODULES.md § Sequencing), so this
 * stays typed `Partial` even though every key is now authored: `cleaning` +
 * `str_turnover` in phase A (TURNWRK-316), `pool` / `landscaping` / `handyman`
 * in phase E (TURNWRK-329). Callers use `packFor` (tolerant) or `requirePack`
 * (loud) rather than indexing it directly.
 */
export const VERTICAL_REGISTRY: Readonly<Partial<Record<VerticalKey, VerticalPack>>> =
  Object.freeze({
    cleaning: CLEANING_PACK,
    str_turnover: STR_TURNOVER_PACK,
    pool: POOL_PACK,
    landscaping: LANDSCAPING_PACK,
    handyman: HANDYMAN_PACK,
  });

/** The pack for a trade, or undefined while that trade is unauthored. */
export function packFor(key: VerticalKey): VerticalPack | undefined {
  return VERTICAL_REGISTRY[key];
}

/**
 * The pack for a trade, throwing when it is unauthored. Use where a missing
 * pack is a programming error (a code path gated on `resolveOrgVerticals`);
 * the throw is deliberately loud rather than a silent cleaning fallback.
 */
export function requirePack(key: VerticalKey): VerticalPack {
  const pack = VERTICAL_REGISTRY[key];
  if (!pack) {
    throw new Error(
      `No vertical pack authored for '${key}' (see docs/projects/VERTICAL-MODULES.md)`,
    );
  }
  return pack;
}

/** Trades that currently have a pack, in `VERTICAL_KEYS` order. */
export function authoredVerticalKeys(): VerticalKey[] {
  return VERTICAL_KEYS.filter((key) => VERTICAL_REGISTRY[key] !== undefined);
}

export function isVerticalKey(value: unknown): value is VerticalKey {
  return typeof value === 'string' && (VERTICAL_KEYS as readonly string[]).includes(value);
}
