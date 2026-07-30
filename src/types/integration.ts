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

export type OwnerMappingStatus =
  | 'mapped'
  | 'unmapped'
  | 'ignored'
  | 'external-deleted';

/**
 * Maps an external CRM record (Twenty `people`/`companies`/custom object) to a
 * CMMS {@link Owner}. Modelled on {@link PropertyMapping}: the vendor identity
 * lives here, not bolted onto the Owner. Server-write only (Admin SDK) —
 * created and reconciled by the Twenty sync (inbound webhook + cortex cron).
 *
 * The document id is deterministic — `ownermap_{orgId}_{externalId}`, see
 * {@link ownerMappingDocId} — so webhook, reconcile, and backfill all converge
 * on the same doc instead of racing to create duplicates. `orgId` is required
 * (unlike PropertyMapping's optional one) because the doc id encodes it.
 */
export interface OwnerMapping {
  id: string;
  orgId: string;
  /** Integration provider id, e.g. `twenty`. */
  provider: string;
  /** Twenty object slug the record came from (`people`, `companies`, custom). */
  externalObjectSlug: string;
  /** Stable record id in the external system (part of the deterministic id). */
  externalId: string;
  /** Human-readable name in the external system, for admin display/search. */
  externalName: string;
  /** Linked CMMS owner doc id; null while unmapped/ignored/external-deleted. */
  ownerId: string | null;
  status: OwnerMappingStatus;
  /** Hash of the last applied field set — the apply-side idempotency guard. */
  lastAppliedHash?: string;
  /** External record's last-updated time (epoch ms), for reconcile ordering. */
  externalUpdatedAt?: number;
  /** Which pass last wrote this row, e.g. `webhook` | `reconcile` | `backfill`. */
  lastSyncSource?: string;
  /** Last sync error message, cleared on the next clean pass. */
  lastSyncError?: string;
  /** When the external record was observed deleted (epoch ms). */
  externalDeletedAt?: number;
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number;
}

/**
 * Deterministic document id for an {@link OwnerMapping}. This id IS the
 * idempotency key: the same `(orgId, externalId)` always resolves to the same
 * doc, so the webhook, the reconcile cron, and the backfill converge instead
 * of creating duplicate mappings.
 */
export function ownerMappingDocId(orgId: string, externalId: string): string {
  return `ownermap_${orgId}_${externalId}`;
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

/**
 * True only for PMS-style providers that own the property's calendar end-to-end
 * (`akita`, `external-sync`). Self-managed ICS feed sources (`airbnb`, `vrbo`,
 * `ics-sync`) return false: they import availability but the operator still adds
 * and manages the feeds in-app, so the Calendar Feeds UI must stay unlocked.
 * Distinct from `usesSyncedBookings`, which is true for any non-manual source and
 * is the right check for occupancy derivation.
 */
export function isExternallyManagedBookingSource(
  bookingSource?: BookingSource | string | null,
): boolean {
  return bookingSource === 'akita' || bookingSource === 'external-sync';
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
