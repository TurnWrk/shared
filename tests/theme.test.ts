import { describe, it, expect } from 'vitest';
import { brandVarsForOrg, brandStyleObject, hasCustomBookingBranding } from '../src/theme';

describe('brandVarsForOrg', () => {
  it('uses hub terracotta when no accent is set', () => {
    const vars = brandVarsForOrg(undefined);
    expect(vars['--color-primary']).toBe('#DD562D');
    expect(vars.contrastWarning).toBeUndefined();
  });

  it('uses default palette when contrast fails', () => {
    const vars = brandVarsForOrg({ accentColor: '#FFFF00' });
    expect(vars.contrastWarning).toBe(true);
    expect(vars['--color-primary']).toBe('#DD562D');
  });

  it('applies org accent when contrast passes', () => {
    const vars = brandVarsForOrg({ accentColor: '#1E3A5F' });
    expect(vars.contrastWarning).toBeUndefined();
    expect(vars['--color-primary']).toBe('#1E3A5F');
    expect(vars['--color-primary-hover']).toBe('color-mix(in srgb, #1E3A5F 85%, black)');
    expect(vars['--color-primary-light']).toBe('color-mix(in srgb, #1E3A5F 15%, white)');
  });
});

describe('brandStyleObject', () => {
  it('strips the contrastWarning flag, keeping only CSS vars', () => {
    const style = brandStyleObject({ accentColor: '#FFFF00' });
    expect(style).not.toHaveProperty('contrastWarning');
    expect(style['--color-primary']).toBe('#DD562D');
  });
});

describe('hasCustomBookingBranding', () => {
  it('is false for empty branding', () => {
    expect(hasCustomBookingBranding(undefined)).toBe(false);
    expect(hasCustomBookingBranding({})).toBe(false);
  });

  it('is true for accent or logo', () => {
    expect(hasCustomBookingBranding({ accentColor: '#1E3A5F' })).toBe(true);
    expect(hasCustomBookingBranding({ logoUrl: 'https://example.com/logo.png' })).toBe(true);
    expect(hasCustomBookingBranding({ logoPath: 'orgs/x/logo.png' })).toBe(true);
  });
});
