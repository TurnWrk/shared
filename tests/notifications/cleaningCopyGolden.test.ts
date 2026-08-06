/**
 * Golden baseline for cleaning notification copy (Verticals C6 — TURNWRK-325).
 *
 * WHAT THIS IS FOR: the card neutralises the default template copy so a pool
 * customer is not told their "cleaner" is on the way. Cleaning orgs are the only
 * real orgs today, so that rewrite must NOT change a single word they receive —
 * `CLEANING_PACK.notificationCopy` has to carry today's wording forward.
 *
 * Every (event, channel, slot) below is the text a cleaning org renders RIGHT
 * NOW, frozen as a literal — not derived from the registry, which would make
 * this circular and prove nothing. When the neutralisation lands, this file must
 * pass UNCHANGED. If it needs editing to go green, the pack copy is not lossless
 * and real customers are about to read different words.
 *
 * Same discipline as the B1 golden test (clean/tests/lib/verticalsGolden.test.ts).
 */
import { describe, it, expect } from 'vitest';
import {
  SAMPLE_TEMPLATE_VARS,
  resolveNotificationDefaults,
} from '../../src/notifications/defaults';
import { renderTemplate } from '../../src/notifications/render';
import { CLEANING_PACK } from '../../src/verticals';

type Slot = 'subject' | 'heading' | 'body' | 'ctaLabel' | 'footnote';

/** Rendered text a cleaning org sees today. Frozen 2026-07-29. */
const CLEANING_BASELINE: Record<string, Partial<Record<Slot, string>>> = {
  "booking_confirmed.email": {
    "subject": "Your Your Company booking is confirmed",
    "heading": "You're booked!",
    "body": "Thanks Sally! Your Company has your cleaning scheduled. Here are the details:",
    "footnote": "A hold may be placed 48 hours before your service — but you won't be charged until the service is completed."
  },
  "booking_assigned.email": {
    "subject": "Your Your Company appointment is scheduled",
    "heading": "Your cleaner is assigned",
    "body": "Good news — your Deep Clean on 2026-08-01 is assigned and on the schedule."
  },
  "booking_changed.email": {
    "subject": "Update to your Your Company appointment",
    "heading": "Your appointment was updated",
    "body": "Your Deep Clean booking has been updated. Here are the latest details:"
  },
  "booking_canceled.email": {
    "subject": "Your Your Company appointment was canceled",
    "heading": "Appointment canceled",
    "body": "Your Deep Clean on 2026-08-01 has been canceled."
  },
  "reminder_24h.email": {
    "subject": "Reminder: your Your Company cleaning is tomorrow",
    "heading": "See you tomorrow!",
    "body": "A friendly reminder — your Deep Clean is tomorrow, 2026-08-01, arriving 09:00–10:00."
  },
  "reminder_24h.sms": {
    "body": "Reminder from Your Company: your Deep Clean is tomorrow (2026-08-01), arrival window 09:00–10:00. Reply STOP to opt out."
  },
  "reminder_2h.email": {
    "subject": "Your Your Company cleaning is coming up today",
    "heading": "Almost time!",
    "body": "Your Deep Clean is today — arrival window 09:00–10:00."
  },
  "reminder_2h.sms": {
    "body": "Your Company: your Deep Clean is today, arrival window 09:00–10:00."
  },
  "preauth_upcoming_hold.email": {
    "subject": "A hold is scheduled for your Your Company service",
    "heading": "Upcoming service hold",
    "body": "Ahead of your Deep Clean on 2026-08-01, a temporary hold will be placed on your card.",
    "footnote": "This is only a hold — you won't be charged until the service is completed."
  },
  "payment_risk.email": {
    "subject": "Action needed: update your card for Your Company",
    "heading": "We couldn’t authorize your card",
    "body": "We tried to place a hold for your upcoming Deep Clean on 2026-08-01, but your card was declined. Please reply to update your payment details so your service isn’t interrupted."
  },
  "receipt.email": {
    "subject": "Your Your Company receipt",
    "heading": "Payment received — thank you!",
    "body": "Here's your receipt for the Deep Clean on 2026-08-01."
  },
  "review_request.email": {
    "subject": "How was your Your Company service?",
    "heading": "We hope you loved your clean!",
    "body": "Hi Sally, thanks for choosing Your Company. How did we do? Tap below to rate your recent Deep Clean — it only takes a moment.",
    "ctaLabel": "Rate your service",
    "footnote": "Your feedback helps us improve and lets others know what to expect."
  },
  "lead_recovery.email": {
    "subject": "Your Your Company quote is waiting",
    "heading": "Pick up where you left off",
    "body": "Hi Sally, your cleaning quote from Your Company is saved and ready. Tap below to finish booking in under a minute.",
    "ctaLabel": "Finish my booking"
  },
  "worker_en_route.sms": {
    "body": "Maria from Your Company is on the way for your Deep Clean (arrival window 09:00–10:00)."
  },
  "worker_en_route.email": {
    "subject": "Your Company: your cleaner is on the way",
    "heading": "On the way!",
    "body": "Maria is en route for your Deep Clean — arrival window 09:00–10:00."
  },
  "invoice_issued.email": {
    "subject": "Your Your Company invoice INV-000042",
    "heading": "Your invoice",
    "body": "Your Deep Clean on 2026-08-01 is complete. Invoice INV-000042 for $120.00 is due 2026-08-15. You can pay online any time.",
    "ctaLabel": "Pay invoice online"
  },
  "invoice_reminder.email": {
    "subject": "Reminder: invoice INV-000042 from Your Company",
    "heading": "Payment reminder",
    "body": "A friendly reminder — invoice INV-000042 has a balance of $120.00, due 2026-08-15.",
    "ctaLabel": "Pay invoice online"
  },
  "invoice_reminder.sms": {
    "body": "Your Company: invoice INV-000042 ($120.00) is due 2026-08-15. Pay online: https://example.com/pay/sample"
  },
  "invoice_overdue.email": {
    "subject": "Invoice INV-000042 from Your Company is past due",
    "heading": "Invoice past due",
    "body": "Invoice INV-000042 with a balance of $120.00 was due 2026-08-15 and is now past due. Please pay online or get in touch.",
    "ctaLabel": "Pay invoice online"
  },
  "invoice_overdue.sms": {
    "body": "Your Company: invoice INV-000042 ($120.00) is past due. Pay online: https://example.com/pay/sample"
  },
  "bounty_submitted.email": {
    "subject": "Bounty photo awaiting review",
    "heading": "A bounty photo needs your review",
    "body": "Maria submitted a bounty photo (\"Under the kitchen sink\") for the Deep Clean on 2026-08-01.",
    "ctaLabel": "Review submission"
  },
  "visit_report.sms": {
    "body": "Your Company: your Deep Clean on 2026-08-01 is done — 4 photos, Checklist 12/14 complete. View: https://example.com/app/reports/sample"
  },
  "visit_report.email": {
    "subject": "Your Your Company service report — 2026-08-01",
    "heading": "Your visit report",
    "body": "Hi Sally, your Deep Clean on 2026-08-01 is complete. We took 4 photos and Checklist 12/14 complete. Tap below for the full report.",
    "ctaLabel": "View full report",
    "footnote": "Kept on file so you can look back any time."
  },
  "visit_weather_rescheduled.sms": {
    "body": "Your Company: your Deep Clean moved from 2026-08-01 to 2026-08-03 due to weather."
  },
  "visit_weather_rescheduled.email": {
    "subject": "Your Your Company visit moved to 2026-08-03",
    "heading": "Visit rescheduled",
    "body": "Hi Sally, weather interrupted your Deep Clean on 2026-08-01. We have moved it to 2026-08-03. Your regular schedule is unchanged.",
    "footnote": "This is a one-time move — your recurring cadence stays the same."
  },
  "sos_triggered.sms": {
    "body": "SOS from Maria at Aug 1, 9:15 AM — Deep Clean 2026-08-01. Location: https://maps.google.com/?q=30.2672,-97.7431. Open: https://example.com/app/bookings"
  },
  "sos_triggered.email": {
    "subject": "SOS alert: Maria needs help",
    "heading": "SOS alert",
    "body": "Maria triggered an SOS at Aug 1, 9:15 AM during Deep Clean on 2026-08-01. Location: https://maps.google.com/?q=30.2672,-97.7431.",
    "ctaLabel": "View incident"
  },
  "sos_triggered.push": {
    "body": "SOS: Maria triggered an emergency alert."
  }
};

describe('cleaning copy is unchanged by neutralisation', () => {
  const resolved = resolveNotificationDefaults(CLEANING_PACK.notificationCopy);

  it('renders every frozen (event, channel, slot) identically', () => {
    for (const [entry, slots] of Object.entries(CLEANING_BASELINE)) {
      const dot = entry.lastIndexOf('.');
      const eventKey = entry.slice(0, dot);
      const channel = entry.slice(dot + 1);
      const def = resolved[eventKey as keyof typeof resolved];
      expect(def, `${entry}: event missing after pack resolution`).toBeDefined();
      const bodyDef = def.channels[channel as keyof typeof def.channels] as
        | Partial<Record<Slot, string>>
        | undefined;
      expect(bodyDef, `${entry}: channel missing after pack resolution`).toBeDefined();

      for (const [slot, expected] of Object.entries(slots) as [Slot, string][]) {
        const text = bodyDef![slot];
        expect(text, `${entry}.${slot} disappeared`).toBeDefined();
        const r = renderTemplate(text!, SAMPLE_TEMPLATE_VARS);
        expect(r.ok, `${entry}.${slot} no longer renders`).toBe(true);
        expect(r.ok === true && r.text, `${entry}.${slot} wording changed`).toBe(expected);
      }
    }
  });

  it('covers every channel of every shipped event, so nothing can slip through', () => {
    const covered = new Set(Object.keys(CLEANING_BASELINE));
    for (const [key, def] of Object.entries(resolved)) {
      for (const channel of Object.keys(def.channels)) {
        expect(covered.has(`${key}.${channel}`), `${key}.${channel} is not in the baseline`).toBe(
          true,
        );
      }
    }
  });
});
