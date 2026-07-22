import { Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { MagicLinkData } from '../types.js';
import { Shell, styles } from './_components.js';

export function subject(data: MagicLinkData): string {
  const product = data.appName ?? 'turnwrk';
  return `Sign in to ${product}`;
}

export default function MagicLink({
  recipientName,
  signInUrl,
  appName,
  expiresInMinutes,
}: MagicLinkData) {
  const product = appName ?? 'turnwrk';

  return (
    <Shell preview={`Sign in to ${product}`}>
      <Text style={styles.h1}>Sign in to {product}</Text>
      <Text style={styles.p}>
        {recipientName ? `Hi ${recipientName},` : 'Hi,'} we received a request
        to sign in to your {product} account using this email address. Click the
        button below to continue.
      </Text>
      <Section style={styles.buttonWrap}>
        <Link href={signInUrl} style={styles.button}>
          Sign in
        </Link>
      </Section>
      <Text style={styles.muted}>
        This link expires in {expiresInMinutes} minutes. If you didn&apos;t
        request it, you can safely ignore this email.
      </Text>
    </Shell>
  );
}
