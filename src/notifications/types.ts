/**
 * Notification contracts (Verticals C6 — TURNWRK-325).
 *
 * Extracted from src/types/clean.ts. The registry was already structurally
 * generic; this move is structural only.
 *
 * NOT done here (split to the card's remainder): neutralising the default copy,
 * renaming `cleaner_en_route` / `cleaner.first_name` with dual-read, and pack
 * `notificationCopy` resolution. Names still say Clean* so this PR is a pure
 * move — renaming and rewording in the same commit would hide which change
 * broke a render.
 */
import type { CleanEventEntity } from '../types/clean';

export type CleanNotificationChannel = 'email' | 'sms' | 'push';

export type CleanNotificationAudience = 'customer' | 'contractor' | 'operator';

/**
 * Every templated send in the product. The ENG §12 matrix + Change Order 1
 * additions. Default copy per (eventKey, channel) lives in
 * clean/notificationDefaults.ts; org overrides in clean_notificationTemplates.
 */
export type CleanNotificationEventKey =
  | 'booking_confirmed'
  | 'booking_assigned'
  | 'booking_changed'
  | 'booking_canceled'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'preauth_upcoming_hold'
  | 'payment_risk'
  | 'receipt'
  | 'review_request'
  | 'lead_recovery'
  // Change Order 1:
  | 'cleaner_en_route' // A1
  | 'invoice_issued' // R1/A2
  | 'invoice_reminder' // A2 (dunning stage is a template variable, not N keys)
  | 'invoice_overdue' // A2
  | 'sos_triggered' // A4 — exempt from plan gating (safety is not a tier)
  | 'bounty_submitted' // CO2 — operator review-queue nudge (manual approval mode)
  | 'visit_report'; // Verticals V2 — proof-of-service auto-report after a visit

/**
 * Org-edited template override for one (eventKey, channel, audience). Only
 * materialized when an operator edits — the merged view is defaults ∪ these.
 * Body/subject use {{dotted.variable}} tokens; rendering fails safe (falls
 * back to the code default, never sends raw placeholders).
 */
export interface CleanNotificationTemplate {
  id: string;
  orgId: string;
  eventKey: CleanNotificationEventKey;
  channel: CleanNotificationChannel;
  audience: CleanNotificationAudience;
  /** Email only. */
  subject?: string;
  /** Maps to the clean-notification email template's heading slot. */
  heading?: string;
  body: string;
  ctaLabel?: string;
  footnote?: string;
  enabled: boolean;
  /** False once operator-edited; true rows mirror the code default. */
  isDefault: boolean;
  updatedBy?: string;
  createdAt: number;
  updatedAt: number;
}

export type CleanNotificationSendStatus =
  | 'sent'
  | 'simulated'
  | 'skipped_optout'
  | 'skipped_disabled'
  | 'skipped_duplicate'
  | 'render_failed'
  | 'error';

/**
 * One channel attempt by the notification engine — the metering/audit record
 * (SMS usage billing derives from these; doc 07 F2 prerequisite).
 */
export interface CleanNotificationSend {
  id: string;
  orgId: string;
  eventKey: CleanNotificationEventKey;
  channel: CleanNotificationChannel;
  audience: CleanNotificationAudience;
  entity?: CleanEventEntity;
  entityId?: string;
  /** Email address or E.164 number (org-scoped PII). */
  to: string;
  status: CleanNotificationSendStatus;
  /** Provider message id (Surge/Resend), when sent. */
  providerId?: string;
  /** SMS segment count, for metered billing. */
  segments?: number;
  error?: string;
  idempotencyKey?: string;
  createdAt: number;
}
