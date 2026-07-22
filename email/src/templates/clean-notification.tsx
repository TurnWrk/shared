import { Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { CleanNotificationData } from '../types.js';
import { Shell, styles, brand } from './_components.js';

export function subject(data: CleanNotificationData): string {
  return data.subject;
}

export default function CleanNotification({
  orgName,
  heading,
  intro,
  details,
  ctaUrl,
  ctaLabel,
  footnote,
}: CleanNotificationData) {
  return (
    <Shell preview={heading}>
      <Text style={styles.h1}>{heading}</Text>
      <Text style={styles.p}>{intro}</Text>
      {details && details.length > 0 ? (
        <Section style={{ margin: '8px 0 16px' }}>
          {details.map((d) => (
            <Text key={d.label} style={{ ...styles.p, margin: '0 0 4px' }}>
              <span style={{ color: brand.muted }}>{d.label}: </span>
              {d.value}
            </Text>
          ))}
        </Section>
      ) : null}
      {ctaUrl && ctaLabel ? (
        <Section style={styles.buttonWrap}>
          <Link href={ctaUrl} style={styles.button}>
            {ctaLabel}
          </Link>
        </Section>
      ) : null}
      {footnote ? <Text style={styles.muted}>{footnote}</Text> : null}
      <Text style={{ ...styles.muted, marginTop: 8 }}>Sent on behalf of {orgName}.</Text>
    </Shell>
  );
}
