import { Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { InviteData } from '../types.js';
import { Shell, styles } from './_components.js';

export function subject(data: InviteData): string {
  return `${data.inviterName} invited you to ${data.orgName}`;
}

export default function Invite({
  code,
  orgName,
  inviterName,
  acceptUrl,
}: InviteData) {
  return (
    <Shell preview={`${inviterName} invited you to ${orgName}`}>
      <Text style={styles.h1}>You&apos;re invited to {orgName}</Text>
      <Text style={styles.p}>
        {inviterName} added you to {orgName} on turnwrk. Click below to accept
        the invite and finish setting up your account.
      </Text>
      <Section style={styles.buttonWrap}>
        <Link href={acceptUrl} style={styles.button}>
          Accept invite
        </Link>
      </Section>
      <Text style={styles.muted}>
        Or enter this code manually if the button doesn&apos;t work:
      </Text>
      <Section>
        <span style={styles.code}>{code}</span>
      </Section>
      <Text style={{ ...styles.muted, marginTop: 16 }}>
        This invite is single-use and tied to your email address.
      </Text>
    </Shell>
  );
}
