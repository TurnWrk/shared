export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoCache extends GeoPoint {
  geocodedAt: number;
}

export interface PropertyAsset {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  serial?: string;
  location?: string;
}

export interface StorageLocation {
  location: string;
  imageUrl?: string;
  /** Staff-only; guests must not access (SOP-08 owner-closet rules). */
  staffOnly?: boolean;
  accessRestrictionNote?: string;
}

/**
 * SOP-13 roster status. Defaults to `active` when absent so legacy properties
 * behave as today.
 */
export type PropertyLifecycleStatus =
  | 'active'
  | 'onboarding'
  | 'churned'
  | 'out_of_scope'
  | 'access_blocked';

export type AccessCredentialKind =
  | 'gate'
  | 'door'
  | 'lockbox'
  | 'garage'
  | 'parking'
  | 'owner_closet'
  | 'wifi';

export type AccessVerifyCadence = 'turnover' | 'monthly';

/**
 * SOP-03 access registry row — one credential per lock/code per unit.
 */
export interface AccessCredential {
  id: string;
  kind: AccessCredentialKind;
  label?: string;
  value: string;
  /** Where the code/key lives (lockbox position, app name, open sequence). */
  storageLocation?: string;
  lastVerifiedAt?: number;
  verifyCadence?: AccessVerifyCadence;
  /** Owner can change without notice — verify every turnover. */
  ownerControlled?: boolean;
}

export type PestRiskTier = 'none' | 'watch' | 'active' | 'closed';

export interface PestTreatmentRecord {
  id: string;
  treatedAt: number;
  vendorName?: string;
  products?: string;
  notes?: string;
  /** Block bookings until this unix-ms (SOP-07 re-entry window). */
  reEntryAllowedAt?: number;
}

/**
 * SOP-08 linen sets per property — in-unit / laundry / in-transit.
 */
export interface LinenInventory {
  setsInUnit?: number;
  setsAtLaundry?: number;
  setsInTransit?: number;
  /** Target sets = 2× max occupancy per SOP-08. */
  parSets?: number;
  lastCountedAt?: number;
}

/**
 * SOP-08 per-market laundry vendor + run sheet entry.
 */
export interface LaundryRunEntry {
  propertyId: string;
  linenSets?: number;
  notes?: string;
}

export interface LaundryVendorConfig {
  id: string;
  name: string;
  market?: string;
  costPerLb?: number;
  /** Properties on this vendor's pickup/dropoff run. */
  runSheet?: LaundryRunEntry[];
}

/**
 * Par level for a property × catalog itemType or product.
 */
export interface PropertyParLevel {
  itemType?: string;
  productId?: string;
  parQuantity: number;
}

/**
 * A permanent, must-know characteristic of a property (reverse taps, sticky gate,
 * pest hot-spots). Mirrors the akita knowledge-base `quirks` shape so field research
 * can seed these. `tags` loosely categorize (e.g. 'plumbing' | 'access' | 'pests').
 */
export interface PropertyQuirk {
  id: string;
  title: string;
  detail?: string;
  tags?: string[];
  lastVerifiedAt?: number;
  /** External KB issue id (e.g. `lyons-i3`) for import dedupe. */
  kbIssueId?: string;
  /** Chronically failing system — triggers root-cause escalation (SOP-04). */
  recurringFailure?: boolean;
  /** Marked permanent from an inspection finding. */
  fromInspection?: boolean;
}

/** A property-specific question vendors/guests recurrently ask (hot-tub operation, etc.). */
export interface PropertyFAQ {
  id: string;
  question: string;
  answer: string;
  lastVerifiedAt?: number;
}

export interface PropertyMaintenance {
  accessCode?: string;
  wifiSsid?: string;
  wifiPass?: string;
  checkInTime?: string;
  checkOutTime?: string;
  imageUrl?: string;
  coverPicture?: string;

  emergency?: {
    breakerLocation?: string;
    breakerImage?: string;
    waterShutoffLocation?: string;
    waterShutoffImage?: string;
    gasShutoffLocation?: string;
    gasShutoffImage?: string;
    /** Unix-ms — when the emergency shutoff info was last confirmed on-site. */
    verifiedAt?: number;
  };

  /**
   * @deprecated Use the property's compliance items (`cmms_complianceItems`,
   * TURNWRK-718): smoke alarms (`fl.smoke_alarms`), CO alarm (`fl.co_alarm`), the
   * extinguisher service tag (`fl.fire_extinguisher_service`) and the first aid
   * kit (`turnwrk.first_aid_kit`). Nothing writes it any more; kept as a
   * read-only fallback until dispatch's `backfill-safety-to-compliance` script
   * has been applied (TURNWRK-723). New code reads and writes compliance items.
   */
  safetyEquipment?: {
    fireExtinguisherExpiry?: string;
    firstAidKitVerified?: boolean;
    smokeDetectorsVerified?: boolean;
    coDetectorVerified?: boolean;
    lastSafetyInspection?: number;
  };

  profile?: {
    wifiSpeed?: number;
    lastWifiTest?: number;
    spareKeyVerified?: boolean;
    doorbellWorking?: boolean;
  };

  ownerStorage?: StorageLocation;
  cleaningStorage?: StorageLocation;
  assets?: PropertyAsset[];

  /** SOP-03 structured access registry (replaces ad-hoc accessCode over time). */
  accessCredentials?: AccessCredential[];

  /** Property knowledge base — permanent quirks + recurring FAQs (akita-seeded or ops-entered). */
  quirks?: PropertyQuirk[];
  faqs?: PropertyFAQ[];
  /** Unix-ms — when the lockbox/access code was last confirmed on-site. */
  accessVerifiedAt?: number;

  /** SOP-07 pest protocol. */
  pestRiskTier?: PestRiskTier;
  pestTreatments?: PestTreatmentRecord[];

  /**
   * Operator-confirmed guest/clean booking block after repeated WO failures
   * (TURNWRK-37). Unix-ms; active while `> Date.now()`.
   */
  bookingsBlockedUntil?: number;
  /** Short reason shown on dispatch + clean availability. */
  bookingBlockReason?: string;

  /** When set, occupancy is derived from synced bookings (see `usesSyncedBookings`). */
  bookingSource?: 'external-sync' | 'akita' | 'airbnb' | 'vrbo' | 'ics-sync' | null;
  /** Owner name snapshot from an external integration (replaces legacy `akitaOwnerName`). */
  integrationOwnerName?: string;
  /** Owner phone snapshot from an external integration (replaces legacy `akitaOwnerPhone`). */
  integrationOwnerPhone?: string;
  /** External system's property label (replaces legacy `akitaPropertyName`). */
  externalPropertyName?: string;
  /** @deprecated Use `integrationOwnerName`. Legacy Akita snapshot field. */
  akitaOwnerName?: string;
  /** @deprecated Use `integrationOwnerPhone`. Legacy Akita snapshot field. */
  akitaOwnerPhone?: string;
  /** @deprecated Use `externalPropertyName`. Legacy Akita snapshot field. */
  akitaPropertyName?: string;
  mercuryRecipientId?: string | null;
  mercuryRecipientEmail?: string | null;
}

/**
 * Amenity classes a property can carry (`PropertySupply.amenities`).
 *
 * Widened 2026-09-04 (TURNWRK-630) from the original seven so the maintenance
 * plan catalog (`src/maintenance`) can read them: each class below is one the
 * catalog knows how to inspect per turn, maintain preventively, or route to a
 * trade. The original seven keep their exact spelling. Map free-text labels
 * (an Airbnb amenity list, an operator's notes) through `normalizeAmenity`
 * rather than widening this union ad hoc: an unknown class is data the plan
 * cannot price.
 */
export type PropertyAmenity =
  // the original seven
  | 'kitchen'
  | 'laundry'
  | 'pool'
  | 'hot-tub'
  | 'outdoor-grill'
  | 'fireplace'
  | 'gym'
  // water
  | 'heated-pool'
  | 'screened-lanai'
  | 'sauna'
  | 'cold-plunge'
  | 'boat-dock'
  | 'watercraft'
  // play
  | 'pickleball-court'
  | 'sport-court'
  | 'basketball-hoop'
  | 'putting-green'
  | 'game-room'
  | 'arcade'
  | 'yard-games'
  | 'playground'
  | 'trampoline'
  | 'bikes'
  | 'golf-cart'
  // outdoor living
  | 'outdoor-bar'
  | 'fire-pit'
  | 'outdoor-furniture'
  | 'beach-gear'
  | 'yard'
  // systems
  | 'hvac'
  | 'ceiling-fan'
  | 'water-heater'
  | 'ev-charger'
  | 'generator'
  | 'elevator'
  | 'access-hardware'
  | 'security-camera'
  | 'noise-monitor'
  | 'safety-equipment'
  // interior
  | 'bathtub'
  | 'tv'
  | 'wifi'
  | 'dedicated-workspace'
  | 'family-kit';

export type SupplyTier = 'basics' | 'comfort' | 'luxe';

/**
 * Controls the UX mode vendors see when they scan the property QR code.
 * - `full_checklist`: guided 4-step flow (notes → consumables checklist → storage photos → review)
 * - `speedy_complete`: single-page quick-submit (notes + quick item chips + submit)
 *
 * Defaults to `full_checklist` when unset so existing properties are unaffected.
 * Operators onboard vendors on `full_checklist` and migrate to `speedy_complete` once
 * vendors are comfortable with the catalog.
 */
export type InspectMode = 'full_checklist' | 'speedy_complete';

export interface PropertySupply {
  beds?: number;
  baths?: number;
  amenities?: PropertyAmenity[];
  supplyTier?: SupplyTier;
  curatedListId?: string; // FK → restock_curatedLists; the PM's chosen preset
  supplyPreferences?: Record<string, string>; // itemType -> productId (advanced per-item overrides)
  hiddenItemTypes?: string[]; // itemTypes hidden from the inspect view for this property
  /** Inspect QR mode. Defaults to 'full_checklist' when absent. */
  inspectMode?: InspectMode;
  /** SOP-08 par levels per itemType/product. */
  parLevels?: PropertyParLevel[];
  /** SOP-08 linen inventory. */
  linenInventory?: LinenInventory;
  /** Unit has no secure on-site closet — route to direct-shipped survival kit. */
  noOwnerCloset?: boolean;
  /**
   * FK → restock_survivalKits. The kit a cleaner carries or receives for this
   * unit (TURNWRK-33). Only meaningful with `noOwnerCloset`; a property with a
   * closet is stocked, not kitted.
   */
  survivalKitId?: string;
  /** Primary cleaning vendor id for linen lock (SOP-02). */
  primaryCleanerId?: string;
}

export type PropertyKind = 'str_unit' | 'residence';

/** Structured address parts (Turnwrk Clean wizard writes these; `address` stays the formatted string). */
export interface PropertyAddressParts {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

/**
 * Facts the jurisdiction compliance rules (`src/compliance/jurisdictions`)
 * read to decide which obligations apply to a unit (TURNWRK-718). Absent
 * fields mean "unknown", and a rule gated on one does not apply until the
 * operator answers it.
 */
export interface PropertyCompliance {
  /** County name as the state writes it ("Pinellas"), for county TDT and DBPR matching. */
  county?: string;
  /** Habitable stories in the building; Florida balcony certification starts at 3. */
  stories?: number;
  /** Any gas, oil or wood appliance, fireplace or attached garage: gates the CO alarm rule. */
  fuelBurningAppliance?: boolean;
  /** Homeowners or condo association, when the unit sits under one. */
  hoaName?: string;
}

export interface Property {
  id: string;
  orgId: string;
  address: string;
  /** Structured decomposition of `address` when known (Clean bookings require it). */
  addressParts?: PropertyAddressParts;
  /**
   * Service-location kind. Absent = 'str_unit' (backward compatible).
   * 'residence' = a Clean customer's home; occupancy semantics don't apply —
   * "customer home / not home" lives on the booking instead.
   */
  kind?: PropertyKind;
  /** Clean customer this residence belongs to (clean_customers doc id). */
  customerId?: string;
  name?: string;
  ownerId?: string;
  geo?: GeoCache;

  /**
   * SOP-13 scope roster. Absent = `active` (see `getPropertyLifecycleStatus`).
   */
  lifecycleStatus?: PropertyLifecycleStatus;

  // occupancy (shared signal; dispatch writes, restock reads)
  isOccupied?: boolean;
  currentGuestName?: string;
  /** Last on-site occupancy/readiness confirmation (SOP field SMS). */
  occupancyConfirmedAt?: number;
  occupancyConfirmedBy?: string;

  maintenance?: PropertyMaintenance;
  supply?: PropertySupply;
  compliance?: PropertyCompliance;

  createdAt: number;
  updatedAt: number;
}

/** Effective lifecycle status — treats unset as active for backward compatibility. */
export function getPropertyLifecycleStatus(
  property: Pick<Property, 'lifecycleStatus'>,
): PropertyLifecycleStatus {
  return property.lifecycleStatus ?? 'active';
}

export function isPropertyDispatchable(
  property: Pick<Property, 'lifecycleStatus'>,
): boolean {
  return getPropertyLifecycleStatus(property) === 'active';
}
