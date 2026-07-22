import { Resend } from 'resend';

let cached: Resend | null = null;

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cached) cached = new Resend(key);
  return cached;
}

export function getDefaultFrom(): string {
  return process.env.EMAIL_FROM ?? 'noreply@turnwrk.com';
}

export function getDefaultReplyTo(): string | undefined {
  return process.env.EMAIL_REPLY_TO || undefined;
}
