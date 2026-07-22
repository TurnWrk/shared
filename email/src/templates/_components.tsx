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

export const brand = {
  bg: '#f6f7f9',
  card: '#ffffff',
  text: '#111827',
  muted: '#6b7280',
  accent: '#0f172a',
  border: '#e5e7eb',
};

export const fontStack =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export function Shell({
  preview,
  children,
}: {
  preview: string;
  children: React.ReactNode;
}) {
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
        <Container
          style={{
            backgroundColor: brand.card,
            border: `1px solid ${brand.border}`,
            borderRadius: 8,
            margin: '0 auto',
            maxWidth: 560,
            padding: '32px 32px 24px',
          }}
        >
          <Section>
            <Text
              style={{
                color: brand.accent,
                fontSize: 18,
                fontWeight: 600,
                margin: 0,
              }}
            >
              turnwrk
            </Text>
          </Section>
          <Hr style={{ borderColor: brand.border, margin: '20px 0' }} />
          {children}
          <Hr style={{ borderColor: brand.border, margin: '28px 0 16px' }} />
          <Text style={{ color: brand.muted, fontSize: 12, margin: 0 }}>
            Sent by turnwrk &middot; If you weren&apos;t expecting this email, you can ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const styles = {
  h1: {
    color: brand.text,
    fontSize: 22,
    fontWeight: 600,
    lineHeight: '28px',
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
  button: {
    backgroundColor: brand.accent,
    borderRadius: 6,
    color: '#ffffff',
    display: 'inline-block',
    fontSize: 14,
    fontWeight: 600,
    padding: '10px 18px',
    textDecoration: 'none',
  },
  code: {
    backgroundColor: brand.bg,
    border: `1px solid ${brand.border}`,
    borderRadius: 6,
    color: brand.text,
    display: 'inline-block',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 18,
    fontWeight: 600,
    letterSpacing: 2,
    padding: '8px 14px',
  },
} as const;
