import type { OrgBranding } from '../types';

/**
 * Suite-wide per-org accent engine (Turnwrk Suite Design System).
 *
 * Promoted verbatim from clean/src/lib/theme.ts so hostfix, restock, and clean
 * share ONE whitelabel engine instead of one app carrying it (TURNWRK-143 lineage).
 * Maps an org's OrgBranding.accentColor onto the `--color-primary*` accent slot,
 * derives hover/light via color-mix, and enforces a WCAG contrast floor with a
 * fallback to hub terracotta. Consumers inject the result as an inline `style`
 * on a subtree root (see clean AppShell) — pure TS, React-free, so each app's
 * own renderer applies it. Only the accent slot is touched; the cool workspace
 * neutrals are never overridden.
 */

/** Hub terracotta — Turnwrk default when org has no accentColor (TURNWRK-143). */
const DEFAULT_PRIMARY = '#DD562D';
const DEFAULT_PRIMARY_HOVER = '#BC4926';
const DEFAULT_PRIMARY_LIGHT = '#F8E4DC';
const DEFAULT_PRIMARY_FG = '#FFFFFF';
const MIN_CONTRAST_RATIO = 3;

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(fg: string, bg: string): number {
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  if (!f || !b) return 0;
  const l1 = relativeLuminance(f.r, f.g, f.b);
  const l2 = relativeLuminance(b.r, b.g, b.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface BrandThemeVars {
  '--color-primary': string;
  '--color-primary-hover': string;
  '--color-primary-light': string;
  '--color-primary-fg': string;
  contrastWarning?: boolean;
}

/**
 * True when the org has customized booking look (accent and/or logo).
 * Hub cream/Fraunces/clay composition must NOT run in that case (TURNWRK-143).
 */
export function hasCustomBookingBranding(branding?: OrgBranding): boolean {
  return !!(
    branding?.accentColor?.trim() ||
    branding?.logoUrl?.trim() ||
    branding?.logoPath?.trim()
  );
}

/** Map org branding to Tailwind v4 @theme CSS variable overrides. */
export function brandVarsForOrg(branding?: OrgBranding): BrandThemeVars {
  const primary = branding?.accentColor?.trim() || DEFAULT_PRIMARY;
  const fg = DEFAULT_PRIMARY_FG;
  const onWhite = contrastRatio(primary, '#FFFFFF');
  const onPrimary = contrastRatio(fg, primary);

  if (onWhite < MIN_CONTRAST_RATIO || onPrimary < MIN_CONTRAST_RATIO) {
    return {
      '--color-primary': DEFAULT_PRIMARY,
      '--color-primary-hover': DEFAULT_PRIMARY_HOVER,
      '--color-primary-light': DEFAULT_PRIMARY_LIGHT,
      '--color-primary-fg': DEFAULT_PRIMARY_FG,
      contrastWarning: true,
    };
  }

  return {
    '--color-primary': primary,
    '--color-primary-hover': `color-mix(in srgb, ${primary} 85%, black)`,
    '--color-primary-light': `color-mix(in srgb, ${primary} 15%, white)`,
    '--color-primary-fg': fg,
  };
}

export function brandStyleObject(branding?: OrgBranding): Record<string, string> {
  const vars = brandVarsForOrg(branding);
  const { contrastWarning: _, ...cssVars } = vars;
  return cssVars;
}
