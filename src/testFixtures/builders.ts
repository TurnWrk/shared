/**
 * Pure document builders + canonical test constants.
 *
 * Generalized from restock/e2e/helpers/seed.ts (the shapes there are proven
 * against the emulator). Builders return plain, JSON-serializable objects and
 * import zero runtime SDK. Timestamps are a fixed epoch-ms constant so fixtures
 * are fully deterministic and reproducible.
 */
import type { TourId, UserOnboardingState } from '../onboarding/types';
import { checklistPreferenceTourId } from '../onboarding/logic';
import { deriveUserIndex, type Membership } from '../types/user';
import type { AuthUser, FirestoreDoc } from './types';

/** Fixed clock for reproducible fixtures (2023-11-14T22:13:20.000Z). */
export const FIXED_NOW = 1_700_000_000_000;

/**
 * Canonical identifiers shared across every scenario and spec. Deterministic
 * ids let specs assert against known docs without reading them back first.
 */
export const TEST_DATA = {
  // primary org + owner ("manager")
  orgId: 'test-org-1',
  orgName: 'Test Vacation Rentals',
  managerId: 'test-manager-1',
  managerEmail: 'test@turnwrk.com',
  managerPassword: 'test123456',
  // second org, for multi-tenant isolation checks
  orgBId: 'test-org-2',
  orgBName: 'Second Org Rentals',
  managerBId: 'test-manager-2',
  managerBEmail: 'test-b@turnwrk.com',
  managerBPassword: 'test123456',
  // platform admin (cross-org superadmin)
  adminId: 'test-admin-1',
  adminEmail: 'admin@turnwrk.com',
  adminPassword: 'admin123456',
  // property + field entities
  propertyId: 'test-property-1',
  propertyName: 'Oceanview Cottage',
  propertyBId: 'test-property-2',
  cleanerId: 'test-cleaner-1',
  cleanerName: 'Maria Garcia',
  technicianId: 'test-technician-1',
  technicianName: 'Sam Fielder',
  technicianEmail: 'sam@example.com',
  technicianPassword: 'tech123456',
  workOrderId: 'test-wo-1',
  // restock
  tokenId: 'test-token-abc123',
  curatedListId: 'test-curated-list-1',
  curatedListSlug: 'comfort-essentials',
  curatedListName: 'Comfort Essentials',
  // clean
  customerId: 'test-customer-1',
  bookingId: 'test-booking-1',
  /** Public booking site slug for clean:booking / wizard E2E. */
  bookingSiteSlug: 'test-clean',
} as const;

// ---- shared entities ----

export function buildOrg(overrides: FirestoreDoc = {}): FirestoreDoc {
  return {
    name: TEST_DATA.orgName,
    enabledApps: { restock: true, hostfixCmms: true, clean: true },
    timezone: 'America/Chicago',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

/**
 * An org-scoped user. `roles: ['owner']` by default → tierFor() -> 'pro'.
 * orgIds/adminOrgIds are derived (never hand-set) so multi-tenant rules that
 * key on `orgId in userDoc.orgIds` stay honest.
 */
export function buildManagerUser(
  args: { uid?: string; email?: string; memberships?: Membership[]; overrides?: FirestoreDoc } = {}
): FirestoreDoc {
  const uid = args.uid ?? TEST_DATA.managerId;
  const email = args.email ?? TEST_DATA.managerEmail;
  const memberships: Membership[] = args.memberships ?? [{ orgId: TEST_DATA.orgId, roles: ['owner'] }];
  const { orgIds, adminOrgIds } = deriveUserIndex(memberships);
  return {
    uid,
    email,
    displayName: 'Test Manager',
    memberships,
    orgIds,
    adminOrgIds,
    subscriptionStatus: 'active',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...args.overrides,
  };
}

/** Cross-org superadmin (no memberships; platformAdmin=true). */
export function buildPlatformAdminUser(overrides: FirestoreDoc = {}): FirestoreDoc {
  return {
    uid: TEST_DATA.adminId,
    email: TEST_DATA.adminEmail,
    displayName: 'Test Admin',
    memberships: [],
    orgIds: [],
    adminOrgIds: [],
    platformAdmin: true,
    subscriptionStatus: null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

export function buildProperty(
  args: { orgId?: string; name?: string; overrides?: FirestoreDoc } = {}
): FirestoreDoc {
  return {
    orgId: args.orgId ?? TEST_DATA.orgId,
    name: args.name ?? TEST_DATA.propertyName,
    address: '123 Ocean Drive, Malibu, CA',
    supply: { beds: 3, baths: 2, amenities: ['kitchen', 'laundry'], supplyTier: 'comfort', supplyPreferences: {} },
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...args.overrides,
  };
}

// ---- restock entities ----

export function buildCategory(id: string, name: string, slug: string, icon: string): FirestoreDoc {
  return { id, name, slug, icon };
}

export function buildProduct(
  args: { id: string; name: string; price: number; source: string; categoryId: string; qualityRating: number; itemType: string; overrides?: FirestoreDoc }
): FirestoreDoc {
  return {
    id: args.id,
    name: args.name,
    price: args.price,
    source: args.source,
    categoryId: args.categoryId,
    qualityRating: args.qualityRating,
    itemType: args.itemType,
    description: '',
    imageUrl: `https://placehold.co/400x400?text=${encodeURIComponent(args.name.slice(0, 20))}`,
    externalUrl: `https://${args.source}.com/dp/${args.id}`,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...args.overrides,
  };
}

export function buildCleaner(overrides: FirestoreDoc = {}): FirestoreDoc {
  return {
    orgId: TEST_DATA.orgId,
    name: TEST_DATA.cleanerName,
    email: 'maria@example.com',
    assignedPropertyIds: [TEST_DATA.propertyId],
    status: 'active',
    invitedAt: FIXED_NOW,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

export function buildResupplyToken(overrides: FirestoreDoc = {}): FirestoreDoc {
  return {
    propertyId: TEST_DATA.propertyId,
    orgId: TEST_DATA.orgId,
    isActive: true,
    createdAt: FIXED_NOW,
    ...overrides,
  };
}

export function buildCuratedList(overrides: FirestoreDoc = {}): FirestoreDoc {
  return {
    name: TEST_DATA.curatedListName,
    slug: TEST_DATA.curatedListSlug,
    description: 'Recommended comfort-tier supply list.',
    tier: 'comfort',
    items: [
      { productId: 'tp-2', quantity: 2 },
      { productId: 'dish-2', quantity: 1 },
    ],
    isPublished: true,
    affiliateTag: 'turnwrk-20',
    createdBy: TEST_DATA.adminId,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

// ---- cmms + clean starter entities ----
// Minimal, schema-plausible scaffolds. Per-app groundwork tickets refine these
// against the real domain types + emulator before their E2E specs depend on them.

/**
 * A cmms_technicians profile. `userId` links it to the signed-in auth user
 * (dataService matches currentTech by `userId===user.uid` or `email===email`),
 * and `isOnboarded:true` + schema/home-base fields clear the OnboardingWizard
 * gate so the technician shell actually renders (completeness check).
 */
export function buildTechnician(overrides: FirestoreDoc = {}): FirestoreDoc {
  return {
    orgId: TEST_DATA.orgId,
    name: TEST_DATA.technicianName,
    email: TEST_DATA.technicianEmail,
    userId: TEST_DATA.technicianId,
    orgIds: [TEST_DATA.orgId],
    status: 'Active',
    isOnboarded: true,
    onboardingSchemaVersion: 1,
    phone: '5551234567',
    skills: ['Plumbing'],
    homeBaseAddress: '123 Main St, Orlando, FL',
    homeBaseGeo: { lat: 28.5, lng: -81.4, geocodedAt: FIXED_NOW },
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

/**
 * The `users/{uid}` doc for the technician. `memberships:[{orgId,roles:['tech']}]`
 * makes legacyRoleFor() resolve to 'tech' → ProtectedRoute allows /technician and
 * the vendor org-scope intersection (users.orgIds ∩ technician.orgIds) is non-empty.
 */
export function buildTechUser(overrides: FirestoreDoc = {}): FirestoreDoc {
  const memberships: Membership[] = [{ orgId: TEST_DATA.orgId, roles: ['tech'] }];
  const { orgIds, adminOrgIds } = deriveUserIndex(memberships);
  return {
    uid: TEST_DATA.technicianId,
    email: TEST_DATA.technicianEmail,
    displayName: TEST_DATA.technicianName,
    memberships,
    orgIds,
    adminOrgIds,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

export function buildWorkOrder(overrides: FirestoreDoc = {}): FirestoreDoc {
  return {
    orgId: TEST_DATA.orgId,
    propertyId: TEST_DATA.propertyId,
    title: 'Leaking faucet in unit 2',
    status: 'Scheduled',
    // Schedule Queue filters on !!scheduledDate; without it the WO lands in
    // Backlog (assigned-but-unscheduled) and visual specs looking at the
    // default queue view see "No scheduled jobs".
    scheduledDate: new Date(FIXED_NOW).toISOString().slice(0, 10),
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

export function buildCustomer(overrides: FirestoreDoc = {}): FirestoreDoc {
  return {
    orgId: TEST_DATA.orgId,
    name: 'Jordan Guest',
    email: 'jordan@example.com',
    phone: '+13105550100',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

export function buildBooking(overrides: FirestoreDoc = {}): FirestoreDoc {
  return {
    orgId: TEST_DATA.orgId,
    customerId: TEST_DATA.customerId,
    propertyId: TEST_DATA.propertyId,
    status: 'scheduled',
    priceMinor: 10000, // $100.00, integer minor units
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

/** Minimal embedded catalog for public booking wizard E2E (clean:booking). */
export function buildCleanCatalog(overrides: FirestoreDoc = {}): FirestoreDoc {
  return {
    orgId: TEST_DATA.orgId,
    services: [
      {
        id: 'svc-standard',
        name: 'Standard Clean',
        description: 'Recurring residential clean',
        basePriceMinor: 15000,
        baseMinutes: 120,
        mode: 'residential',
        active: true,
        params: [
          {
            id: 'bedrooms',
            label: 'Bedrooms',
            unitPriceMinor: 2500,
            unitMinutes: 20,
            min: 1,
            max: 6,
            sort: 0,
          },
        ],
        extraIds: [],
      },
    ],
    extras: [],
    frequencies: [
      { key: 'once', widgetLabel: 'One-time', discountPct: 0 },
      { key: 'weekly', widgetLabel: 'Weekly', discountPct: 25 },
    ],
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

// ---- onboarding (User.onboarding — TURNWRK-195) ----

/**
 * v1 tour + checklist-preference ids from ONBOARDING-FRAMEWORK.md.
 * Seed these as completed so e2e specs never flash a coach-mark overlay.
 * Catalogs (TURNWRK-196) may add more; pass extra ids via
 * `buildFullyOnboardedOnboarding({ tourIds })`.
 */
export const KNOWN_V1_TOUR_IDS: readonly TourId[] = [
  'hostfix:dispatch-orientation',
  'hostfix:create-work-order',
  'hostfix:vendor-orientation',
  'hostfix:vendor-work-order-lifecycle',
  'restock:first-supply-list',
  'restock:invite-cleaner-and-qr',
  'clean:first-booking',
  checklistPreferenceTourId('hostfix'),
  checklistPreferenceTourId('restock'),
  checklistPreferenceTourId('clean'),
];

/**
 * `User.onboarding` map with every known v1 tour marked completed.
 * Spread into user builders: `buildManagerUser({ overrides: { onboarding: buildFullyOnboardedOnboarding() } })`.
 */
export function buildFullyOnboardedOnboarding(
  args: { tourIds?: readonly TourId[]; at?: number; version?: number } = {},
): UserOnboardingState {
  const tourIds = args.tourIds ?? KNOWN_V1_TOUR_IDS;
  const at = args.at ?? FIXED_NOW;
  const version = args.version ?? 1;
  const state: UserOnboardingState = {};
  for (const id of tourIds) {
    state[id] = { completedAt: at, version };
  }
  return state;
}

/** Manager user doc with `onboarding` fully settled (no auto-start tours). */
export function buildFullyOnboardedManagerUser(
  args: { uid?: string; email?: string; memberships?: Membership[]; overrides?: FirestoreDoc } = {},
): FirestoreDoc {
  return buildManagerUser({
    ...args,
    overrides: {
      onboarding: buildFullyOnboardedOnboarding(),
      ...args.overrides,
    },
  });
}

/** Tech `users/{uid}` doc with `onboarding` fully settled. */
export function buildFullyOnboardedTechUser(overrides: FirestoreDoc = {}): FirestoreDoc {
  return buildTechUser({
    onboarding: buildFullyOnboardedOnboarding(),
    ...overrides,
  });
}

// ---- auth users (paired with the firestore user docs above) ----

export function authManager(): AuthUser {
  return { uid: TEST_DATA.managerId, email: TEST_DATA.managerEmail, password: TEST_DATA.managerPassword, displayName: 'Test Manager', emailVerified: true };
}
export function authManagerB(): AuthUser {
  return { uid: TEST_DATA.managerBId, email: TEST_DATA.managerBEmail, password: TEST_DATA.managerBPassword, displayName: 'Test Manager B', emailVerified: true };
}
export function authPlatformAdmin(): AuthUser {
  return { uid: TEST_DATA.adminId, email: TEST_DATA.adminEmail, password: TEST_DATA.adminPassword, displayName: 'Test Admin', emailVerified: true };
}
export function authTechnician(): AuthUser {
  return { uid: TEST_DATA.technicianId, email: TEST_DATA.technicianEmail, password: TEST_DATA.technicianPassword, displayName: TEST_DATA.technicianName, emailVerified: true };
}
