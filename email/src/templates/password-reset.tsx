import { Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { PasswordResetData } from '../types.js';
import { Shell, styles } from './_components.js';

export function subject(_data: PasswordResetData): string {
  return 'Reset your turnwrk password';
}

export default function PasswordReset({
  recipientName,
  resetUrl,
  expiresInMinutes,
}: PasswordResetData) {
  return (
    <Shell preview="Reset your turnwrk password">
      <Text style={styles.h1}>Reset your password</Text>
      <Text style={styles.p}>
        {recipientName ? `Hi ${recipientName},` : 'Hi,'} we received a request
        to reset the password on your turnwrk account. Click the button below
        to choose a new one.
      </Text>
      <Section style={styles.buttonWrap}>
        <Link href={resetUrl} style={styles.button}>
          Reset password
        </Link>
      </Section>
      <Text style={styles.muted}>
        This link expires in {expiresInMinutes} minutes. If you didn&apos;t
        request a reset, you can safely ignore this email.
      </Text>
    </Shell>
  );
}
