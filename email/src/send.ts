import { render } from '@react-email/render';
import {
  getDefaultFrom,
  getDefaultReplyTo,
  getResend,
} from './client.js';
import { templates } from './templates/index.js';
import type {
  SendEmailParams,
  SendEmailResult,
  TemplateName,
} from './types.js';

export async function sendEmail<T extends TemplateName>(
  params: SendEmailParams<T>,
): Promise<SendEmailResult> {
  const tmpl = templates[params.template];
  const element = tmpl.default(params.data);
  const subject = tmpl.subject(params.data);

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  const resend = getResend();
  const from = params.from ?? getDefaultFrom();
  const replyTo = params.replyTo ?? getDefaultReplyTo();

  if (!resend) {
    const recipients = Array.isArray(params.to) ? params.to.join(', ') : params.to;
    console.log(
      `[email] (no RESEND_API_KEY) would send "${subject}" to ${recipients}`,
    );
    return { id: `simulated-${Date.now()}`, simulated: true };
  }

  const { data, error } = await resend.emails.send(
    {
      from,
      to: params.to,
      subject,
      html,
      text,
      ...(replyTo ? { replyTo } : {}),
    },
    params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined,
  );

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error('Resend send returned no message id');
  }
  return { id: data.id };
}
