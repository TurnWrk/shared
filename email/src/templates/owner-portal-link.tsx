import { Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { OwnerPortalLinkData } from '../types.js';
import { Shell, styles } from './_components.js';

export function subject(data: OwnerPortalLinkData): string {
  return `Your ${data.orgName} property report`;
}

export default function OwnerPortalLink({
  orgName,
  ownerName,
  portalUrl,
  expiresInMinutes,
}: OwnerPortalLinkData) {
  return (
    <Shell preview={`Open your ${orgName} property report`}>
      <Text style={styles.h1}>Your property report</Text>
      <Text style={styles.p}>
        {ownerName ? `Hi ${ownerName},` : 'Hi,'} {orgName} keeps a live report of
        the work happening at your properties. The link below opens it — there
        is no account to create and no password to remember.
      </Text>

      <Section style={styles.buttonWrap}>
        <Link href={portalUrl} style={styles.button}>
          Open my report
        </Link>
      </Section>

      <Text style={styles.muted}>
        This link expires in {expiresInMinutes} minutes and can only be opened
        once — request a new one any time. If you didn&apos;t ask for it, you can
        safely ignore this email. If the button doesn&apos;t work, paste this
        link into your browser:
      </Text>
      <Text style={{ ...styles.muted, wordBreak: 'break-all', margin: 0 }}>
        {portalUrl}
      </Text>
    </Shell>
  );
}
