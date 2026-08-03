/**
 * Pool-specific notification copy (Verticals C6 — TURNWRK-325).
 *
 * Trade-appropriate wording for events where neutral defaults would read
 * wrong for a pool-service org.
 */
import type { CanonicalCleanNotificationEventKey } from '../../notifications/types';
import type { CleanTemplateDefault } from '../../notifications/defaults';

export const POOL_NOTIFICATION_COPY: Partial<
  Record<CanonicalCleanNotificationEventKey, CleanTemplateDefault>
> = {
  worker_en_route: {
    audience: 'customer',
    channels: {
      sms: {
        body: '{{worker.first_name}} from {{org.name}} is on the way for your {{booking.service}} (arrival window {{booking.window}}).',
      },
      email: {
        subject: '{{org.name}}: your technician is on the way',
        heading: 'On the way!',
        body: '{{worker.first_name}} is en route for your {{booking.service}} — arrival window {{booking.window}}.',
      },
    },
  },
  review_request: {
    audience: 'customer',
    ctaUrlVar: 'review.url',
    channels: {
      email: {
        subject: 'How was your {{org.name}} pool service?',
        heading: 'We hope you loved your visit!',
        body: 'Hi {{customer.first_name}}, thanks for choosing {{org.name}}. How did we do? Tap below to rate your recent {{booking.service}} — it only takes a moment.',
        ctaLabel: 'Rate your service',
        footnote: 'Your feedback helps us improve and lets others know what to expect.',
      },
    },
  },
};
