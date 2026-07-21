import { describe, it, expect } from 'vitest';
import {
  computeShieldRects,
  computeDockLift,
  isRectFullyVisible,
  type TourRect,
} from '../src/onboarding';

const VW = 390;
const VH = 844;

describe('computeShieldRects', () => {
  it('shields the full viewport when there is no spot (modal step)', () => {
    expect(computeShieldRects(null, VW, VH)).toEqual([
      { top: 0, left: 0, width: VW, height: VH },
    ]);
  });

  it('tiles four bands around a centered spot, leaving the cutout open', () => {
    const spot: TourRect = { top: 300, left: 100, width: 120, height: 60 };
    const rects = computeShieldRects(spot, VW, VH);
    expect(rects).toHaveLength(4);
    // Above / below span the full width; left / right span the spot rows.
    expect(rects[0]).toEqual({ top: 0, left: 0, width: VW, height: 300 });
    expect(rects[1]).toEqual({ top: 360, left: 0, width: VW, height: VH - 360 });
    expect(rects[2]).toEqual({ top: 300, left: 0, width: 100, height: 60 });
    expect(rects[3]).toEqual({ top: 300, left: 220, width: VW - 220, height: 60 });
    // No band overlaps the cutout.
    for (const r of rects) {
      const intersects =
        r.left < spot.left + spot.width &&
        r.left + r.width > spot.left &&
        r.top < spot.top + spot.height &&
        r.top + r.height > spot.top;
      expect(intersects).toBe(false);
    }
  });

  it('omits zero-area bands when the spot is flush to an edge', () => {
    const spot: TourRect = { top: 0, left: 0, width: 100, height: 50 };
    const rects = computeShieldRects(spot, VW, VH);
    expect(rects).toHaveLength(2); // no above band, no left band
    expect(rects.every((r) => r.width > 0 && r.height > 0)).toBe(true);
  });

  it('clamps a spot that extends past the viewport', () => {
    const spot: TourRect = { top: VH - 40, left: -10, width: VW + 20, height: 100 };
    const rects = computeShieldRects(spot, VW, VH);
    // Only the band above survives (spot reaches bottom + both sides).
    expect(rects).toEqual([{ top: 0, left: 0, width: VW, height: VH - 40 }]);
  });
});

describe('computeDockLift', () => {
  const CARD = 180;

  it('keeps the flush dock for mid-screen anchors', () => {
    const spot: TourRect = { top: 200, left: 20, width: 200, height: 60 };
    expect(computeDockLift(spot, CARD, VH)).toEqual({ lifted: false, bottom: 0 });
  });

  it('lifts above a bottom tab-bar spot', () => {
    // Tab bar spot: top 730 on an 844px viewport; dock band starts at 664.
    const spot: TourRect = { top: 730, left: 0, width: VW, height: 72 };
    const lift = computeDockLift(spot, CARD, VH);
    expect(lift.lifted).toBe(true);
    expect(lift.bottom).toBe(VH - 730 + 12); // gap above the spotlight
    // Card fully on screen: bottom + cardHeight ≤ vh.
    expect(lift.bottom + CARD).toBeLessThanOrEqual(VH);
  });

  it('lifts for a FAB breaking out above the tab bar', () => {
    const spot: TourRect = { top: 700, left: 160, width: 70, height: 70 };
    const lift = computeDockLift(spot, CARD, VH);
    expect(lift.lifted).toBe(true);
    expect(lift.bottom).toBe(VH - 700 + 12);
  });

  it('clamps the lift so a tall spot cannot push the card off the top', () => {
    const spot: TourRect = { top: 40, left: 0, width: VW, height: VH - 40 };
    const lift = computeDockLift(spot, CARD, VH);
    expect(lift.lifted).toBe(true);
    expect(lift.bottom).toBe(VH - CARD - 12);
  });

  it('ignores null spots and zero card heights', () => {
    expect(computeDockLift(null, CARD, VH)).toEqual({ lifted: false, bottom: 0 });
    const spot: TourRect = { top: 800, left: 0, width: VW, height: 40 };
    expect(computeDockLift(spot, 0, VH)).toEqual({ lifted: false, bottom: 0 });
  });

  it('keeps the flush dock when the spot is entirely off-screen', () => {
    expect(
      computeDockLift({ top: VH + 10, left: 0, width: VW, height: 40 }, CARD, VH),
    ).toEqual({ lifted: false, bottom: 0 });
    expect(
      computeDockLift({ top: -80, left: 0, width: VW, height: 40 }, CARD, VH),
    ).toEqual({ lifted: false, bottom: 0 });
  });
});

describe('isRectFullyVisible', () => {
  it('is true only when the rect sits inside the viewport', () => {
    expect(isRectFullyVisible({ top: 10, left: 10, width: 50, height: 50 }, VW, VH)).toBe(true);
    expect(isRectFullyVisible({ top: -1, left: 10, width: 50, height: 50 }, VW, VH)).toBe(false);
    expect(isRectFullyVisible({ top: 10, left: 10, width: VW, height: 50 }, VW, VH)).toBe(false);
    expect(isRectFullyVisible({ top: VH - 40, left: 0, width: 50, height: 50 }, VW, VH)).toBe(false);
  });
});
