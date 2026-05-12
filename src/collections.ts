/**
 * Canonical Firestore collection names for the turnwrk suite.
 *
 * Convention:
 *   - Shared collections (read/written by more than one app) use no prefix.
 *   - App-scoped collections use a prefix (`cmms_`, `restock_`) so DB admin
 *     work can tell at a glance which app owns the data.
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
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
