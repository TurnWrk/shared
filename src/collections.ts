/**
 * Canonical Firestore collection names for the turnwrk suite.
 *
 * Convention:
 *   - Shared collections (read/written by more than one app) use no prefix.
 *   - App-scoped collections use a prefix (`cmms_`, `restock_`, `clean_`) so
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
  // Written by hostfix-cmms today; restock cleaners later.
  vendorReceipts: 'vendorReceipts',
  // Org-independent vendor identity (keyed by phone); shared across CMMS + Restock.
  vendors: 'vendors',
  // Links vendors to orgs via app-specific profile docs (cmms_technicians / restock_cleaners).
  vendorAffiliations: 'vendorAffiliations',
  // Vendor calendar share links (created by cmms + restock UIs; public page
  // served by cmms resolves them via the Admin SDK — no public read).
  propertyShareTokens: 'propertyShareTokens',

  // hostfix-cmms-scoped
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
  cmms_reviews: 'cmms_reviews',
  cmms_reports: 'cmms_reports',
  // Owner-facing work-order estimates. Public /estimate/{token} page + the
  // approve/decline writeback resolve these via the Admin SDK — no public read.
  cmms_estimates: 'cmms_estimates',

  // Turnwrk Clean (cleaning-operations product; operator portal + public
  // booking app both live in `clean/`, sharing this Firestore project). Types
  // in types/clean.ts; writes are server-side except tech check-in/out.
  clean_customers: 'clean_customers',
  clean_leads: 'clean_leads',
  // One embedded catalog doc per org: clean_catalogs/{orgId}.
  clean_catalogs: 'clean_catalogs',
  clean_bookings: 'clean_bookings',
  clean_bookingSeries: 'clean_bookingSeries',
  clean_assignments: 'clean_assignments',
  clean_payments: 'clean_payments',
  clean_invoices: 'clean_invoices',
  clean_payoutPeriods: 'clean_payoutPeriods',
  // Customer booking reviews — distinct from cmms_reviews (property/guest store).
  clean_reviews: 'clean_reviews',
  // Append-only transition/audit stream; Stripe webhook dedupe (doc id = event id).
  clean_events: 'clean_events',
  // Per-org counters (invoice sequence, …) — doc id == orgId.
  clean_counters: 'clean_counters',
  // Org-edited notification template overrides (Change Order 1 R2). Defaults
  // live in code (clean/notificationDefaults.ts); docs exist only once edited.
  clean_notificationTemplates: 'clean_notificationTemplates',
  // Per-send metering/audit for the notification engine (SMS billing source).
  clean_notificationSends: 'clean_notificationSends',
  // Weekly working hours, one doc per (org, tech) — absent = always available.
  clean_contractorAvailability: 'clean_contractorAvailability',
  // PTO/sick/unavailable ranges with request→approve lifecycle (R3).
  clean_timeOff: 'clean_timeOff',
  // Field-safety incidents (SOS alerts) — A4.
  clean_incidents: 'clean_incidents',
  // Booking-site short links; doc id == short code (A9).
  clean_shortLinks: 'clean_shortLinks',
  // Bounty photo rewards (Change Order 2). Program config incl. the embedded
  // spot list, one doc per org (doc id == orgId, catalog pattern).
  clean_bountyPrograms: 'clean_bountyPrograms',
  // One bounty per eligible job (booking) — the drawn challenge + outcome.
  clean_bounties: 'clean_bounties',
  // Cleaner photo submissions incl. auto-rejected rows (audit trail).
  clean_bountySubmissions: 'clean_bountySubmissions',

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
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
