/**
 * Pool-pack notification copy (Verticals C6 — TURNWRK-325).
 */
import { describe, it, expect } from 'vitest';
import {
  SAMPLE_TEMPLATE_VARS,
  resolveNotificationDefaults,
} from '../../src/notifications/defaults';
import { renderTemplate } from '../../src/notifications/render';
import { POOL_PACK } from '../../src/verticals';

describe('pool pack notification copy', () => {
  const resolved = resolveNotificationDefaults(POOL_PACK.notificationCopy);

  it('renders tech wording for en-route events', () => {
    const email = resolved.worker_en_route.channels.email!;
    const subject = renderTemplate(email.subject!, SAMPLE_TEMPLATE_VARS);
    const body = renderTemplate(email.body, SAMPLE_TEMPLATE_VARS);
    expect(subject.ok === true && subject.text).toBe('Your Company: your tech is on the way');
    expect(body.ok === true && body.text).toContain('Maria is en route');
    expect(body.ok === true && body.text).not.toContain('cleaner');
  });

  it('renders pool-specific review copy', () => {
    const email = resolved.review_request.channels.email!;
    const heading = renderTemplate(email.heading!, SAMPLE_TEMPLATE_VARS);
    const subject = renderTemplate(email.subject!, SAMPLE_TEMPLATE_VARS);
    const body = renderTemplate(email.body, SAMPLE_TEMPLATE_VARS);
    expect(heading.ok === true && heading.text).toBe('We hope you loved your visit!');
    expect(subject.ok === true && subject.text).toBe('How was your Your Company pool service?');
    expect(body.ok === true && body.text).toContain('Deep Clean');
  });
});
