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

export interface PropertySupply {
  beds?: number;
  baths?: number;
  amenities?: PropertyAmenity[];
  supplyTier?: SupplyTier;
  curatedListId?: string; // FK → restock_curatedLists; the PM's chosen preset
  supplyPreferences?: Record<string, string>; // itemType -> productId (advanced per-item overrides)
  hiddenItemTypes?: string[]; // itemTypes hidden from the inspect view for this property
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
