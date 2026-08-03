/**
 * Canonical Firestore collection names for the turnwrk suite.
 *
 * Convention:
 *   - Shared collections (read/written by more than one app) use no prefix.
 *   - App-scoped collections use a prefix (`cmms_`, `restock_`, `svc_`) so
 *     DB admin work can tell at a glance which app owns the data.
 */
export const COLLECTIONS = {
  // shared (no prefix)
  orgs: 'orgs',
  users: 'users',
  properties: 'properties',
  owners: 'owners',
  resupplyRequests: 'resupplyRequests',
  purchaseRequests: 'purchaseRequests',
  invites: 'invites',
  // Vendor-owned standalone expense receipts (see types/receipt.ts).
  // Written by dispatch today; restock cleaners later.
  vendorReceipts: 'vendorReceipts',
  // Org-independent vendor identity (keyed by phone); shared across CMMS + Restock.
  vendors: 'vendors',
  // Links vendors to orgs via app-specific profile docs (cmms_technicians / restock_cleaners).
  vendorAffiliations: 'vendorAffiliations',
  // Vendor calendar share links (created by cmms + restock UIs; public page
  // served by cmms resolves them via the Admin SDK — no public read).
  propertyShareTokens: 'propertyShareTokens',

  // dispatch-scoped
  cmms_workOrders: 'cmms_workOrders',
  cmms_technicians: 'cmms_technicians',
  cmms_bookings: 'cmms_bookings',
  cmms_calendarSyncs: 'cmms_calendarSyncs',
  cmms_pmTemplates: 'cmms_pmTemplates',
  cmms_pmSchedules: 'cmms_pmSchedules',
  cmms_relayChatMessages: 'cmms_relayChatMessages',
  cmms_chatMeta: 'cmms_chatMeta',
  cmms_actionItems: 'cmms_actionItems',
  cmms_apiTokens: 'cmms_apiTokens',
  cmms_techRoutes: 'cmms_techRoutes',
  cmms_auditLogs: 'cmms_auditLogs',
  cmms_pushSubscriptions: 'cmms_pushSubscriptions',
  cmms_propertyMappings: 'cmms_propertyMappings',
  // Twenty CRM owner sync (TURNWRK-354). Maps an external CRM record to a CMMS
  // owner; doc id === ownermap_{orgId}_{externalId}. Server-write only.
  cmms_ownerMappings: 'cmms_ownerMappings',
  cmms_reviews: 'cmms_reviews',
  cmms_reports: 'cmms_reports',
  // Async AI work-order generation queue. dispatch enqueues; turnwrk-cortex
  // claims, runs Ollama out-of-band, and writes the resulting work orders.
  // Server-write only (Admin SDK on both sides); clients read to render the
  // in-flight / failed cards in the Incoming Requests inbox.
  cmms_woIntakeRequests: 'cmms_woIntakeRequests',
  // Owner-facing work-order estimates. Public /estimate/{token} page + the
  // approve/decline writeback resolve these via the Admin SDK — no public read.
  cmms_estimates: 'cmms_estimates',
  // Owner-facing direct/email invoices. Public /invoice/{token} resolves via
  // Admin SDK — no public Firestore read.
  cmms_ownerInvoices: 'cmms_ownerInvoices',
  // Owner portal magic-link + session tokens (TURNWRK-418). Doc id is the
  // sha256 of the raw token, which is never stored; Admin SDK only, so the
  // owner needs no Firebase Auth user and no `owner` RBAC role.
  cmms_ownerPortalTokens: 'cmms_ownerPortalTokens',
  // Fixed-window abuse counters behind the owner portal's link request form
  // (TURNWRK-418). Keyed by a salted hash of the email or IP, so the raw
  // identifier is never stored. Admin SDK only; rows are disposable.
  cmms_ownerPortalRateLimits: 'cmms_ownerPortalRateLimits',

  // Turnwrk Service (booking/recurring-service product; formerly Turnwrk Clean —
  // renamed `clean_*` → `svc_*` under TURNWRK-327 as it went vertical-agnostic).
  // Operator portal + public booking app both live in `clean/`, sharing this
  // Firestore project. Types in types/clean.ts; writes are server-side except
  // tech check-in/out.
  svc_customers: 'svc_customers',
  svc_leads: 'svc_leads',
  // One embedded catalog doc per org: svc_catalogs/{orgId}.
  svc_catalogs: 'svc_catalogs',
  svc_bookings: 'svc_bookings',
  svc_bookingSeries: 'svc_bookingSeries',
  svc_assignments: 'svc_assignments',
  svc_payments: 'svc_payments',
  svc_invoices: 'svc_invoices',
  svc_payoutPeriods: 'svc_payoutPeriods',
  // Customer booking reviews — distinct from cmms_reviews (property/guest store).
  svc_reviews: 'svc_reviews',
  // Append-only transition/audit stream; Stripe webhook dedupe (doc id = event id).
  svc_events: 'svc_events',
  // Per-org counters (invoice sequence, …) — doc id == orgId.
  svc_counters: 'svc_counters',
  // Org-edited notification template overrides (Change Order 1 R2). Defaults
  // live in code (clean/notificationDefaults.ts); docs exist only once edited.
  svc_notificationTemplates: 'svc_notificationTemplates',
  // Per-send metering/audit for the notification engine (SMS billing source).
  svc_notificationSends: 'svc_notificationSends',
  // Weekly working hours, one doc per (org, tech) — absent = always available.
  svc_contractorAvailability: 'svc_contractorAvailability',
  // PTO/sick/unavailable ranges with request→approve lifecycle (R3).
  svc_timeOff: 'svc_timeOff',
  // Field-safety incidents (SOS alerts) — A4.
  svc_incidents: 'svc_incidents',
  // Booking-site short links; doc id == short code (A9).
  svc_shortLinks: 'svc_shortLinks',
  // Bounty photo rewards (Change Order 2). Program config incl. the embedded
  // spot list, one doc per org (doc id == orgId, catalog pattern).
  svc_bountyPrograms: 'svc_bountyPrograms',
  // One bounty per eligible job (booking) — the drawn challenge + outcome.
  svc_bounties: 'svc_bounties',
  // Cleaner photo submissions incl. auto-rejected rows (audit trail).
  svc_bountySubmissions: 'svc_bountySubmissions',
  // Verticals V2 proof-of-service reports; doc id = assignment id (one per visit).
  svc_visitReports: 'svc_visitReports',

  // restock-scoped
  restock_products: 'restock_products',
  restock_categories: 'restock_categories',
  restock_propertyResupplyRequests: 'restock_propertyResupplyRequests',
  restock_supplyLists: 'restock_supplyLists',
  restock_orderSnapshots: 'restock_orderSnapshots',
  restock_cleaners: 'restock_cleaners',
  restock_propertyTokens: 'restock_propertyTokens',
  // Lightweight guest shortlist collection (was `restock_resupplyRequests`).
  // Distinct from the shared `resupplyRequests` collection, which represents
  // the merged cross-app workflow.
  restock_shortlists: 'restock_shortlists',
  restock_shortUrls: 'restock_shortUrls',
  restock_curatedLists: 'restock_curatedLists',
  restock_affiliateEvents: 'restock_affiliateEvents',
  restock_warehouses: 'restock_warehouses',
  restock_warehouseStock: 'restock_warehouseStock',
  restock_warehouseLedger: 'restock_warehouseLedger',
  restock_storage: 'restock_storage',
  restock_storageStock: 'restock_storageStock',
  restock_storageLedger: 'restock_storageLedger',
  // Visual stock evidence from Clean bounty supply-relevant approvals
  // (TURNWRK-171). Written by clean Admin on approve; restock reads.
  restock_supplySignals: 'restock_supplySignals',
  // Inspect QR scan ledger (TURNWRK-252). Client create via active
  // property token; doc id = scan_{tokenId}_{clientScanId} for idempotency.
  restock_scanEvents: 'restock_scanEvents',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
