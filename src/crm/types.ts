/**
 * Customer relationship types (Verticals C3 — TURNWRK-322).
 *
 * Extracted from src/types/clean.ts. `CleanCustomer` already carried ZERO
 * cleaning fields — it is org-scoped end-consumer identity that the booking app
 * and Dispatch share alike, so it moves to the shared core (settles TURNWRK-270:
 * Customer is promoted to `@turnwrk/shared/crm`, not federated over
 * `cleanApiClient`).
 *
 * Money references (`paymentPolicy`, `quoteSnapshot`) still point at the Clean
 * types in ../types/clean; the `/money` extraction (Phase C) re-homes those and
 * this import moves with it. Timestamps are epoch ms (UTC); `termsDays` is days.
 */
import type { CleanPaymentPolicy, CleanQuote } from '../types/clean';
import type { PropertyAddressParts } from '../types/property';

export type CustomerSource = 'widget' | 'manual' | 'import' | 'referral';

/**
 * One service location for a customer. A homeowner has one; a trade customer
 * (property manager, HOA, commercial account) has many — "one customer, many
 * sites". Mirrors `PropertyAddressParts`: a formatted `address` string plus
 * optional structured parts. `propertyId` links the site to a managed
 * `properties` doc (STR unit / residence) when one exists; a plain trade site
 * has none. This is the shared, canonical multi-site shape that Dispatch's
 * `EstimateServiceAddress` converges onto in Phase D.
 */
export interface ServiceAddress {
  /** Stable per-customer id. */
  id: string;
  /** Optional operator label ("Main house", "Pool cabana", "Building B"). */
  label?: string;
  /** Formatted, human-readable address string. */
  address: string;
  /** Structured decomposition of `address` when known. */
  addressParts?: PropertyAddressParts;
  /** Links to a `properties` doc when this site is a managed STR/residence. */
  propertyId?: string;
  /** Free-text access / site notes for the crew. */
  notes?: string;
}

/**
 * Org-scoped end consumer (homeowner / STR guest-payer / trade account).
 * Customers are NEVER platform users — no `Role`, no org membership; they
 * authenticate to the booking portal via magic-link/OTP tokens only.
 */
export interface Customer {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
  /** E.164 preferred. */
  phone?: string;
  /** Default service location (`properties` doc with kind 'residence'). */
  defaultPropertyId?: string;
  /**
   * Additional service locations for a trade customer (one customer, many
   * sites). Absent/empty for a single-site homeowner, who is described by
   * `defaultPropertyId` alone.
   */
  serviceAddresses?: ServiceAddress[];
  marketingOptIn?: boolean;
  source: CustomerSource;
  /**
   * When `source === 'referral'`, the referring customer's id in this org
   * (TURNWRK-288). Absent for non-referral sources.
   */
  referredByCustomerId?: string;
  /** Review that minted the referral link, when known. */
  referredFromReviewId?: string;
  stripeCustomerId?: string;
  notes?: string;
  /**
   * Org-local calendar date (YYYY-MM-DD) when this customer is due for their
   * next service visit — trades use this for proactive outreach / scheduling.
   */
  dueForServiceDate?: string;
  /** Per-customer payment-policy override (negotiated commercial accounts). */
  paymentPolicy?: CleanPaymentPolicy;
  /** Per-customer invoice terms override (days). Falls back to org invoiceTermsDays. */
  termsDays?: number;
  /** Set when the customer texts STOP; cleared on START. Blocks all SMS sends. */
  smsOptOutAt?: number;
  /**
   * Per-customer opt-out of the Verticals V2 proof-of-service visit report.
   * When true, no report is sent for this customer even if the org toggle is
   * on. Absent/false inherits the org default.
   */
  visitReportOptOut?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type LeadStatus = 'open' | 'contacted' | 'converted' | 'dead';

/** Captured mid-funnel at the wizard's "Get a Price" gate. */
export interface Lead {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status: LeadStatus;
  /** Full quote at capture time — powers the resume link. */
  quoteSnapshot: CleanQuote;
  /** Set when the lead converts (auto-`converted`). */
  bookingId?: string;
  /** Random bearer token embedded in resume links. */
  resumeToken: string;
  followUps?: {
    sent0hAt?: number;
    sent48hAt?: number;
    sent7dAt?: number;
  };
  unsubscribedAt?: number;
  createdAt: number;
  updatedAt: number;
}
