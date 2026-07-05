/**
 * Provider-agnostic integration contracts for external property systems.
 * Concrete provider implementations (historically Akita) live outside active
 * apps under `_archived/integrations/` until a new provider is wired in.
 */

/** Known booking-sync providers. Extend with string for future vendors. */
export type BookingSource =
  | 'external-sync'
  | 'akita'
  | 'airbnb'
  | 'vrbo'
  | 'ics-sync'
  | null;

export type PropertyMappingStatus = 'mapped' | 'unmapped' | 'ignored';

/**
 * Maps an external system's property identifier to a CMMS property document.
 * Firestore docs may still carry legacy `akitaName`; readers should use
 * `resolvePropertyMappingExternalName`.
 */
export interface PropertyMapping {
  id: string;
  orgId?: string;
  /** Integration provider id, e.g. `external-sync` or a vendor slug. */
  provider: string;
  /** Human-readable property name in the external system. */
  externalName: string;
  /** Stable external id when the provider exposes one. */
  externalId?: string | null;
  cmmsPropertyId: string | null;
  status: PropertyMappingStatus;
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number;
}

export interface ExternalPropertyIngest {
  provider: string;
  names: string[];
  ingestedAt: string;
}

export interface ExternalPropertyProfile {
  externalPropertyId?: string;
  externalPropertyName: string;
  ownerName?: string;
  ownerPhone?: string;
  lockCode?: string;
}

export interface ExternalBookingRange {
  externalPropertyId?: string;
  externalPropertyName: string;
  checkIn: string;
  checkOut: string;
  guestName?: string;
}

export interface ExternalWorkOrderSnapshot {
  externalWorkOrderId: string;
  externalPropertyName: string;
  title: string;
  category: string;
  urgency: string;
  status: string;
  daysOpen: number;
}

/**
 * Contract for a future property/booking integration provider.
 * Implementations fetch external data; mapping + persistence stay in CMMS.
 */
export interface PropertyIntegrationProvider {
  readonly providerId: string;
  listPropertyNames(): Promise<string[]>;
  listPropertyProfiles(): Promise<ExternalPropertyProfile[]>;
  crawlBookings(): Promise<{
    bookings: ExternalBookingRange[];
    dateRange: { start: string; end: string };
    partialReservations?: number;
    monthsScanned?: string[];
  }>;
  crawlWorkOrders?(): Promise<ExternalWorkOrderSnapshot[]>;
  updateWorkOrderStatus?(
    externalWorkOrderId: string,
    status: string,
    photoUrls?: string[],
    notes?: string
  ): Promise<boolean>;
}

/** Read external name from a mapping doc (legacy `akitaName` fallback). */
export function resolvePropertyMappingExternalName(
  mapping: Pick<PropertyMapping, 'externalName'> & { akitaName?: string }
): string {
  const name = mapping.externalName || mapping.akitaName || '';
  return name.trim();
}

/** Normalize a property name for mapping lookup keys. */
export function normalizePropertyMappingKey(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.toLowerCase().trim();
}

/** Strip punctuation for fuzzy mapping matches. */
export function canonicalizePropertyMappingKey(value: unknown): string {
  const normalized = normalizePropertyMappingKey(value);
  if (!normalized) return '';
  return normalized.replace(/[^a-z0-9]/g, '');
}

/** True when occupancy should be derived from synced bookings, not manual toggle. */
export function usesSyncedBookings(bookingSource?: BookingSource | string | null): boolean {
  return !!bookingSource && bookingSource !== 'manual';
}

/** Owner/contact snapshots synced from an external provider (legacy field fallback). */
export function getIntegrationOwnerSnapshot(
  maintenance?: {
    integrationOwnerName?: string;
    integrationOwnerPhone?: string;
    externalPropertyName?: string;
    akitaOwnerName?: string;
    akitaOwnerPhone?: string;
    akitaPropertyName?: string;
  } | null
): { name?: string; phone?: string; externalPropertyName?: string } {
  if (!maintenance) return {};
  return {
    name: maintenance.integrationOwnerName?.trim() || maintenance.akitaOwnerName?.trim(),
    phone: maintenance.integrationOwnerPhone?.trim() || maintenance.akitaOwnerPhone?.trim(),
    externalPropertyName:
      maintenance.externalPropertyName?.trim() || maintenance.akitaPropertyName?.trim(),
  };
}
