/**
 * A labeled corpus for BOUNTY_PHASH_HAMMING_THRESHOLD (TURNWRK-170).
 *
 * The threshold of 6 in `imageHash.ts` is a tuned guess carried over from the
 * Change Order doc. Nobody can re-derive it, because the corpus that would
 * justify it was never built. This module builds one synthetically so the
 * number stops being folklore.
 *
 * WHY SYNTHETIC. Real bounty photos are customer data in clean's production
 * Storage. Owner decision 2026-08-13: keep the corpus synthetic so the harness
 * needs no privacy sign-off, runs in CI, and is reproducible by anyone with the
 * repo. Everything here is seeded — same seed, same corpus, same curve.
 *
 * WHAT IT MODELS, AND WHAT IT DOES NOT. A positive pair is one scene
 * photographed twice: the camera moves slightly, the exposure drifts, the
 * sensor adds noise, and the JPEG encoder quantizes. Those are the four things
 * that actually differ between a cleaner's first photo and their re-shoot, and
 * each is applied at a magnitude you can read and argue with below. A negative
 * pair is two different scenes.
 *
 * It does NOT model the real-world *distribution* — how often a re-shoot is
 * gentle versus violent, how many bounty photos are near-identical white walls.
 * That distribution is what a production export would give you, and this
 * harness deliberately does not have it. So the curve below answers "how does
 * the hash respond to a re-shoot of known severity", not "what fraction of real
 * submissions would this threshold misjudge". Read it as the former.
 *
 * The pipeline mirrors production exactly: a scene is rendered at working
 * resolution, transformed, area-downsampled to the 9x8 dHash grid — the same
 * reduction `sharp(...).resize(9, 8, { fit: 'fill' })` performs in
 * clean/src/lib/clean/imageHashServer.ts — and hashed with the shared
 * `dHashFromLuminance`. Nothing here reimplements the hash.
 */
import { DHASH_HEIGHT, DHASH_WIDTH, dHashFromLuminance, hammingDistanceHex } from './imageHash';

/** Working resolution: 8x the hash grid, so sub-cell motion is representable. */
export const SCENE_WIDTH = DHASH_WIDTH * 8;
export const SCENE_HEIGHT = DHASH_HEIGHT * 8;

/** A grayscale raster, row-major, 0-255. */
export interface Scene {
  width: number;
  height: number;
  luma: Float64Array;
}

/**
 * How violently a re-shoot differs from the original. These are the knobs the
 * curve is sensitive to, so they are named and defaulted in one place rather
 * than scattered as literals.
 */
export interface ReshootSeverity {
  /** Camera shift, in working-resolution pixels, per axis. */
  translatePx: number;
  /** Camera roll, in degrees. */
  rotateDeg: number;
  /** Exposure gain, as a fraction (0.08 = up to +/-8%). */
  brightness: number;
  /** Additive sensor noise, in luminance units. */
  noise: number;
  /** JPEG-ish quantization step, in luminance units. */
  quantize: number;
}

/** A cleaner re-photographing the same room a minute later. */
export const GENTLE_RESHOOT: ReshootSeverity = {
  translatePx: 2,
  rotateDeg: 1.5,
  brightness: 0.06,
  noise: 3,
  quantize: 8,
};

/** The same room, but they moved and the light changed. */
export const HARSH_RESHOOT: ReshootSeverity = {
  translatePx: 6,
  rotateDeg: 5,
  brightness: 0.18,
  noise: 8,
  quantize: 16,
};

// --- determinism -----------------------------------------------------------

/** mulberry32 — small, fast, and seedable. No dependency, by design. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rng: () => number, lo: number, hi: number) => lo + rng() * (hi - lo);

// --- scene synthesis -------------------------------------------------------

/**
 * A plausible room photo at working resolution: a lit background gradient with
 * a handful of darker rectangles (furniture, doorways, counters). Blunt on
 * purpose — the hash only ever sees a 9x8 reduction, where a real photo is
 * blocks of tone too.
 */
export function renderScene(rng: () => number): Scene {
  return renderLayout(rng, randomLayout(rng));
}

/**
 * The structural description of a room: its lighting gradient and the blocks
 * of furniture in it. Kept separate from the raster so a *different* room can
 * be generated that photographs similarly — see `renderSimilarScene`.
 */
export interface SceneLayout {
  base: number;
  gx: number;
  gy: number;
  blocks: Array<{ x0: number; y0: number; w: number; h: number; delta: number }>;
}

/** Signed magnitude at least `min` — a room photo is never perfectly flat. */
function signedAtLeast(rng: () => number, min: number, max: number): number {
  const mag = between(rng, min, max);
  return rng() < 0.5 ? -mag : mag;
}

export function randomLayout(rng: () => number): SceneLayout {
  const blockCount = 3 + Math.floor(rng() * 4);
  const blocks: SceneLayout['blocks'] = [];
  for (let b = 0; b < blockCount; b++) {
    const w = Math.floor(between(rng, SCENE_WIDTH * 0.12, SCENE_WIDTH * 0.45));
    const h = Math.floor(between(rng, SCENE_HEIGHT * 0.12, SCENE_HEIGHT * 0.5));
    blocks.push({
      x0: Math.floor(between(rng, 0, SCENE_WIDTH - w)),
      y0: Math.floor(between(rng, 0, SCENE_HEIGHT - h)),
      w,
      h,
      delta: signedAtLeast(rng, 25, 70),
    });
  }
  return {
    base: between(rng, 90, 170),
    // Bounded away from zero: a featureless wall makes every adjacent-pixel
    // comparison a coin flip, which says more about the test image than about
    // the threshold. Low-texture scenes are a real dHash weakness — see the
    // findings in the sweep report — but they should not be most of the corpus.
    gx: signedAtLeast(rng, 0.15, 0.5),
    gy: signedAtLeast(rng, 0.15, 0.6),
    blocks,
  };
}

export function renderLayout(rng: () => number, layout: SceneLayout): Scene {
  const luma = new Float64Array(SCENE_WIDTH * SCENE_HEIGHT);
  const { base, gx, gy } = layout;

  for (let y = 0; y < SCENE_HEIGHT; y++) {
    for (let x = 0; x < SCENE_WIDTH; x++) {
      luma[y * SCENE_WIDTH + x] = base + gx * (x - SCENE_WIDTH / 2) + gy * (y - SCENE_HEIGHT / 2);
    }
  }

  for (const { x0, y0, w, h, delta } of layout.blocks) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) luma[y * SCENE_WIDTH + x] += delta;
    }
  }

  for (let i = 0; i < luma.length; i++) luma[i] = clamp(luma[i]);
  return { width: SCENE_WIDTH, height: SCENE_HEIGHT, luma };
}

/**
 * A DIFFERENT room that photographs like this one: same lighting direction and
 * roughly the same amount of furniture, all of it in different places.
 *
 * Hard negatives are the whole point of the negative set. Two unrelated random
 * scenes are trivially far apart at any threshold, which produces a flattering
 * curve that says nothing. Real false accepts come from *similar* rooms: the
 * identical unit next door, the same bathroom on a different floor.
 *
 * What this must NOT be is the source scene re-toned. A global gain-and-offset
 * leaves every adjacent-pixel comparison intact, so dHash returns the identical
 * hash by construction — and calling that pair "not a duplicate" is mislabeled
 * data, not a hard negative. The first version of this generator did exactly
 * that and put a floor of 27% false accepts under the whole curve.
 */
export function renderSimilarScene(rng: () => number, source: SceneLayout): Scene {
  const fresh = randomLayout(rng);
  return renderLayout(rng, {
    // Same room type, same light: keep the gradient's direction and a similar
    // overall tone, and re-place everything in it.
    base: clamp(source.base + between(rng, -20, 20)),
    gx: source.gx * between(rng, 0.7, 1.3),
    gy: source.gy * between(rng, 0.7, 1.3),
    blocks: fresh.blocks,
  });
}

// --- the re-shoot ----------------------------------------------------------

/** Bilinear sample, edge-clamped. */
function sample(scene: Scene, x: number, y: number): number {
  const cx = Math.min(Math.max(x, 0), scene.width - 1);
  const cy = Math.min(Math.max(y, 0), scene.height - 1);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(x0 + 1, scene.width - 1);
  const y1 = Math.min(y0 + 1, scene.height - 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const top = scene.luma[y0 * scene.width + x0] * (1 - fx) + scene.luma[y0 * scene.width + x1] * fx;
  const bot = scene.luma[y1 * scene.width + x0] * (1 - fx) + scene.luma[y1 * scene.width + x1] * fx;
  return top * (1 - fy) + bot * fy;
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** Photograph the same scene again: move, tilt, re-expose, add grain, re-encode. */
export function reshoot(scene: Scene, rng: () => number, severity: ReshootSeverity): Scene {
  const dx = between(rng, -severity.translatePx, severity.translatePx);
  const dy = between(rng, -severity.translatePx, severity.translatePx);
  const theta = (between(rng, -severity.rotateDeg, severity.rotateDeg) * Math.PI) / 180;
  const gain = 1 + between(rng, -severity.brightness, severity.brightness);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const cxc = scene.width / 2;
  const cyc = scene.height / 2;

  const luma = new Float64Array(scene.luma.length);
  for (let y = 0; y < scene.height; y++) {
    for (let x = 0; x < scene.width; x++) {
      const ox = x - cxc;
      const oy = y - cyc;
      const sx = cxc + ox * cos - oy * sin + dx;
      const sy = cyc + ox * sin + oy * cos + dy;
      let v = sample(scene, sx, sy) * gain;
      v += between(rng, -severity.noise, severity.noise);
      // Quantization stands in for JPEG re-encoding: the encoder's visible
      // effect at a 9x8 reduction is tone banding, not ringing.
      if (severity.quantize > 0) v = Math.round(v / severity.quantize) * severity.quantize;
      luma[y * scene.width + x] = clamp(v);
    }
  }
  return { width: scene.width, height: scene.height, luma };
}

// --- the production reduction ----------------------------------------------

/**
 * Area-average down to the dHash grid. This is what `sharp.resize(9, 8, {
 * fit: 'fill' })` does before `dHashFromLuminance` sees anything, so the corpus
 * exercises the same reduction production does.
 */
export function downsampleToGrid(scene: Scene): Float64Array {
  const out = new Float64Array(DHASH_WIDTH * DHASH_HEIGHT);
  const cellW = scene.width / DHASH_WIDTH;
  const cellH = scene.height / DHASH_HEIGHT;
  for (let gy = 0; gy < DHASH_HEIGHT; gy++) {
    for (let gx = 0; gx < DHASH_WIDTH; gx++) {
      const x0 = Math.floor(gx * cellW);
      const x1 = Math.max(x0 + 1, Math.floor((gx + 1) * cellW));
      const y0 = Math.floor(gy * cellH);
      const y1 = Math.max(y0 + 1, Math.floor((gy + 1) * cellH));
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          sum += scene.luma[y * scene.width + x];
          n++;
        }
      }
      out[gy * DHASH_WIDTH + gx] = sum / n;
    }
  }
  return out;
}

export function hashScene(scene: Scene): string {
  return dHashFromLuminance(downsampleToGrid(scene), DHASH_WIDTH, DHASH_HEIGHT);
}

// --- the corpus ------------------------------------------------------------

export interface LabeledPair {
  a: string;
  b: string;
  /** true = same scene re-shot; false = two different scenes. */
  duplicate: boolean;
  distance: number;
  label: string;
}

export interface CorpusOptions {
  seed?: number;
  /** Positive pairs at each severity, and negative pairs of each kind. */
  pairsPerClass?: number;
}

/**
 * Four classes, balanced: gentle re-shoots and harsh re-shoots (both true
 * duplicates), near-miss scenes and unrelated scenes (both non-duplicates).
 */
export function buildCorpus(options: CorpusOptions = {}): LabeledPair[] {
  const { seed = 20260813, pairsPerClass = 120 } = options;
  const rng = makeRng(seed);
  const pairs: LabeledPair[] = [];

  const positive = (severity: ReshootSeverity, label: string) => {
    for (let i = 0; i < pairsPerClass; i++) {
      const scene = renderScene(rng);
      const again = reshoot(scene, rng, severity);
      const a = hashScene(scene);
      const b = hashScene(again);
      pairs.push({ a, b, duplicate: true, distance: hammingDistanceHex(a, b), label });
    }
  };

  positive(GENTLE_RESHOOT, 'reshoot:gentle');
  positive(HARSH_RESHOOT, 'reshoot:harsh');

  for (let i = 0; i < pairsPerClass; i++) {
    const layout = randomLayout(rng);
    const scene = renderLayout(rng, layout);
    const lookalike = renderSimilarScene(rng, layout);
    const a = hashScene(scene);
    const b = hashScene(lookalike);
    pairs.push({ a, b, duplicate: false, distance: hammingDistanceHex(a, b), label: 'distinct:lookalike' });
  }

  for (let i = 0; i < pairsPerClass; i++) {
    const a = hashScene(renderScene(rng));
    const b = hashScene(renderScene(rng));
    pairs.push({ a, b, duplicate: false, distance: hammingDistanceHex(a, b), label: 'distinct:unrelated' });
  }

  return pairs;
}

// --- the sweep -------------------------------------------------------------

export interface ThresholdRow {
  threshold: number;
  /** Non-duplicates judged duplicate — a resubmitted photo passing as new work. */
  falseAccepts: number;
  falseAcceptRate: number;
  /** Duplicates judged distinct — an honest re-shoot rejected. */
  falseRejects: number;
  falseRejectRate: number;
  /**
   * Both counts split by pair class. The aggregate hides the decision: a
   * threshold that rejects harsh re-shoots is arguably correct (that is a
   * different photo of the room), whereas one that rejects gentle re-shoots is
   * annoying honest cleaners. Same on the other side — a lookalike room is the
   * false accept that costs money, an unrelated scene is free.
   */
  byLabel: Record<string, number>;
}

/**
 * The curve. Read it for false ACCEPTS first: a fraudulent duplicate passing as
 * new work costs a bounty payout and defeats the surprise-inspection premise,
 * whereas a legitimate re-photograph being rejected costs one annoyed cleaner
 * who takes another picture.
 */
export function sweepThreshold(pairs: LabeledPair[], maxThreshold = 20): ThresholdRow[] {
  const duplicates = pairs.filter((p) => p.duplicate);
  const distinct = pairs.filter((p) => !p.duplicate);
  const rows: ThresholdRow[] = [];
  for (let t = 0; t <= maxThreshold; t++) {
    const falseAccepts = distinct.filter((p) => p.distance <= t).length;
    const falseRejects = duplicates.filter((p) => p.distance > t).length;
    const byLabel: Record<string, number> = {};
    for (const p of duplicates) {
      byLabel[p.label] = (byLabel[p.label] ?? 0) + (p.distance > t ? 1 : 0);
    }
    for (const p of distinct) {
      byLabel[p.label] = (byLabel[p.label] ?? 0) + (p.distance <= t ? 1 : 0);
    }
    rows.push({
      threshold: t,
      falseAccepts,
      falseAcceptRate: distinct.length ? falseAccepts / distinct.length : 0,
      falseRejects,
      falseRejectRate: duplicates.length ? falseRejects / duplicates.length : 0,
      byLabel,
    });
  }
  return rows;
}

/** The largest threshold that still admits no false accepts at all. */
export function highestZeroFalseAcceptThreshold(rows: ThresholdRow[]): number {
  let best = -1;
  for (const row of rows) {
    if (row.falseAccepts === 0) best = row.threshold;
    else break;
  }
  return best;
}
