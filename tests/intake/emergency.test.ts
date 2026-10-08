/**
 * TURNWRK-738 — deterministic emergency detector.
 *
 * The golden set (fixtures/emergency-golden.json) is the eval: the report it
 * prints is the number a pattern change must not regress. The threshold below
 * is the one recorded in the PR.
 */
import { describe, expect, it } from 'vitest';
import golden from './fixtures/emergency-golden.json';
import {
  EMERGENCY_CLASSES,
  detectEmergency,
  hvacEmergencySeason,
  stateFromAddress,
  type EmergencyDetection,
} from '../../src/intake';
import type { IntakeEmergencyClass } from '../../src/types/woIntake';

/** Recorded in the PR. Binary emergency vs not, deterministic layer only. */
const MIN_RECALL = 0.95;
const MIN_PRECISION = 0.85;

interface GoldenCase {
  text: string;
  expected: IntakeEmergencyClass | null;
  month?: number;
  state?: string;
}

const CASES = (golden as { cases: GoldenCase[] }).cases;

function run(c: GoldenCase): EmergencyDetection {
  return detectEmergency(c.text, { month: c.month ?? 7, state: c.state ?? 'FL' });
}

const predicted = (d: EmergencyDetection): IntakeEmergencyClass | null => (d.isEmergency ? d.class ?? null : null);

function ratio(n: number, d: number): number {
  return d === 0 ? 1 : n / d;
}

describe('emergency golden set', () => {
  const results = CASES.map((c) => ({ c, d: run(c) }));

  it('has at least 40 labelled messages covering every class and hard negatives', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(40);
    for (const cls of EMERGENCY_CLASSES) {
      expect(CASES.filter((c) => c.expected === cls).length, cls).toBeGreaterThanOrEqual(4);
    }
    expect(CASES.filter((c) => c.expected === null).length).toBeGreaterThanOrEqual(20);
  });

  it('prints precision/recall per class and meets the recorded threshold', () => {
    const lines: string[] = ['class     n   tp  fp  fn  precision  recall'];
    for (const cls of EMERGENCY_CLASSES) {
      const tp = results.filter((r) => r.c.expected === cls && predicted(r.d) === cls).length;
      const fp = results.filter((r) => r.c.expected !== cls && predicted(r.d) === cls).length;
      const fn = results.filter((r) => r.c.expected === cls && predicted(r.d) !== cls).length;
      const n = results.filter((r) => r.c.expected === cls).length;
      lines.push(
        `${cls.padEnd(9)} ${String(n).padStart(2)}  ${String(tp).padStart(2)}  ${String(fp).padStart(2)}  ${String(fn).padStart(2)}  ` +
          `${ratio(tp, tp + fp).toFixed(2).padStart(9)}  ${ratio(tp, tp + fn).toFixed(2).padStart(6)}`,
      );
    }
    const tp = results.filter((r) => r.c.expected !== null && r.d.isEmergency).length;
    const fp = results.filter((r) => r.c.expected === null && r.d.isEmergency).length;
    const fn = results.filter((r) => r.c.expected !== null && !r.d.isEmergency).length;
    const precision = ratio(tp, tp + fp);
    const recall = ratio(tp, tp + fn);
    const ambiguous = results.filter((r) => r.d.ambiguous);
    // Emergencies that reach a decision-maker: paged outright, or sent to the
    // model as ambiguous. The deterministic recall above is the floor.
    const reached = results.filter((r) => r.c.expected !== null && (r.d.isEmergency || r.d.ambiguous)).length;
    lines.push(
      `ALL       ${results.length}  tp=${tp} fp=${fp} fn=${fn}  precision=${precision.toFixed(2)} recall=${recall.toFixed(2)}` +
        `  (threshold: precision>=${MIN_PRECISION} recall>=${MIN_RECALL})`,
      `ambiguous -> LLM: ${ambiguous.length} (${ambiguous.filter((r) => r.c.expected === null).length} non-emergencies); ` +
        `emergencies paged or sent to LLM: ${reached}/${tp + fn}`,
    );
    const misses = results.filter((r) => predicted(r.d) !== r.c.expected);
    for (const m of misses) lines.push(`  MISS expected=${m.c.expected} got=${predicted(m.d)} :: ${m.c.text}`);
    console.log(`\n[emergency golden set]\n${lines.join('\n')}\n`);

    expect(recall).toBeGreaterThanOrEqual(MIN_RECALL);
    expect(precision).toBeGreaterThanOrEqual(MIN_PRECISION);
  });
});

describe('detectEmergency', () => {
  it('water pouring from ceiling is a confident, unambiguous water emergency', () => {
    const d = detectEmergency('water pouring from ceiling', { month: 3, state: 'FL' });
    expect(d).toMatchObject({ isEmergency: true, class: 'water', ambiguous: false });
    expect(d.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('a bare leak is ambiguous, not a page', () => {
    const d = detectEmergency('there is a leak in the bathroom');
    expect(d).toMatchObject({ isEmergency: false, class: 'water', ambiguous: true });
  });

  it('a joke cue makes a strong hit ambiguous rather than a page', () => {
    const d = detectEmergency('my inbox is flooding lol');
    expect(d.isEmergency).toBe(false);
    expect(d.ambiguous).toBe(true);
  });

  it('a resolved issue that recurs is an emergency again', () => {
    const d = detectEmergency('The leak was fixed last week but water is pouring from the ceiling again');
    expect(d).toMatchObject({ isEmergency: true, class: 'water' });
  });

  it('gas outranks everything else in a mixed report', () => {
    expect(detectEmergency('power is out and I smell gas').class).toBe('gas');
  });

  it('empty text is not an emergency', () => {
    expect(detectEmergency('   ')).toEqual({ isEmergency: false, confidence: 0, ambiguous: false });
  });

  it('reads the month in the org timezone when no month is passed', () => {
    // 2026-05-01T03:00Z is still April 30 in Florida: A/C is out of season.
    const now = Date.UTC(2026, 4, 1, 3);
    expect(detectEmergency('AC not working', { now, timeZone: 'America/New_York', state: 'FL' }).isEmergency).toBe(false);
    expect(detectEmergency('AC not working', { now, timeZone: 'UTC', state: 'FL' }).isEmergency).toBe(true);
  });
});

describe('seasonal HVAC', () => {
  const ac = 'the AC is not working';
  const heat = 'no heat in the house';

  it.each([5, 6, 7, 8, 9, 10])('Florida A/C failure in month %i is an emergency', (month) => {
    expect(detectEmergency(ac, { month, state: 'FL' })).toMatchObject({ isEmergency: true, class: 'hvac' });
  });

  it.each([1, 2, 3, 4, 11, 12])('Florida A/C failure in month %i is not', (month) => {
    expect(detectEmergency(ac, { month, state: 'FL' }).isEmergency).toBe(false);
  });

  it.each([12, 1, 2])('Florida no-heat in month %i is an emergency', (month) => {
    expect(detectEmergency(heat, { month, state: 'FL' })).toMatchObject({ isEmergency: true, class: 'hvac' });
  });

  it.each([3, 6, 9, 11])('Florida no-heat in month %i is not', (month) => {
    expect(detectEmergency(heat, { month, state: 'FL' }).isEmergency).toBe(false);
  });

  it('a temperate state runs a longer heating season and a shorter cooling one', () => {
    expect(hvacEmergencySeason(11, { state: 'CO' })).toEqual({ cooling: false, heating: true });
    expect(hvacEmergencySeason(5, { state: 'CO' })).toEqual({ cooling: false, heating: false });
    expect(hvacEmergencySeason(7, { state: 'CO' })).toEqual({ cooling: true, heating: false });
  });

  it('the southern hemisphere is shifted six months', () => {
    expect(hvacEmergencySeason(1, { hemisphere: 'south' })).toEqual({ cooling: true, heating: false });
    expect(hvacEmergencySeason(7, { hemisphere: 'south' })).toEqual({ cooling: false, heating: true });
  });
});

describe('stateFromAddress', () => {
  it.each([
    ['123 Main St, Tampa, FL 33602', 'FL'],
    ['55 Pine Rd, Denver, Colorado 80202', 'CO'],
    ['9 Ocean Dr, Miami Beach, fl', 'FL'],
    ['somewhere with no state', undefined],
    [undefined, undefined],
  ])('%s -> %s', (address, state) => {
    expect(stateFromAddress(address)).toBe(state);
  });
});
