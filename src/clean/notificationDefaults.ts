/**
 * Default notification templates (Change Order 1 R2) — the ENG §12 matrix as
 * a code-owned registry. Copy here is the shipped literal wording lifted from
 * clean/src/lib/clean/email.ts, expressed with {{tokens}}.
 *
 * Defaults live in CODE, not seeded docs: orgs inherit copy improvements until
 * they customize; clean_notificationTemplates docs only exist once edited, and
 * "reset to default" just deletes the override doc.
 *
 * Rules for default copy:
 *   - Only reference variables the context builders GUARANTEE (missing vars
 *     fail the render — see templateRender.ts). {{eta}} is deliberately absent
 *     from the en-route default; an eta-bearing variant activates in v1.1.
 *   - CTA URLs are never operator-editable (phishing/mistake risk): the email
 *     CTA comes from `ctaUrlVar`, resolved by the engine from the vars map.
 */
import type {
  CleanNotificationAudience,
  CleanNotificationChannel,
  CleanNotificationEventKey,
} from '../types/clean';

/** Renderable slots for one channel. `body` maps to the email intro / whole SMS. */
export interface CleanTemplateBody {
  /** Email only. */
  subject?: string;
  /** Email only. */
  heading?: string;
  body: string;
  ctaLabel?: string;
  footnote?: string;
}

export interface CleanTemplateDefault {
  audience: CleanNotificationAudience;
  /** Var name whose value becomes the email CTA URL (e.g. 'review.url'). */
  ctaUrlVar?: string;
  /**
   * Channels this event sends on by default. For customer events that define
   * both sms and email, the engine prefers SMS when the org has SMS enabled
   * and the customer has a phone and hasn't opted out; otherwise email.
   */
  channels: Partial<Record<CleanNotificationChannel, CleanTemplateBody>>;
}

export const DEFAULT_CLEAN_TEMPLATES: Record<CleanNotificationEventKey, CleanTemplateDefault> = {
  booking_confirmed: {
    audience: 'customer',
    channels: {
      email: {
        subject: 'Your {{org.name}} booking is confirmed',
        heading: "You're booked!",
        body: 'Thanks {{customer.first_name}}! {{org.name}} has your cleaning scheduled. Here are the details:',
        // Policy-dependent (R1): the summary line for the booking's payment policy.
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
  booking_changed: {
    audience: 'customer',
    channels: {
      email: {
        subject: 'Update to your {{org.name}} appointment',
        heading: 'Your appointment was updated',
        body: 'Your {{booking.service}} booking has been updated. Here are the latest details:',
      },
    },
  },
  booking_canceled: {
    audience: 'customer',
    channels: {
      email: {
        subject: 'Your {{org.name}} appointment was canceled',
        heading: 'Appointment canceled',
        body: 'Your {{booking.service}} on {{booking.date}} has been canceled.',
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
  preauth_upcoming_hold: {
    audience: 'customer',
    channels: {
      email: {
        subject: 'A hold is scheduled for your {{org.name}} service',
        heading: 'Upcoming service hold',
        body: 'Ahead of your {{booking.service}} on {{booking.date}}, a temporary hold will be placed on your card.',
        footnote: "This is only a hold — you won't be charged until the service is completed.",
      },
    },
  },
  payment_risk: {
    audience: 'customer',
    channels: {
      email: {
        subject: 'Action needed: update your card for {{org.name}}',
        heading: 'We couldn’t authorize your card',
        body: 'We tried to place a hold for your upcoming {{booking.service}} on {{booking.date}}, but your card was declined. Please reply to update your payment details so your service isn’t interrupted.',
      },
    },
  },
  receipt: {
    audience: 'customer',
    channels: {
      email: {
        subject: 'Your {{org.name}} receipt',
        heading: 'Payment received — thank you!',
        body: "Here's your receipt for the {{booking.service}} on {{booking.date}}.",
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
  // --- Change Order 1 additions ---
  cleaner_en_route: {
    audience: 'customer',
    channels: {
      sms: {
        body: '{{cleaner.first_name}} from {{org.name}} is on the way for your {{booking.service}} (arrival window {{booking.window}}).',
      },
      email: {
        subject: '{{org.name}}: your cleaner is on the way',
        heading: 'On the way!',
        body: '{{cleaner.first_name}} is en route for your {{booking.service}} — arrival window {{booking.window}}.',
      },
    },
  },
  invoice_issued: {
    audience: 'customer',
    ctaUrlVar: 'invoice.pay_url',
    channels: {
      email: {
        subject: 'Your {{org.name}} invoice {{invoice.number}}',
        heading: 'Your invoice',
        body: 'Your {{booking.service}} on {{booking.date}} is complete. Invoice {{invoice.number}} for {{invoice.balance}} is due {{invoice.due_date}}. You can pay online any time.',
        ctaLabel: 'Pay invoice online',
      },
    },
  },
  invoice_reminder: {
    audience: 'customer',
    ctaUrlVar: 'invoice.pay_url',
    channels: {
      email: {
        subject: 'Reminder: invoice {{invoice.number}} from {{org.name}}',
        heading: 'Payment reminder',
        body: 'A friendly reminder — invoice {{invoice.number}} has a balance of {{invoice.balance}}, due {{invoice.due_date}}.',
        ctaLabel: 'Pay invoice online',
      },
      sms: {
        body: '{{org.name}}: invoice {{invoice.number}} ({{invoice.balance}}) is due {{invoice.due_date}}. Pay online: {{invoice.pay_url}}',
      },
    },
  },
  invoice_overdue: {
    audience: 'customer',
    ctaUrlVar: 'invoice.pay_url',
    channels: {
      email: {
        subject: 'Invoice {{invoice.number}} from {{org.name}} is past due',
        heading: 'Invoice past due',
        body: 'Invoice {{invoice.number}} with a balance of {{invoice.balance}} was due {{invoice.due_date}} and is now past due. Please pay online or get in touch.',
        ctaLabel: 'Pay invoice online',
      },
      sms: {
        body: '{{org.name}}: invoice {{invoice.number}} ({{invoice.balance}}) is past due. Pay online: {{invoice.pay_url}}',
      },
    },
  },
  sos_triggered: {
    // Operator-audience safety alert — exempt from plan gating (A4).
    audience: 'operator',
    ctaUrlVar: 'incident.url',
    channels: {
      sms: {
        body: 'SOS from {{cleaner.first_name}} at {{incident.time}} — {{booking.service}} {{booking.date}}. Location: {{incident.location}}. Open: {{incident.url}}',
      },
      email: {
        subject: 'SOS alert: {{cleaner.first_name}} needs help',
        heading: 'SOS alert',
        body: '{{cleaner.first_name}} triggered an SOS at {{incident.time}} during {{booking.service}} on {{booking.date}}. Location: {{incident.location}}.',
        ctaLabel: 'View incident',
      },
      push: {
        body: 'SOS: {{cleaner.first_name}} triggered an emergency alert.',
      },
    },
  },
};

export const CLEAN_NOTIFICATION_EVENT_KEYS = Object.keys(
  DEFAULT_CLEAN_TEMPLATES,
) as CleanNotificationEventKey[];

/**
 * Canonical sample variable set — one entry for EVERY variable any default
 * template may reference. Used by the settings-page live preview, the
 * test-send route, and the defaults-completeness test (which fails the build
 * if a default references a variable missing here).
 */
export const SAMPLE_TEMPLATE_VARS: Record<string, string | number> = {
  'org.name': 'Your Company',
  'customer.first_name': 'Sally',
  'customer.last_name': 'Example',
  'booking.service': 'Deep Clean',
  'booking.date': '2026-08-01',
  'booking.window': '09:00–10:00',
  'booking.total': '$180.00',
  'payment.policy_summary':
    "A hold may be placed 48 hours before your service — but you won't be charged until the service is completed.",
  'cleaner.first_name': 'Maria',
  'review.url': 'https://example.com/review/sample',
  'lead.resume_url': 'https://example.com/resume/sample',
  'invoice.number': 'INV-000042',
  'invoice.balance': '$120.00',
  'invoice.total': '$120.00',
  'invoice.due_date': '2026-08-15',
  'invoice.pay_url': 'https://example.com/pay/sample',
  'invoice.stage': 1,
  'incident.time': 'Aug 1, 9:15 AM',
  'incident.location': 'https://maps.google.com/?q=30.2672,-97.7431',
  'incident.url': 'https://example.com/app/bookings',
  eta: '15 min',
};

/** Default template for one (eventKey, channel), or undefined if not sent by default. */
export function defaultTemplateFor(
  eventKey: CleanNotificationEventKey,
  channel: CleanNotificationChannel,
): CleanTemplateBody | undefined {
  return DEFAULT_CLEAN_TEMPLATES[eventKey]?.channels[channel];
}
