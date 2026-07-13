/**
 * Bounty draw mechanics (Change Order 2, doc 09 §3.1/§3.3) — pure, no I/O.
 *
 * The draw is the feature's audit-integrity core: cleaners must not be able
 * to predict the spot, and operators must be able to prove it was random.
 * The server seeds `mulberry32` with a crypto-random seed and logs the seed +
 * roll + candidate list in the draw event, so any draw can be replayed.
 */
import type { CleanBountySpot, CleanParamSnapshot } from '../types/clean';

/** Exclude the property's last N drawn spots so repeat cleans don't repeat (B1). */
export const BOUNTY_RECENT_SPOT_EXCLUSION_N = 3;

/** Default submission geofence radius, meters (generous for GPS drift). */
export const BOUNTY_DEFAULT_GEOFENCE_M = 150;

/**
 * Deterministic 32-bit PRNG. Given the same seed it replays the same
 * sequence — the property that makes logged draws provable.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lowercase, strip everything but letters/digits — 'Game_Room' ≡ 'game room'. */
export function normalizeParamToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Categories assumed present when a location has no parameter data (doc §3.3). */
const ASSUMED_CATEGORIES: readonly string[] = ['kitchen', 'bath', 'utility'];

/**
 * Filter the spot list by what the location actually has (doc §3.3, B7).
 * Rules:
 *  - inactive spots never pass;
 *  - spots without `requiresParameter` describe universal locations → always pass;
 *  - spots WITH `requiresParameter` pass iff some param with qty > 0 has a
 *    normalized label or id containing the normalized token;
 *  - with NO parameter data at all (STR without a snapshot), a parameterized
 *    spot passes only when its category is one of the assumed-present
 *    defaults (kitchen/bath/utility).
 */
export function filterEligibleSpots(
  spots: CleanBountySpot[],
  params: CleanParamSnapshot[],
): CleanBountySpot[] {
  const present = params
    .filter((p) => p.qty > 0)
    .map((p) => ({ label: normalizeParamToken(p.label), id: normalizeParamToken(p.paramId) }));
  const hasParamData = params.length > 0;

  return spots.filter((spot) => {
    if (!spot.active) return false;
    const token = spot.requiresParameter ? normalizeParamToken(spot.requiresParameter) : '';
    if (!token) return true;
    if (!hasParamData) return ASSUMED_CATEGORIES.includes(spot.category);
    return present.some((p) => p.label.includes(token) || p.id.includes(token));
  });
}

/** Drop the property's most recent spot ids (B1 anti-repetition). */
export function excludeRecentSpots(
  spots: CleanBountySpot[],
  recentSpotIds: string[],
  n: number = BOUNTY_RECENT_SPOT_EXCLUSION_N,
): CleanBountySpot[] {
  const excluded = new Set(recentSpotIds.slice(0, n));
  return spots.filter((s) => !excluded.has(s.id));
}

/** Bounty amount at draw: fixed minor units, or a whole percent of the job total. */
export function computeBountyAmountMinor(
  program: { amountType: 'fixed' | 'pct_of_job'; amountValue: number },
  bookingTotalMinor: number,
): number {
  if (program.amountType === 'fixed') return Math.max(0, Math.trunc(program.amountValue));
  return Math.max(0, Math.round((bookingTotalMinor * program.amountValue) / 100));
}

export interface BountyCapCheckInput {
  amountMinor: number;
  /** Σ amountMinor of this org's bounties drawn this org-local month. */
  monthlyDrawnMinor: number;
  monthlyBudgetCapMinor?: number;
  /** Σ amountMinor of today's bounties per assigned tech. */
  perTechDailyDrawnMinor: Record<string, number>;
  perCleanerDailyCapMinor?: number;
  techIds: string[];
}

export type BountyCapCheckResult =
  | { ok: true }
  | { ok: false; reason: 'cap_monthly' | 'cap_daily'; techId?: string };

/**
 * Caps are enforced at draw time, never at payout ("don't offer what you
 * might not pay", doc §5). A hit means no bounty row is written at all (B6).
 */
export function checkBountyCaps(input: BountyCapCheckInput): BountyCapCheckResult {
  if (
    input.monthlyBudgetCapMinor !== undefined &&
    input.monthlyDrawnMinor + input.amountMinor > input.monthlyBudgetCapMinor
  ) {
    return { ok: false, reason: 'cap_monthly' };
  }
  if (input.perCleanerDailyCapMinor !== undefined) {
    for (const techId of input.techIds) {
      const drawn = input.perTechDailyDrawnMinor[techId] ?? 0;
      if (drawn + input.amountMinor > input.perCleanerDailyCapMinor) {
        return { ok: false, reason: 'cap_daily', techId };
      }
    }
  }
  return { ok: true };
}

/** Uniform pick from the (already filtered) list. */
export function drawBountySpot(
  spots: CleanBountySpot[],
  rand: () => number,
): CleanBountySpot {
  if (spots.length === 0) throw new Error('drawBountySpot: empty spot list');
  return spots[Math.min(spots.length - 1, Math.floor(rand() * spots.length))];
}
