import { describe, it, expect } from 'vitest';
import {
  BOUNTY_PHASH_HAMMING_THRESHOLD,
  DHASH_HEIGHT,
  DHASH_WIDTH,
  GENTLE_RESHOOT,
  buildCorpus,
  hammingDistanceHex,
  hashScene,
  highestZeroFalseAcceptThreshold,
  makeRng,
  randomLayout,
  renderLayout,
  renderScene,
  renderSimilarScene,
  reshoot,
  downsampleToGrid,
  sweepThreshold,
} from '../../src/clean';

/**
 * TURNWRK-170 — properties of the threshold harness, not its exact numbers.
 *
 * Pinning the counts would make every generator tweak look like a regression;
 * what must hold is that the corpus is reproducible, that the sweep is monotone,
 * and that the two classes are actually separable. The numbers themselves live
 * in `npm run phash:sweep`, which anyone can re-run.
 */

describe('corpus determinism (TURNWRK-170)', () => {
  it('gives the same corpus for the same seed', () => {
    const a = buildCorpus({ seed: 42, pairsPerClass: 8 });
    const b = buildCorpus({ seed: 42, pairsPerClass: 8 });
    expect(a).toEqual(b);
  });

  it('gives a different corpus for a different seed', () => {
    const a = buildCorpus({ seed: 42, pairsPerClass: 8 });
    const b = buildCorpus({ seed: 43, pairsPerClass: 8 });
    expect(a).not.toEqual(b);
  });

  it('is balanced across the four pair classes', () => {
    const pairs = buildCorpus({ seed: 1, pairsPerClass: 5 });
    const counts = pairs.reduce<Record<string, number>>((acc, p) => {
      acc[p.label] = (acc[p.label] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({
      'reshoot:gentle': 5,
      'reshoot:harsh': 5,
      'distinct:lookalike': 5,
      'distinct:unrelated': 5,
    });
    expect(pairs.filter((p) => p.duplicate)).toHaveLength(10);
  });
});

describe('the sweep (TURNWRK-170)', () => {
  const pairs = buildCorpus({ seed: 20260813, pairsPerClass: 60 });
  const rows = sweepThreshold(pairs);

  it('trades one error for the other monotonically', () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].falseAccepts).toBeGreaterThanOrEqual(rows[i - 1].falseAccepts);
      expect(rows[i].falseRejects).toBeLessThanOrEqual(rows[i - 1].falseRejects);
    }
  });

  it('rejects everything at threshold 0 and accepts everything at the top', () => {
    expect(rows[0].falseAccepts).toBe(0);
    expect(rows[rows.length - 1].falseRejects).toBe(0);
  });

  it('splits both error counts by pair class', () => {
    const row = rows[BOUNTY_PHASH_HAMMING_THRESHOLD];
    const summed =
      row.byLabel['distinct:lookalike'] +
      row.byLabel['distinct:unrelated'] +
      row.byLabel['reshoot:gentle'] +
      row.byLabel['reshoot:harsh'];
    expect(summed).toBe(row.falseAccepts + row.falseRejects);
  });

  it('separates re-shoots from different rooms well enough to have a curve at all', () => {
    // If this fails the corpus is not measuring anything: there would be no
    // threshold that does better than a coin flip.
    const ceiling = highestZeroFalseAcceptThreshold(rows);
    expect(ceiling).toBeGreaterThan(0);
    expect(rows[ceiling].falseRejectRate).toBeLessThan(rows[0].falseRejectRate);
  });

  it('lets the current threshold through with no false accepts', () => {
    // Not an argument that 6 is optimal — only that it is on the safe side of
    // the error that costs money. Where exactly to sit is the owner's call.
    expect(rows[BOUNTY_PHASH_HAMMING_THRESHOLD].falseAccepts).toBe(0);
  });
});

describe('the negative class is not mislabeled data (TURNWRK-170)', () => {
  it('hashes a re-toned scene identically, which is why a lookalike cannot be one', () => {
    // dHash compares each pixel to its right neighbour, so any monotone
    // gain-and-offset leaves every comparison — and therefore the hash —
    // untouched. The first version of renderSimilarScene did exactly this and
    // labeled the result "not a duplicate", putting a 27% false-accept floor
    // under the whole curve. This test is that bug's headstone.
    const rng = makeRng(7);
    const scene = renderScene(rng);
    const retoned = {
      ...scene,
      luma: scene.luma.map((v) => Math.min(255, Math.max(0, (v - 128) * 0.9 + 128 + 10))),
    };
    expect(hashScene(retoned)).toBe(hashScene(scene));
  });

  it('makes a lookalike genuinely further away than a re-shoot', () => {
    const rng = makeRng(11);
    const layout = randomLayout(rng);
    const scene = renderLayout(rng, layout);
    const again = reshoot(scene, rng, GENTLE_RESHOOT);
    const lookalike = renderSimilarScene(rng, layout);
    const base = hashScene(scene);
    expect(hammingDistanceHex(base, hashScene(again))).toBeLessThan(
      hammingDistanceHex(base, hashScene(lookalike)),
    );
  });
});

describe('the corpus runs the production reduction (TURNWRK-170)', () => {
  it('area-averages down to exactly the dHash grid', () => {
    const grid = downsampleToGrid(renderScene(makeRng(3)));
    expect(grid).toHaveLength(DHASH_WIDTH * DHASH_HEIGHT);
    for (const v of grid) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });

  it('produces a 16-hex-char hash, same shape the server writes', () => {
    expect(hashScene(renderScene(makeRng(5)))).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('the constant itself', () => {
  it('is still 6 — changing it is the owner half of this card', () => {
    // TURNWRK-170 splits at the point judgment starts: the harness and the
    // curve are agent work, picking the number off it is not. If this test
    // fails, the change was either deliberate (update it here and say why on
    // the card) or an accident.
    expect(BOUNTY_PHASH_HAMMING_THRESHOLD).toBe(6);
  });
});
