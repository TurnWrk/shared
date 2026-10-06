// Moved with the math from cortex tests/tradeEstimator.test.ts (TURNWRK-685).
import { describe, it, expect } from 'vitest';
import {
  assembleEstimate,
  sanitizeScopedLine,
  sanitizeScopedLines,
  sanitizeUnitCents,
  sanitizeBps,
  slugify,
  lineTotalCents,
  LABOR_CENTS_MAX,
  MATERIAL_CENTS_MAX,
  MAX_SCOPED_LINES,
  DEFAULT_OVERHEAD_PROFIT_BPS,
  DEFAULT_CONTINGENCY_BPS,
  type ResolvedRate,
} from '../../src/quotes';
import type { RateProvenance, ScopedLine } from '../../src/quotes';

const RATED_AT = 1_700_000_000_000;
const llm = (region = 'default'): RateProvenance => ({ source: 'llm-regional', region, ratedAt: RATED_AT });

describe('sanitizeScopedLine — the allowlist', () => {
  it('normalizes a valid labor line and forces the hour unit', () => {
    const line = sanitizeScopedLine(
      { kind: 'labor', lineType: 'labor:Plumbing', label: 'Install valve', quantity: 1.5, unit: 'bogus' },
      0,
    );
    expect(line).toEqual({ kind: 'labor', lineType: 'labor:plumbing', label: 'Install valve', quantity: 1.5, unit: 'hour' });
  });

  it('accepts a material line with an allowed unit and derives a slug from the label', () => {
    const line = sanitizeScopedLine({ kind: 'material', label: 'Copper Pipe 1/2"', quantity: 10, unit: 'linear-foot' }, 3);
    expect(line).toEqual({
      kind: 'material',
      lineType: 'material:copper-pipe-1-2',
      label: 'Copper Pipe 1/2"',
      quantity: 10,
      unit: 'linear-foot',
    });
  });

  it('rejects a hallucinated unit on a material line', () => {
    expect(sanitizeScopedLine({ kind: 'material', label: 'Magic', quantity: 1, unit: 'per-soul' }, 0)).toBeNull();
  });

  it('rejects bad kind, empty label, non-positive and over-cap quantities', () => {
    expect(sanitizeScopedLine({ kind: 'fantasy', label: 'x', quantity: 1, unit: 'each' }, 0)).toBeNull();
    expect(sanitizeScopedLine({ kind: 'labor', label: '   ', quantity: 1 }, 0)).toBeNull();
    expect(sanitizeScopedLine({ kind: 'labor', label: 'x', quantity: 0 }, 0)).toBeNull();
    expect(sanitizeScopedLine({ kind: 'labor', label: 'x', quantity: -2 }, 0)).toBeNull();
    expect(sanitizeScopedLine({ kind: 'material', label: 'x', quantity: 100000, unit: 'each' }, 0)).toBeNull();
  });

  it('caps the number of lines and de-dupes by lineType+label', () => {
    const many = Array.from({ length: MAX_SCOPED_LINES + 10 }, (_, i) => ({
      kind: 'material',
      label: `Item ${i}`,
      quantity: 1,
      unit: 'each',
    }));
    expect(sanitizeScopedLines(many)).toHaveLength(MAX_SCOPED_LINES);

    const dupes = [
      { kind: 'labor', label: 'Fix', quantity: 1, unit: 'hour' },
      { kind: 'labor', label: 'Fix', quantity: 2, unit: 'hour' },
    ];
    expect(sanitizeScopedLines(dupes)).toHaveLength(1);
  });

  it('returns [] for a non-array', () => {
    expect(sanitizeScopedLines('nope')).toEqual([]);
    expect(sanitizeScopedLines(null)).toEqual([]);
  });
});

describe('sanitizeUnitCents — rate bounds', () => {
  it('accepts an in-bounds labor rate and rounds to an integer cent', () => {
    expect(sanitizeUnitCents('labor', 9500.4)).toBe(9500);
  });

  it('rejects an absurd or negative rate', () => {
    expect(sanitizeUnitCents('labor', LABOR_CENTS_MAX + 1)).toBeNull();
    expect(sanitizeUnitCents('labor', 500)).toBeNull(); // below $20/hr floor
    expect(sanitizeUnitCents('material', MATERIAL_CENTS_MAX + 1)).toBeNull();
    expect(sanitizeUnitCents('material', -5)).toBeNull();
    expect(sanitizeUnitCents('labor', 'not-a-number')).toBeNull();
  });
});

describe('helpers', () => {
  it('slugify normalizes punctuation and spacing', () => {
    expect(slugify('  Copper Pipe 1/2" ')).toBe('copper-pipe-1-2');
  });

  it('lineTotalCents rounds qty × unit', () => {
    expect(lineTotalCents(1.5, 9500)).toBe(14250);
  });

  it('sanitizeBps clamps to [0, 10000] and falls back on garbage', () => {
    expect(sanitizeBps(-100, 1000)).toBe(0);
    expect(sanitizeBps(20000, 1000)).toBe(10000);
    expect(sanitizeBps('x', 3500)).toBe(3500);
    expect(sanitizeBps(2500, 1000)).toBe(2500);
  });
});

describe('assembleEstimate — pricing + markup + provenance', () => {
  const scoped: ScopedLine[] = [
    { kind: 'labor', lineType: 'labor:plumbing', label: 'Install shutoff valve', quantity: 2, unit: 'hour' },
    { kind: 'material', lineType: 'material:shutoff-valve', label: 'Shutoff valve', quantity: 1, unit: 'each' },
  ];
  const rates = new Map<string, ResolvedRate>([
    ['labor:plumbing', { unitCents: 9500, provenance: llm() }],
    ['material:shutoff-valve', { unitCents: 1800, provenance: llm() }],
  ]);

  it('totals labor + materials + markup and stamps provenance on every line', () => {
    const est = assembleEstimate(scoped, rates, {
      region: 'default',
      generatedAt: RATED_AT,
      overheadProfitBps: DEFAULT_OVERHEAD_PROFIT_BPS,
      contingencyBps: DEFAULT_CONTINGENCY_BPS,
    });

    expect(est.laborCents).toBe(19000); // 2 × 9500
    expect(est.materialsCents).toBe(1800);
    const base = 20800;
    const overhead = Math.round((base * DEFAULT_OVERHEAD_PROFIT_BPS) / 10000); // 7280
    const contingency = Math.round((base * DEFAULT_CONTINGENCY_BPS) / 10000); // 2080
    expect(est.markupCents).toBe(overhead + contingency);
    expect(est.amountCents).toBe(base + overhead + contingency);
    // Invariant: amount always equals the sum of its parts (matches dispatch recompute).
    expect(est.amountCents).toBe(est.laborCents + est.materialsCents + est.markupCents);

    const markupRows = est.lineItems.filter((l) => l.kind === 'markup');
    expect(markupRows).toHaveLength(2);
    expect(markupRows[0].percentBps).toBe(DEFAULT_OVERHEAD_PROFIT_BPS);
    expect(markupRows.every((l) => l.provenance.source === 'derived')).toBe(true);
    expect(est.lineItems.every((l) => l.provenance.ratedAt === RATED_AT)).toBe(true);
    expect(est.rateSources.sort()).toEqual(['derived', 'llm-regional']);
    expect(est.disclaimer).toMatch(/draft/i);
  });

  it('drops a scoped line with no resolved rate (unpriced → not shown)', () => {
    const partial = new Map<string, ResolvedRate>([['labor:plumbing', { unitCents: 9500, provenance: llm() }]]);
    const est = assembleEstimate(scoped, partial, {
      region: 'default',
      generatedAt: RATED_AT,
      overheadProfitBps: 0,
      contingencyBps: 0,
    });
    expect(est.lineItems).toHaveLength(1);
    expect(est.materialsCents).toBe(0);
    expect(est.amountCents).toBe(19000);
  });

  it('emits no markup rows when the base is zero', () => {
    const est = assembleEstimate([], new Map(), {
      region: 'default',
      generatedAt: RATED_AT,
      overheadProfitBps: DEFAULT_OVERHEAD_PROFIT_BPS,
      contingencyBps: DEFAULT_CONTINGENCY_BPS,
    });
    expect(est.lineItems).toHaveLength(0);
    expect(est.markupCents).toBe(0);
    expect(est.amountCents).toBe(0);
  });

  it('carries override provenance through to the assembled line', () => {
    const withOverride = new Map<string, ResolvedRate>([
      ['labor:plumbing', { unitCents: 8500, provenance: { source: 'override', region: 'US-TX', ratedAt: RATED_AT } }],
      ['material:shutoff-valve', { unitCents: 1800, provenance: llm('US-TX') }],
    ]);
    const est = assembleEstimate(scoped, withOverride, {
      region: 'US-TX',
      generatedAt: RATED_AT,
      overheadProfitBps: 0,
      contingencyBps: 0,
    });
    const labor = est.lineItems.find((l) => l.id === 'line_0');
    expect(labor?.unitCents).toBe(8500);
    expect(labor?.provenance.source).toBe('override');
    expect(est.rateSources).toContain('override');
  });
});

