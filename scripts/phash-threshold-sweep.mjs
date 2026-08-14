#!/usr/bin/env node
/**
 * The BOUNTY_PHASH_HAMMING_THRESHOLD curve (TURNWRK-170).
 *
 *   npm run phash:sweep            # default seed and corpus size
 *   npm run phash:sweep -- --seed 7 --pairs 500
 *
 * Runs off dist/, so `npm run build` first (the npm script does it for you).
 * Deterministic: the same seed always prints the same table.
 */
import {
  BOUNTY_PHASH_HAMMING_THRESHOLD,
  buildCorpus,
  sweepThreshold,
  highestZeroFalseAcceptThreshold,
} from '../dist/clean/index.js';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
}

const seed = arg('seed', 20260813);
const pairsPerClass = arg('pairs', 120);
const pairs = buildCorpus({ seed, pairsPerClass });
const rows = sweepThreshold(pairs);
const labels = [...new Set(pairs.map((p) => p.label))].sort();

console.log(`corpus: ${pairs.length} labeled pairs, seed ${seed}, ${pairsPerClass}/class`);
console.log(`current BOUNTY_PHASH_HAMMING_THRESHOLD = ${BOUNTY_PHASH_HAMMING_THRESHOLD}\n`);

for (const label of labels) {
  const ds = pairs.filter((p) => p.label === label).map((p) => p.distance).sort((a, b) => a - b);
  const at = (q) => ds[Math.min(ds.length - 1, Math.floor(ds.length * q))];
  console.log(
    `${label.padEnd(20)} n=${String(ds.length).padStart(4)}  min ${String(ds[0]).padStart(2)}  p50 ${String(at(0.5)).padStart(2)}  p95 ${String(at(0.95)).padStart(2)}  max ${String(ds[ds.length - 1]).padStart(2)}`,
  );
}

const head = ['  t', 'falseAccept', 'falseReject', ...labels.map((l) => l.padStart(19))];
console.log(`\n${head.join('  ')}`);
for (const row of rows) {
  const mark = row.threshold === BOUNTY_PHASH_HAMMING_THRESHOLD ? '<' : ' ';
  const cells = labels.map((l) => String(row.byLabel[l] ?? 0).padStart(19));
  console.log(
    `${mark}${String(row.threshold).padStart(2)}  ` +
      `${(row.falseAcceptRate * 100).toFixed(1).padStart(10)}%  ` +
      `${(row.falseRejectRate * 100).toFixed(1).padStart(10)}%  ` +
      cells.join('  '),
  );
}

const ceiling = highestZeroFalseAcceptThreshold(rows);
const current = rows[BOUNTY_PHASH_HAMMING_THRESHOLD];
console.log(
  `\nhighest threshold with zero false accepts: ${ceiling}` +
    `\nat the current ${BOUNTY_PHASH_HAMMING_THRESHOLD}: ` +
    `${(current.falseAcceptRate * 100).toFixed(1)}% false accepts, ` +
    `${(current.falseRejectRate * 100).toFixed(1)}% false rejects`,
);
console.log('\nPicking the number off this curve is the owner half of TURNWRK-170.');
