import { describe, expect, it } from 'vitest';
import { stripUndefined } from '../src/stripUndefined';

describe('stripUndefined', () => {
  it('removes undefined at every depth, including array elements', () => {
    const out = stripUndefined({ a: undefined, b: { c: undefined, d: 1 }, e: [undefined, { f: undefined, g: 2 }] });
    expect(out).toEqual({ b: { d: 1 }, e: [{ g: 2 }] });
    expect(Object.keys(out)).toEqual(['b', 'e']);
    expect('f' in (out.e as object[])[0]).toBe(false);
  });

  it('drops a nested object left empty, keeps empty arrays and falsy scalars', () => {
    expect(stripUndefined({ a: { b: undefined }, c: [], d: '', e: 0, f: null })).toEqual({ c: [], d: '', e: 0, f: null });
  });

  it('passes Dates and class instances through untouched', () => {
    const when = new Date(0);
    class Stamp { constructor(public ms: number) {} }
    const stamp = new Stamp(5);
    const out = stripUndefined({ when, stamp });
    expect(out.when).toBe(when);
    expect(out.stamp).toBe(stamp);
  });
});
