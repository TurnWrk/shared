/**
 * Cleaning-specific notification copy (Verticals C6 — TURNWRK-325).
 *
 * Neutral code defaults live in `notifications/defaults.ts`; this object
 * restores today's cleaning wording via the pack fallback chain so real
 * customers read the same words after neutralisation. Frozen against
 * tests/notifications/cleaningCopyGolden.test.ts — edit only with intent.
 */
import type { CleanNotificationEventKey, CanonicalCleanNotificationEventKey } from '../../notifications/types';
import type { CleanTemplateDefault } from '../../notifications/defaults';

export const CLEANING_NOTIFICATION_COPY: Partial<
  Record<CanonicalCleanNotificationEventKey, CleanTemplateDefault>
> = {
  booking_confirmed: {
    audience: 'customer',
    channels: {
      email: {
        subject: 'Your {{org.name}} booking is confirmed',
        heading: "You're booked!",
        body: 'Thanks {{customer.first_name}}! {{org.name}} has your cleaning scheduled. Here are the details:',
        footnote: '{{payment.policy_summary}}',
      },
    },
  },
  booking_assigned: {
    audience: 'customer',
    channels: {
      email: {
        subject: 'Your {{org.name}} appointment is scheduled',
        heading: 'Your cleaner is assigned',
        body: 'Good news — your {{booking.service}} on {{booking.date}} is assigned and on the schedule.',
      },
    },
  },
  reminder_24h: {
    audience: 'customer',
    channels: {
      email: {
        subject: 'Reminder: your {{org.name}} cleaning is tomorrow',
        heading: 'See you tomorrow!',
        body: 'A friendly reminder — your {{booking.service}} is tomorrow, {{booking.date}}, arriving {{booking.window}}.',
      },
      sms: {
        body: 'Reminder from {{org.name}}: your {{booking.service}} is tomorrow ({{booking.date}}), arrival window {{booking.window}}. Reply STOP to opt out.',
      },
    },
  },
  reminder_2h: {
    audience: 'customer',
    channels: {
      email: {
        subject: 'Your {{org.name}} cleaning is coming up today',
        heading: 'Almost time!',
        body: 'Your {{booking.service}} is today — arrival window {{booking.window}}.',
      },
      sms: {
        body: '{{org.name}}: your {{booking.service}} is today, arrival window {{booking.window}}.',
      },
    },
  },
  review_request: {
    audience: 'customer',
    ctaUrlVar: 'review.url',
    channels: {
      email: {
        subject: 'How was your {{org.name}} service?',
        heading: 'We hope you loved your clean!',
        body: 'Hi {{customer.first_name}}, thanks for choosing {{org.name}}. How did we do? Tap below to rate your recent {{booking.service}} — it only takes a moment.',
        ctaLabel: 'Rate your service',
        footnote: 'Your feedback helps us improve and lets others know what to expect.',
      },
    },
  },
  lead_recovery: {
    audience: 'customer',
    ctaUrlVar: 'lead.resume_url',
    channels: {
      email: {
        subject: 'Your {{org.name}} quote is waiting',
        heading: 'Pick up where you left off',
        body: 'Hi {{customer.first_name}}, your cleaning quote from {{org.name}} is saved and ready. Tap below to finish booking in under a minute.',
        ctaLabel: 'Finish my booking',
      },
    },
  },
  worker_en_route: {
    audience: 'customer',
    channels: {
      sms: {
        body: '{{worker.first_name}} from {{org.name}} is on the way for your {{booking.service}} (arrival window {{booking.window}}).',
      },
      email: {
        subject: '{{org.name}}: your cleaner is on the way',
        heading: 'On the way!',
        body: '{{worker.first_name}} is en route for your {{booking.service}} — arrival window {{booking.window}}.',
      },
    },
  },
  bounty_submitted: {
    audience: 'operator',
    ctaUrlVar: 'bounty.review_url',
    channels: {
      email: {
        subject: 'Bounty photo awaiting review',
        heading: 'A bounty photo needs your review',
        body: '{{worker.first_name}} submitted a bounty photo ("{{bounty.spot}}") for the {{booking.service}} on {{booking.date}}.',
        ctaLabel: 'Review submission',
      },
    },
  },
  sos_triggered: {
    audience: 'operator',
    ctaUrlVar: 'incident.url',
    channels: {
      sms: {
        body: 'SOS from {{worker.first_name}} at {{incident.time}} — {{booking.service}} {{booking.date}}. Location: {{incident.location}}. Open: {{incident.url}}',
      },
      email: {
        subject: 'SOS alert: {{worker.first_name}} needs help',
        heading: 'SOS alert',
        body: '{{worker.first_name}} triggered an SOS at {{incident.time}} during {{booking.service}} on {{booking.date}}. Location: {{incident.location}}.',
        ctaLabel: 'View incident',
      },
      push: {
        body: 'SOS: {{worker.first_name}} triggered an emergency alert.',
      },
    },
  },
};
