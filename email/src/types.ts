export type InviteData = {
  code: string;
  orgName: string;
  inviterName: string;
  acceptUrl: string;
};

export type PasswordResetData = {
  recipientName?: string;
  resetUrl: string;
  expiresInMinutes: number;
};

export type MagicLinkData = {
  recipientName?: string;
  signInUrl: string;
  /** Product label in copy, e.g. "Hostfix" or "Restock". Defaults to "turnwrk". */
  appName?: string;
  expiresInMinutes: number;
};

export type EstimateData = {
  orgName: string;
  ownerName: string;
  propertyAddress: string;
  woTitle: string;
  /** Pre-formatted USD total, e.g. "$1,250.00". */
  amount: string;
  scopeNote: string;
  /** Public /estimate/{token} link where the owner approves or declines. */
  viewUrl: string;
  /** Optional WO notes shared with the owner. */
  sharedNotes?: string[];
  /** Optional WO photo URLs shared with the owner (up to ~3 shown as thumbnails). */
  sharedImageUrls?: string[];
  /** `'repair'` (default) or `'proposal'` — changes subject/CTA copy. */
  kind?: 'repair' | 'proposal';
  /** Proposal headline when kind is proposal. */
  title?: string;
  /** True when re-notifying after an in-place revise (same public link). */
  isUpdate?: boolean;
};

export type CleanNotificationDetail = { label: string; value: string };

/**
 * Flexible customer-facing notification for Turnwrk Clean (booking confirmation,
 * appointment update, invoice, pre-auth/hold notice). The clean app composes the
 * copy per event; this template just renders it.
 */
export type CleanNotificationData = {
  subject: string;
  orgName: string;
  heading: string;
  intro: string;
  details?: CleanNotificationDetail[];
  ctaUrl?: string;
  ctaLabel?: string;
  footnote?: string;
};

export type Templates = {
  invite: InviteData;
  'password-reset': PasswordResetData;
  'magic-link': MagicLinkData;
  estimate: EstimateData;
  'clean-notification': CleanNotificationData;
};

export type TemplateName = keyof Templates;

export type SendEmailParams<T extends TemplateName = TemplateName> = {
  to: string | string[];
  template: T;
  data: Templates[T];
  idempotencyKey?: string;
  replyTo?: string;
  from?: string;
};

export type SendEmailResult = {
  id: string;
  /** True when no API key was configured and the send was a no-op. */
  simulated?: boolean;
};
