import { Img, Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { EstimateData } from '../types';
import { brand, Shell, styles } from './_components';

export function subject(data: EstimateData): string {
  const isProposal = data.kind === 'proposal';
  const label = isProposal ? 'Proposal' : 'Estimate';
  const prefix = data.isUpdate ? `Updated ${label.toLowerCase()}` : label;
  return `${prefix} for ${data.propertyAddress} — ${data.amount}`;
}

export default function Estimate({
  orgName,
  ownerName,
  propertyAddress,
  woTitle,
  amount,
  scopeNote,
  viewUrl,
  sharedNotes,
  sharedImageUrls,
  kind,
  title,
  isUpdate,
}: EstimateData) {
  const isProposal = kind === 'proposal';
  const noun = isProposal ? 'proposal' : 'estimate';
  const heading = isProposal
    ? (title || `Proposal for ${propertyAddress}`)
    : `Estimate for ${propertyAddress}`;

  return (
    <Shell
      preview={
        isUpdate
          ? `${orgName} updated their ${noun} — ${amount}`
          : `${orgName} sent you a ${noun} — ${amount}`
      }
    >
      <Text style={styles.h1}>{heading}</Text>
      <Text style={styles.p}>
        Hi {ownerName},{' '}
        {isUpdate
          ? `${orgName} has updated the ${noun} for the following work at ${propertyAddress}. The link below is the same as before.`
          : `${orgName} has prepared a ${noun} for the following work at ${propertyAddress}.`}
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
        <Text style={{ ...styles.muted, margin: '0 0 4px' }}>{woTitle}</Text>
        <Text
          style={{
            color: brand.text,
            fontSize: 28,
            fontWeight: 700,
            lineHeight: '32px',
            margin: '0 0 10px',
          }}
        >
          {amount}
        </Text>
        <Text style={{ ...styles.p, margin: 0 }}>{scopeNote}</Text>
      </Section>

      {sharedNotes && sharedNotes.length > 0 && (
        <Section style={{ margin: '0 0 8px' }}>
          <Text style={{ ...styles.muted, margin: '0 0 4px' }}>Notes</Text>
          {sharedNotes.map((note, i) => (
            <Text key={i} style={{ ...styles.p, margin: '0 0 8px' }}>
              {note}
            </Text>
          ))}
        </Section>
      )}

      {sharedImageUrls && sharedImageUrls.length > 0 && (
        <Section style={{ margin: '0 0 8px' }}>
          <Text style={{ ...styles.muted, margin: '0 0 6px' }}>
            {isProposal ? 'Concept photos' : 'Photos'}
          </Text>
          {sharedImageUrls.slice(0, 3).map((url, i) => (
            <Img
              key={i}
              src={url}
              alt={`Photo ${i + 1}`}
              width="120"
              height="120"
              style={{
                borderRadius: 8,
                border: `1px solid ${brand.border}`,
                display: 'inline-block',
                marginRight: 8,
                objectFit: 'cover',
              }}
            />
          ))}
        </Section>
      )}

      <Section style={styles.buttonWrap}>
        <Link href={viewUrl} style={styles.button}>
          {isProposal ? 'Review proposal' : 'Review estimate'}
        </Link>
      </Section>
      <Text style={styles.muted}>
        Open the {noun} to approve or decline. If the button doesn&apos;t
        work, paste this link into your browser:
      </Text>
      <Text style={{ ...styles.muted, wordBreak: 'break-all', margin: 0 }}>
        {viewUrl}
      </Text>
    </Shell>
  );
}
