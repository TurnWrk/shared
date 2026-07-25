import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { emailColors, emailFonts, resolveEmailAccent } from '../theme.js';

/**
 * Turnwrk Suite Design System — email shell (warm editorial).
 * Cream page, white card, Georgia-serif masthead + headings, terracotta accents,
 * and the clay editorial band as the footer (the one warm brand "moment").
 * Restyling this file cascades to every template via <Shell> + `styles`.
 * The exported API (`brand`, `fontStack`, `Shell`, `styles`) is kept
 * backward-compatible so existing templates need no changes.
 */

/** Brand-mapped token aliases (keys kept stable for existing templates). */
export const brand = {
  bg: emailColors.page, // cream (was slate #f6f7f9)
  card: emailColors.card,
  text: emailColors.text,
  muted: emailColors.muted,
  accent: emailColors.terracotta, // terracotta (was slate #0f172a)
  border: emailColors.rule, // warm hairline (was #e5e7eb)
  // Added tokens (warm editorial):
  cream: emailColors.page,
  clay: emailColors.clay,
  clayText: emailColors.clayText,
  clayMuted: emailColors.clayMuted,
  terracotta: emailColors.terracotta,
} as const;

export const fontStack = emailFonts.body;
/** Georgia serif — stands in for the Fraunces display face. */
export const serifStack = emailFonts.display;

export function Shell({
  preview,
  children,
  eyebrow,
  accentColor,
  orgName,
}: {
  preview: string;
  children: React.ReactNode;
  /** Optional per-email kicker above the wordmark, e.g. "Invitation". */
  eyebrow?: string;
  /** Org brand accent (customer-facing whitelabel); falls back to terracotta. */
  accentColor?: string;
  /** When set, footer reads "Sent on behalf of {orgName}". */
  orgName?: string;
}) {
  const accent = resolveEmailAccent(accentColor).accent;
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: brand.bg,
          fontFamily: fontStack,
          margin: 0,
          padding: '24px 0',
        }}
      >
        <Container style={{ margin: '0 auto', maxWidth: 560, width: '100%' }}>
          {/* White card */}
          <Section
            style={{
              backgroundColor: brand.card,
              border: `1px solid ${brand.border}`,
              borderBottom: 'none',
              borderRadius: '12px 12px 0 0',
              padding: '32px 32px 24px',
            }}
          >
            {/* Masthead — eyebrow (optional) + serif wordmark */}
            {eyebrow ? (
              <Text
                style={{
                  color: accent,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 2,
                  margin: '0 0 6px',
                  textTransform: 'uppercase',
                }}
              >
                {eyebrow}
              </Text>
            ) : null}
            <Text
              style={{
                color: brand.clay,
                fontFamily: serifStack,
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                margin: 0,
              }}
            >
              Turnwrk
            </Text>
            <Hr style={{ borderColor: brand.border, margin: '20px 0' }} />
            {children}
          </Section>
          {/* Clay editorial footer band — the warm brand moment */}
          <Section
            style={{
              backgroundColor: brand.clay,
              borderRadius: '0 0 12px 12px',
              padding: '20px 32px',
            }}
          >
            <Text style={{ color: brand.clayText, fontSize: 12, lineHeight: '18px', margin: 0 }}>
              {orgName
                ? `Sent on behalf of ${orgName}.`
                : "Sent by Turnwrk · If you weren't expecting this email, you can ignore it."}
            </Text>
            {orgName ? (
              <Text style={{ color: brand.clayMuted, fontSize: 11, margin: '4px 0 0' }}>
                Powered by Turnwrk
              </Text>
            ) : null}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Terracotta CTA by default; call `button(orgAccent)` for whitelabel accent. */
export function button(accentColor?: string): React.CSSProperties {
  const { accent, onAccent } = resolveEmailAccent(accentColor);
  return {
    backgroundColor: accent,
    borderRadius: 6,
    color: onAccent,
    display: 'inline-block',
    fontSize: 14,
    fontWeight: 600,
    padding: '11px 20px',
    textDecoration: 'none',
  };
}

export const styles = {
  h1: {
    color: brand.text,
    fontFamily: serifStack, // serif display heading (Fraunces evocation)
    fontSize: 23,
    fontWeight: 600,
    lineHeight: '30px',
    margin: '0 0 12px',
  },
  p: {
    color: brand.text,
    fontSize: 15,
    lineHeight: '22px',
    margin: '0 0 12px',
  },
  muted: {
    color: brand.muted,
    fontSize: 13,
    lineHeight: '20px',
    margin: '0 0 12px',
  },
  buttonWrap: {
    margin: '20px 0',
  },
  button: button(), // terracotta default (backward-compatible)
  code: {
    backgroundColor: brand.cream,
    border: `1px solid ${brand.border}`,
    borderRadius: 6,
    color: brand.text,
    display: 'inline-block',
    fontFamily: emailFonts.mono,
    fontSize: 18,
    fontWeight: 600,
    letterSpacing: 2,
    padding: '8px 14px',
  },
} as const;
