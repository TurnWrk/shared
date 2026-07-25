import { Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { InvoiceData } from '../types';
import { brand, Shell, styles } from './_components';

export function subject(data: InvoiceData): string {
  return `Invoice for ${data.propertyAddress} — ${data.amount}`;
}

export default function Invoice({
  orgName,
  ownerName,
  propertyAddress,
  amount,
  lineItems,
  viewUrl,
}: InvoiceData) {
  return (
    <Shell preview={`${orgName} sent you an invoice — ${amount}`}>
      <Text style={styles.h1}>Invoice for {propertyAddress}</Text>
      <Text style={styles.p}>
        Hi {ownerName}, {orgName} has prepared an invoice for completed work at{' '}
        {propertyAddress}.
      </Text>

      <Section
        style={{
          backgroundColor: brand.bg,
          border: `1px solid ${brand.border}`,
          borderRadius: 8,
          margin: '16px 0',
          padding: '16px 18px',
        }}
      >
        <Text style={{ ...styles.muted, margin: '0 0 4px' }}>Total due</Text>
        <Text
          style={{
            color: brand.text,
            fontSize: 28,
            fontWeight: 700,
            lineHeight: '32px',
            margin: '0 0 12px',
          }}
        >
          {amount}
        </Text>
        {lineItems.slice(0, 12).map((item, i) => (
          <Text
            key={i}
            style={{
              ...styles.p,
              margin: '0 0 6px',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            {item.title}
            {' — '}
            {item.amount}
          </Text>
        ))}
        {lineItems.length > 12 && (
          <Text style={{ ...styles.muted, margin: '8px 0 0' }}>
            +{lineItems.length - 12} more on the invoice page
          </Text>
        )}
      </Section>

      <Section style={styles.buttonWrap}>
        <Link href={viewUrl} style={styles.button}>
          View invoice
        </Link>
      </Section>
      <Text style={styles.muted}>
        Open the invoice for the full line-item list. Pay offline or reply to
        this email to arrange payment. If the button doesn&apos;t work, paste
        this link into your browser:
      </Text>
      <Text style={{ ...styles.muted, wordBreak: 'break-all', margin: 0 }}>
        {viewUrl}
      </Text>
    </Shell>
  );
}
