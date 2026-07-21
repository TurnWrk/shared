/**
 * Pure overlay geometry for the tour renderers (click-shields, dock lift,
 * anchor visibility). Viewport-coordinate math only — no DOM, no React.
 * Apps pass `getBoundingClientRect()`-shaped rects and window dimensions.
 */

/** Viewport-coordinate rectangle (same shape as DOMRect's top/left/width/height). */
export interface TourRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Rects for the click-catching shields around a spotlight cutout.
 *
 * With no `spot` (modal step, or anchor still mounting) the whole viewport is
 * shielded — identical to a blocking scrim. With a spot, four bands tile the
 * viewport around the cutout (above / below / left / right), leaving the
 * cutout itself open so the real anchored control receives the click that
 * advances an action-advanced step. Zero-area bands (spot flush to an edge)
 * are omitted.
 */
export function computeShieldRects(
  spot: TourRect | null,
  vw: number,
  vh: number,
): TourRect[] {
  if (!spot) return [{ top: 0, left: 0, width: vw, height: vh }];

  const top = Math.max(0, Math.min(spot.top, vh));
  const left = Math.max(0, Math.min(spot.left, vw));
  const bottom = Math.max(top, Math.min(spot.top + spot.height, vh));
  const right = Math.max(left, Math.min(spot.left + spot.width, vw));

  const bands: TourRect[] = [
    { top: 0, left: 0, width: vw, height: top },
    { top: bottom, left: 0, width: vw, height: vh - bottom },
    { top, left: 0, width: left, height: bottom - top },
    { top, left: right, width: vw - right, height: bottom - top },
  ];
  return bands.filter((b) => b.width > 0 && b.height > 0);
}

export interface DockLift {
  /** True when the flush bottom dock would cover the spotlight cutout. */
  lifted: boolean;
  /** CSS `bottom` offset for the lifted card (0 when not lifted). */
  bottom: number;
}

/**
 * Whether the bottom-docked bubble must lift above the spotlight, and by how
 * much. The flush dock occupies the band `[vh - cardHeight, vh]`; if the spot
 * intersects that band (bottom tab bars, FABs) the card floats `gap` above the
 * spotlight instead of covering the very control it describes. The offset is
 * clamped so the card never leaves the viewport.
 */
export function computeDockLift(
  spot: TourRect | null,
  cardHeight: number,
  vh: number,
  gap = 12,
): DockLift {
  if (!spot || cardHeight <= 0) return { lifted: false, bottom: 0 };
  const spotBottom = spot.top + spot.height;
  const dockTop = vh - cardHeight;
  if (spotBottom <= dockTop && spot.top < vh) {
    // Spot entirely above the dock band (or the common mid-screen anchor).
    return { lifted: false, bottom: 0 };
  }
  if (spot.top >= vh || spotBottom <= 0) {
    // Spot off-screen; keep the flush dock.
    return { lifted: false, bottom: 0 };
  }
  const bottom = Math.min(vh - spot.top + gap, Math.max(0, vh - cardHeight - gap));
  return { lifted: true, bottom };
}

/** True when the rect sits fully inside the viewport (used to gate scroll-into-view). */
export function isRectFullyVisible(rect: TourRect, vw: number, vh: number): boolean {
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.top + rect.height <= vh &&
    rect.left + rect.width <= vw
  );
}
