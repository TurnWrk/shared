import { describe, expect, it } from 'vitest';
import { computeLateFeeMinor, formatLateFeeDisclosure } from '../../src/money/lateFee';

describe('lateFee', () => {
  it('returns zero when disabled', () => {
    expect(computeLateFeeMinor(10_000, { enabled: false, flatFeeMinor: 500 })).toEqual({
      feeMinor: 0,
    });
  });

  it('computes flat and percent fees', () => {
    expect(computeLateFeeMinor(10_000, { enabled: true, flatFeeMinor: 2500 })).toEqual({
      feeMinor: 2500,
    });
    expect(computeLateFeeMinor(10_000, { enabled: true, percentBps: 500 })).toEqual({
      feeMinor: 500,
    });
  });

  it('formats disclosure from policy or defaults', () => {
    expect(formatLateFeeDisclosure({ enabled: true, flatFeeMinor: 2500 })).toContain('$25.00');
    expect(formatLateFeeDisclosure({ enabled: true, disclosureText: 'Custom terms.' })).toBe(
      'Custom terms.',
    );
  });
});
