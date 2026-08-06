/**
 * Notification contracts (Verticals C6 — TURNWRK-325).
 *
 * Extracted from src/types/clean.ts. The registry was already structurally
 * generic; this move is structural only.
 *
 * Default copy is trade-neutral; vertical packs supply trade wording via
 * `notificationCopy`. `worker_en_route` is canonical; `cleaner_en_route` dual-reads
 * for saved override docs. Template vars use `worker.first_name` with
 * `cleaner.first_name` aliased in render.ts.
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
  | 'worker_en_route' // A1 — canonical en-route key
  | 'cleaner_en_route' // legacy alias; dual-read until override docs migrate
  | 'invoice_issued' // R1/A2
  | 'invoice_reminder' // A2 (dunning stage is a template variable, not N keys)
  | 'invoice_overdue' // A2
  | 'sos_triggered' // A4 — exempt from plan gating (safety is not a tier)
  | 'bounty_submitted' // CO2 — operator review-queue nudge (manual approval mode)
  | 'visit_report' // Verticals V2 — proof-of-service auto-report after a visit
  /**
   * Verticals V7 (TURNWRK-296) — operator-declared weather/rain bulk reschedule.
   * Vertical-neutral wording; landscaping pack gates the *action*, not the copy.
   */
  | 'visit_weather_rescheduled';

/** Registry keys with a shipped default template (excludes legacy aliases). */
export type CanonicalCleanNotificationEventKey = Exclude<
  CleanNotificationEventKey,
  'cleaner_en_route'
>;

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
