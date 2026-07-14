/**
 * Named scenarios: pure fns from optional overrides to a ScenarioResult.
 *
 * The seed route resolves a scenario by name, applies overrides, then creates
 * the `auth` users and writes the `firestore` docs. Keep scenarios composable —
 * higher-level ones extend `base`.
 */
import { COLLECTIONS } from '../collections';
import {
  TEST_DATA,
  buildOrg,
  buildManagerUser,
  buildPlatformAdminUser,
  buildProperty,
  buildCategory,
  buildProduct,
  buildCleaner,
  buildResupplyToken,
  buildCuratedList,
  buildTechnician,
  buildTechUser,
  buildWorkOrder,
  buildCustomer,
  buildBooking,
  buildCleanCatalog,
  authManager,
  authManagerB,
  authPlatformAdmin,
  authTechnician,
} from './builders';
import type { DeepPartial, Scenario, ScenarioResult, FirestoreDoc } from './types';

/** Deterministic, order-independent merge of overrides onto a scenario result. */
export function mergeScenario(base: ScenarioResult, overrides?: DeepPartial<ScenarioResult>): ScenarioResult {
  if (!overrides) return base;
  const auth = [...base.auth];
  for (const u of overrides.auth ?? []) {
    if (!u || !u.uid) continue;
    const i = auth.findIndex((a) => a.uid === u.uid);
    if (i >= 0) auth[i] = { ...auth[i], ...u } as (typeof auth)[number];
    else auth.push(u as (typeof auth)[number]);
  }
  const firestore: ScenarioResult['firestore'] = {};
  for (const [coll, docs] of Object.entries(base.firestore)) firestore[coll] = { ...docs };
  for (const [coll, docs] of Object.entries(overrides.firestore ?? {})) {
    firestore[coll] = { ...(firestore[coll] ?? {}) };
    for (const [docId, doc] of Object.entries(docs ?? {})) {
      firestore[coll][docId] = { ...(firestore[coll][docId] ?? {}), ...(doc as FirestoreDoc) };
    }
  }
  return { auth, firestore };
}

/** Minimal shared footing: one org, its pro owner, a platform admin, one property. */
export const base: Scenario = (overrides) =>
  mergeScenario(
    {
      auth: [authManager(), authPlatformAdmin()],
      firestore: {
        [COLLECTIONS.orgs]: { [TEST_DATA.orgId]: buildOrg() },
        [COLLECTIONS.users]: {
          [TEST_DATA.managerId]: buildManagerUser(),
          [TEST_DATA.adminId]: buildPlatformAdminUser(),
        },
        [COLLECTIONS.properties]: { [TEST_DATA.propertyId]: buildProperty() },
      },
    },
    overrides
  );

/**
 * Two isolated orgs, each with its own owner + property. The highest-value
 * security scenario: proves a member of org A cannot read org B's docs once
 * Firestore rules are loaded into the emulator.
 */
export const multiTenantTwoOrgs: Scenario = (overrides) =>
  mergeScenario(
    {
      auth: [authManager(), authManagerB(), authPlatformAdmin()],
      firestore: {
        [COLLECTIONS.orgs]: {
          [TEST_DATA.orgId]: buildOrg(),
          [TEST_DATA.orgBId]: buildOrg({ name: TEST_DATA.orgBName }),
        },
        [COLLECTIONS.users]: {
          [TEST_DATA.managerId]: buildManagerUser(),
          [TEST_DATA.managerBId]: buildManagerUser({
            uid: TEST_DATA.managerBId,
            email: TEST_DATA.managerBEmail,
            memberships: [{ orgId: TEST_DATA.orgBId, roles: ['owner'] }],
            overrides: { displayName: 'Test Manager B' },
          }),
          [TEST_DATA.adminId]: buildPlatformAdminUser(),
        },
        [COLLECTIONS.properties]: {
          [TEST_DATA.propertyId]: buildProperty(),
          [TEST_DATA.propertyBId]: buildProperty({ orgId: TEST_DATA.orgBId, name: 'Org B Villa' }),
        },
      },
    },
    overrides
  );

/** base + a small restock catalog, cleaner, and QR resupply token. */
export const restockCatalog: Scenario = (overrides) => {
  const b = base();
  return mergeScenario(
    {
      auth: b.auth,
      firestore: {
        ...b.firestore,
        [COLLECTIONS.restock_categories]: {
          '1': buildCategory('1', 'Bathroom Essentials', 'bathroom', '🛁'),
          '2': buildCategory('2', 'Kitchen Supplies', 'kitchen', '🍳'),
        },
        [COLLECTIONS.restock_products]: {
          'tp-2': buildProduct({ id: 'tp-2', name: 'Charmin Ultra Soft Toilet Paper', price: 32.99, source: 'amazon', categoryId: '1', qualityRating: 2, itemType: 'toilet-paper' }),
          'dish-2': buildProduct({ id: 'dish-2', name: 'Dawn Ultra Dish Soap', price: 7.99, source: 'walmart', categoryId: '2', qualityRating: 2, itemType: 'dish-soap' }),
        },
        [COLLECTIONS.restock_curatedLists]: { [TEST_DATA.curatedListId]: buildCuratedList() },
        [COLLECTIONS.restock_cleaners]: { [TEST_DATA.cleanerId]: buildCleaner() },
        [COLLECTIONS.restock_propertyTokens]: { [TEST_DATA.tokenId]: buildResupplyToken() },
      },
    },
    overrides
  );
};

/** base + catalog + public booking slug + a customer/booking (wizard E2E). */
export const cleanBooking: Scenario = (overrides) => {
  const b = base();
  return mergeScenario(
    {
      auth: b.auth,
      firestore: {
        ...b.firestore,
        [COLLECTIONS.orgs]: {
          [TEST_DATA.orgId]: buildOrg({
            cleanSettings: {
              bookingSiteSlug: TEST_DATA.bookingSiteSlug,
              paymentPolicy: 'offline',
              maxConcurrentPerWindow: 3,
            },
          }),
        },
        [COLLECTIONS.clean_customers]: { [TEST_DATA.customerId]: buildCustomer() },
        [COLLECTIONS.clean_bookings]: { [TEST_DATA.bookingId]: buildBooking() },
        [COLLECTIONS.clean_catalogs]: { [TEST_DATA.orgId]: buildCleanCatalog() },
      },
    },
    overrides
  );
};

/**
 * base + a signed-in-able technician (auth user + users doc + onboarded
 * cmms_technicians profile) and a work order assigned to them. This is the
 * scenario the hostfix technician-PWA visual specs sign in as.
 */
export const cmmsWorkOrders: Scenario = (overrides) => {
  const b = base();
  return mergeScenario(
    {
      auth: [...b.auth, authTechnician()],
      firestore: {
        ...b.firestore,
        [COLLECTIONS.users]: {
          ...b.firestore[COLLECTIONS.users],
          [TEST_DATA.technicianId]: buildTechUser(),
        },
        [COLLECTIONS.cmms_technicians]: { [TEST_DATA.technicianId]: buildTechnician() },
        [COLLECTIONS.cmms_workOrders]: {
          [TEST_DATA.workOrderId]: buildWorkOrder({ assignedTechId: TEST_DATA.technicianId }),
        },
      },
    },
    overrides
  );
};

/** Registry keyed by the names the seed route accepts. */
export const SCENARIOS = {
  base,
  'multiTenant:twoOrgs': multiTenantTwoOrgs,
  'restock:catalog': restockCatalog,
  'clean:booking': cleanBooking,
  'cmms:workOrders': cmmsWorkOrders,
} as const;

export type ScenarioName = keyof typeof SCENARIOS;

/** Resolve a scenario by name, applying overrides. Throws on unknown name. */
export function resolveScenario(name: string, overrides?: DeepPartial<ScenarioResult>): ScenarioResult {
  const s = (SCENARIOS as Record<string, Scenario>)[name];
  if (!s) throw new Error(`Unknown test scenario "${name}". Known: ${Object.keys(SCENARIOS).join(', ')}`);
  return s(overrides);
}
