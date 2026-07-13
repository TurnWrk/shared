/**
 * Perceptual image hashing — pure half (Change Order 2, doc 09 §3.4).
 *
 * dHash (difference hash): resize to (w+1)×h grayscale, compare each pixel to
 * its right neighbor → 64 gradient bits → 16 hex chars. Robust to re-encoding,
 * mild lighting shifts, and resizing — exactly the "resubmit last month's
 * photo" attack the doc orders blocked. Decoding/resizing happens server-side
 * (clean/src/lib/clean/imageHashServer.ts via sharp); this module is the
 * deterministic math, shared so tests and any future client preview agree.
 *
 * NOTE: no phash implementation existed anywhere in the monorepo — the doc's
 * "same library pattern as the QR-scan pipeline" was aspirational; this is
 * the from-scratch build.
 */

/** Hamming distance at or below this = duplicate (doc §3.4). */
export const BOUNTY_PHASH_HAMMING_THRESHOLD = 6;

export const DHASH_WIDTH = 9; // (w-1)*h = 64 bits
export const DHASH_HEIGHT = 8;

/**
 * Compute the 64-bit dHash from row-major grayscale luminance values of a
 * `width`×`height` image (default 9×8). Returns 16 lowercase hex chars.
 */
export function dHashFromLuminance(
  luma: ArrayLike<number>,
  width: number = DHASH_WIDTH,
  height: number = DHASH_HEIGHT,
): string {
  if (luma.length !== width * height) {
    throw new Error(`dHashFromLuminance: expected ${width * height} values, got ${luma.length}`);
  }
  let hash = '';
  let nibble = 0;
  let bits = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      const left = luma[y * width + x];
      const right = luma[y * width + x + 1];
      nibble = (nibble << 1) | (left > right ? 1 : 0);
      bits++;
      if (bits === 4) {
        hash += nibble.toString(16);
        nibble = 0;
        bits = 0;
      }
    }
  }
  return hash;
}

/** Hamming distance between two equal-length hex hashes (bit-level). */
export function hammingDistanceHex(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new Error('hammingDistanceHex: length mismatch');
  }
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      distance += x & 1;
      x >>= 1;
    }
  }
  return distance;
}

/** Duplicate predicate at the doc's threshold. */
export function isDuplicateHash(a: string, b: string): boolean {
  return hammingDistanceHex(a, b) <= BOUNTY_PHASH_HAMMING_THRESHOLD;
}
