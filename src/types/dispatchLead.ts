/**
 * An inbound inquiry waiting on operator review (`cmms_leads`, TURNWRK-701).
 *
 * Website inquiries used to become a real Customer plus Backlog work orders the
 * moment they arrived. A lead sits in front of that: an admin/pm reviews it,
 * optionally attaches a draft estimate, and only on conversion does dispatch
 * create the Customer and work orders (via the same intake persistence the
 * notes-first intake uses). Nothing customer-facing exists before conversion.
 *
 * Distinct from the booking wizard's `Lead` (`svc_leads`, crm/types.ts), which
 * is an abandoned-quote capture with its own status set.
 */
export const DISPATCH_LEAD_STATUSES = ['new', 'quoted', 'converted', 'spam', 'dismissed'] as const;

export type DispatchLeadStatus = (typeof DISPATCH_LEAD_STATUSES)[number];

/** Statuses a lead can still be quoted or converted from. */
export const OPEN_DISPATCH_LEAD_STATUSES: readonly DispatchLeadStatus[] = ['new', 'quoted'];

export interface DispatchLeadContact {
  name: string;
  phone?: string;
  email?: string;
}

export interface DispatchLead {
  id: string;
  orgId: string;
  /** The site the inquiry came from (domain or site slug). */
  sourceSite: string;
  /** How it arrived, e.g. 'web-form', 'phone', 'sms'. */
  source: string;
  contact: DispatchLeadContact;
  /** The inquiry as the customer wrote it. Becomes the intake notes on convert. */
  inquiryText: string;
  zip?: string;
  city?: string;
  /** Trade niche the site serves, e.g. 'plumbing'. */
  niche?: string;
  status: DispatchLeadStatus;
  /** `cmms_estimates` id of the draft quote for this lead, once one exists. */
  draftEstimateId?: string;
  /** Trace id from turnwrk-cortex when the lead was classified there. */
  cortexTraceId?: string;
  /** Set on conversion: the Customer and work orders it produced. */
  customerId?: string;
  workOrderIds?: string[];
  convertedAt?: number;
  /** Conversion lease: set while a convert is in flight so a double-submit cannot run it twice. */
  convertingAt?: number;
  createdAt: number;
  updatedAt: number;
}
