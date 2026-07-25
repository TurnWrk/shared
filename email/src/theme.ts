/**
 * Email-safe translation of the Turnwrk Suite Design System tokens.
 *
 * Email clients don't support CSS custom properties, @theme, color-mix(), or
 * reliable web fonts — so this is plain inline hex + web-safe font stacks.
 * Emails lean fully into the WARM BRAND side of the system (they're read-once
 * brand touchpoints, not the apps' dense cool-Slate workspace): cream page,
 * terracotta accents, clay editorial footer, a Georgia serif standing in for
 * Fraunces. Canonical source: turnwrk-shared/src/theme/tokens.css.
 */
export const emailColors = {
  page: '#F8F3E9', // cream editorial page
  card: '#FFFFFF',
  text: '#0F172A', // slate — legible body copy
  muted: '#475569', // slate secondary
  faint: '#94A3B8', // captions
  terracotta: '#DD562D', // brand accent (default button/link/eyebrow)
  onTerracotta: '#FFFFFF',
  clay: '#271F1B', // dark editorial footer band
  clayText: '#F2ECE0',
  clayMuted: '#A79E93',
  rule: '#E4DCCC', // warm hairline
} as const;

export const emailFonts = {
  // No web fonts in email — Georgia stands in for the Fraunces editorial serif.
  display: 'Georgia, "Times New Roman", Times, serif',
  body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

/* --- Per-org whitelabel accent (WCAG-guarded, email-safe hex) ---------------
   Self-contained mirror of the accent-slot contrast guard in
   @turnwrk/shared/theme (brandVarsForOrg). @turnwrk/email vendors as its own
   package and needs STATIC hex (no color-mix), so the ~20-line guard is
   duplicated here by design rather than cross-linking the packages. */
const DEFAULT_ACCENT = '#DD562D';
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
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export interface EmailAccent {
  /** Button/link background (org accent, or terracotta fallback). */
  accent: string;
  /** Readable text on the accent. */
  onAccent: string;
  /** True when the org color failed contrast and terracotta was substituted. */
  contrastWarning?: boolean;
}

/**
 * Resolve an org's brand accent to an email-safe hex pair. Falls back to hub
 * terracotta when unset, malformed, or too low-contrast for a white-text button
 * on a cream/white surface — mirrors the app-side WCAG floor (MIN_CONTRAST 3).
 */
export function resolveEmailAccent(accentColor?: string): EmailAccent {
  const c = accentColor?.trim();
  if (!c || !hexToRgb(c)) return { accent: DEFAULT_ACCENT, onAccent: '#FFFFFF' };
  // Symmetric: white-on-accent (button) and accent-on-white (link) share this ratio.
  if (contrastRatio('#FFFFFF', c) < MIN_CONTRAST_RATIO) {
    return { accent: DEFAULT_ACCENT, onAccent: '#FFFFFF', contrastWarning: true };
  }
  return { accent: c, onAccent: '#FFFFFF' };
}
