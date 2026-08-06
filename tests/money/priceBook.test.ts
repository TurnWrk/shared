import { describe, expect, it } from 'vitest';
import {
  defaultPriceBookUnit,
  normalizePriceBookItemInput,
  slugifyPriceBookLineType,
} from '../../src/money/priceBook';

describe('priceBook', () => {
  it('slugifies line types from kind + label', () => {
    expect(slugifyPriceBookLineType('labor', 'General Plumbing')).toBe('labor:general-plumbing');
    expect(slugifyPriceBookLineType('material', '  ')).toBe('material:item');
  });

  it('defaults labor to hour and material to each', () => {
    expect(defaultPriceBookUnit('labor')).toBe('hour');
    expect(defaultPriceBookUnit('material')).toBe('each');
  });

  it('normalizes valid rows and drops bad cents', () => {
    const row = normalizePriceBookItemInput(
      'org-1',
      { kind: 'labor', label: 'Electrician', unitMinor: 9500 },
      1_700_000_000_000,
    );
    expect(row).toMatchObject({
      orgId: 'org-1',
      kind: 'labor',
      label: 'Electrician',
      unitMinor: 9500,
      lineType: 'labor:electrician',
      unit: 'hour',
    });
    expect(normalizePriceBookItemInput('org-1', { kind: 'labor', label: '', unitMinor: 1 }, 1)).toBeNull();
    expect(
      normalizePriceBookItemInput('org-1', { kind: 'material', label: 'Pipe', unitMinor: -1 }, 1),
    ).toBeNull();
  });
});
