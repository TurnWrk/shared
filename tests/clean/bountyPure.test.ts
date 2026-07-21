import { describe, it, expect } from 'vitest';
import type { CleanBountySpot, CleanParamSnapshot } from '../../src/types/clean';
import {
  mulberry32,
  normalizeParamToken,
  filterEligibleSpots,
  excludeRecentSpots,
  computeBountyAmountMinor,
  checkBountyCaps,
  drawBountySpot,
  bountyDrawCommitPreimage,
} from '../../src/clean/bountyDraw';
import {
  checkCaptureWindow,
  resolveGeofence,
  BOUNTY_SYNC_GRACE_MS,
} from '../../src/clean/bountySubmission';
import { DEFAULT_BOUNTY_SPOT_SEEDS, materializeSeedSpots } from '../../src/clean/bountyDefaults';
import {
  dHashFromLuminance,
  hammingDistanceHex,
  isDuplicateHash,
  DHASH_WIDTH,
  DHASH_HEIGHT,
} from '../../src/clean/imageHash';
import { DEFAULT_CLEAN_TEMPLATES } from '../../src/clean/notificationDefaults';

function spot(partial: Partial<CleanBountySpot> & Pick<CleanBountySpot, 'id' | 'category'>): CleanBountySpot {
  return {
    label: partial.id,
    instructionText: 'photo',
    active: true,
    ...partial,
  };
}

describe('bountyDraw', () => {
  it('mulberry32 is deterministic for a seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('bountyDrawCommitPreimage is stable for commit-reveal (TURNWRK-173)', () => {
    expect(bountyDrawCommitPreimage(7, 'org:b1:2026-07-20', 'abc')).toBe(
      '7\norg:b1:2026-07-20\nabc',
    );
  });

  it('filterEligibleSpots respects active, requiresParameter, and assumed categories', () => {
    const spots = [
      spot({ id: 'sink', category: 'kitchen' }),
      spot({ id: 'bath-behind', category: 'bath', requiresParameter: 'bath' }),
      spot({ id: 'game', category: 'living', requiresParameter: 'game room' }),
      spot({ id: 'off', category: 'kitchen', active: false }),
    ];
    const params: CleanParamSnapshot[] = [
      {
        paramId: 'baths',
        label: 'Baths',
        qty: 2,
        unitPriceMinor: 0,
        unitMinutes: 0,
        lineTotalMinor: 0,
      },
    ];
    expect(filterEligibleSpots(spots, params).map((s) => s.id)).toEqual(['sink', 'bath-behind']);
    // No param data → assumed kitchen/bath/utility only
    expect(filterEligibleSpots(spots, []).map((s) => s.id).sort()).toEqual(['bath-behind', 'sink']);
  });

  it('excludeRecentSpots + caps + draw', () => {
    const spots = [spot({ id: 'a', category: 'kitchen' }), spot({ id: 'b', category: 'kitchen' })];
    expect(excludeRecentSpots(spots, ['a']).map((s) => s.id)).toEqual(['b']);
    expect(computeBountyAmountMinor({ amountType: 'fixed', amountValue: 1500 }, 10_000)).toBe(1500);
    expect(computeBountyAmountMinor({ amountType: 'pct_of_job', amountValue: 10 }, 10_000)).toBe(1000);
    expect(
      checkBountyCaps({
        amountMinor: 500,
        monthlyDrawnMinor: 900,
        monthlyBudgetCapMinor: 1000,
        perTechDailyDrawnMinor: {},
        techIds: ['t1'],
      }),
    ).toEqual({ ok: false, reason: 'cap_monthly' });
    const rand = mulberry32(1);
    expect(drawBountySpot(spots, rand).id).toMatch(/^[ab]$/);
    expect(normalizeParamToken('Game_Room')).toBe('gameroom');
  });
});

describe('bountySubmission', () => {
  it('checkCaptureWindow enforces check-in bounds and sync grace', () => {
    expect(
      checkCaptureWindow({
        capturedAt: 100,
        checkedInAt: 50,
        checkedOutAt: 200,
        receivedAt: 150,
      }),
    ).toEqual({ ok: true });
    expect(
      checkCaptureWindow({
        capturedAt: 40,
        checkedInAt: 50,
        receivedAt: 60,
      }).ok,
    ).toBe(false);
    expect(
      checkCaptureWindow({
        capturedAt: 100,
        checkedInAt: 50,
        checkedOutAt: 200,
        receivedAt: 200 + BOUNTY_SYNC_GRACE_MS + 1,
      }),
    ).toEqual({ ok: false, code: 'sync_too_late' });
  });

  it('resolveGeofence ladder: property → check-in → unverified', () => {
    expect(resolveGeofence({ radiusM: 150 })).toEqual({ ok: true, basis: 'unverified' });
    const near = resolveGeofence({
      submissionGeo: { lat: 0, lng: 0 },
      propertyGeo: { lat: 0, lng: 0 },
      radiusM: 150,
    });
    expect(near.ok).toBe(true);
    expect(near.basis).toBe('property');
  });
});

describe('bountyDefaults + imageHash + notificationDefaults', () => {
  it('seeds produce active spots with stable seedKeys', () => {
    expect(DEFAULT_BOUNTY_SPOT_SEEDS.length).toBeGreaterThan(5);
    let n = 0;
    const spots = materializeSeedSpots(() => `spot-${++n}`);
    expect(spots.every((s) => s.active && s.seedKey)).toBe(true);
    expect(spots[0].id).toBe('spot-1');
  });

  it('dHash + hamming detect near-duplicates', () => {
    const n = DHASH_WIDTH * DHASH_HEIGHT;
    const luma = Array.from({ length: n }, (_, i) => (i % 3) * 40);
    const hash = dHashFromLuminance(luma);
    expect(hash).toHaveLength(16);
    expect(hammingDistanceHex(hash, hash)).toBe(0);
    expect(isDuplicateHash(hash, hash)).toBe(true);
  });

  it('DEFAULT_CLEAN_TEMPLATES covers booking_confirmed with email body', () => {
    expect(DEFAULT_CLEAN_TEMPLATES.booking_confirmed.channels.email?.body).toBeTruthy();
  });
});
