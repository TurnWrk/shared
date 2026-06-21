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

  /** Property knowledge base — permanent quirks + recurring FAQs (akita-seeded or ops-entered). */
  quirks?: PropertyQuirk[];
  faqs?: PropertyFAQ[];
  /** Unix-ms — when the lockbox/access code was last confirmed on-site. */
  accessVerifiedAt?: number;

  bookingSource?: 'akita' | 'airbnb' | 'vrbo' | 'ics-sync' | null;
  mercuryRecipientId?: string | null;
  mercuryRecipientEmail?: string | null;
}

export type PropertyAmenity =
  | 'kitchen'
  | 'laundry'
  | 'pool'
  | 'hot-tub'
  | 'outdoor-grill'
  | 'fireplace'
  | 'gym';

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
}

export interface Property {
  id: string;
  orgId: string;
  address: string;
  name?: string;
  ownerId?: string;
  geo?: GeoCache;

  // occupancy (shared signal; hostfix-cmms writes, restock reads)
  isOccupied?: boolean;
  currentGuestName?: string;

  maintenance?: PropertyMaintenance;
  supply?: PropertySupply;

  createdAt: number;
  updatedAt: number;
}
