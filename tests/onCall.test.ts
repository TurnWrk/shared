/** TURNWRK-738 — on-call resolution from the weekly rotation. */
import { describe, expect, it } from 'vitest';
import { resolveOnCallTechId } from '../src/onCall';

const rotation = [
  { weekStart: '2026-07-06', techId: 'tech-a' },
  { weekStart: '2026-07-13', techId: 'tech-b' },
  { weekStart: '2026-07-20' },
];
const at = (ymd: string) => new Date(`${ymd}T12:00:00`).getTime();

describe('resolveOnCallTechId', () => {
  it('picks the entry whose week contains now', () => {
    expect(resolveOnCallTechId({ onCallRotation: rotation }, at('2026-07-08'))).toBe('tech-a');
    expect(resolveOnCallTechId({ onCallRotation: rotation }, at('2026-07-19'))).toBe('tech-b');
  });

  it('falls back to the last entry when no week matches, as dispatch does', () => {
    expect(resolveOnCallTechId({ onCallRotation: rotation }, at('2026-08-30'))).toBeUndefined();
    const filled = [...rotation.slice(0, 2)];
    expect(resolveOnCallTechId({ onCallRotation: filled }, at('2026-08-30'))).toBe('tech-b');
  });

  it('no rotation, no on-call', () => {
    expect(resolveOnCallTechId({}, at('2026-07-08'))).toBeUndefined();
    expect(resolveOnCallTechId(null)).toBeUndefined();
  });
});
