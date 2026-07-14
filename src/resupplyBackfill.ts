import type { ResupplyItem } from './types/resupply';
import {
  normalizeResupplyDoc,
  normalizeResupplyStatus,
  projectResupplyItemsFromItemTypes,
} from './resupplyNormalize';

/** Loose legacy Restock property-resupply doc (pre-canonical collection). */
export interface LegacyPropertyResupplyDoc {
  orgId?: string;
  propertyId?: string;
  tokenId?: string;
  cleanerId?: string;
  cleanerName?: string;
  itemTypes?: string[];
  items?: unknown;
  status?: unknown;
  notes?: string;
  notesImageUrls?: string[];
  storagePhotos?: Array<{ storageId: string; storageName: string; imageUrls: string[] }>;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CanonicalResupplyWriteShape {
  orgId: string;
  propertyId: string;
  status: string;
  source: 'restock-app';
  vendorType: 'cleaning';
  items: ResupplyItem[];
  itemTypes: string[];
  createdAt: number;
  updatedAt: number;
  tokenId?: string;
  cleanerId?: string;
  cleanerName?: string;
  notes?: string;
  notesImageUrls?: string[];
  storagePhotos?: Array<{ storageId: string; storageName: string; imageUrls: string[] }>;
}

/**
 * Convert a Firestore Timestamp-like / Date / number into epoch ms.
 * Pure helper for backfill scripts (no firebase-admin import).
 */
export function resupplyTimestampToMillis(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v instanceof Date) return v.getTime();
  if (v && typeof v === 'object') {
    const obj = v as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
    if (typeof obj.toMillis === 'function') {
      try {
        return obj.toMillis();
      } catch {
        /* fall through */
      }
    }
    if (typeof obj.seconds === 'number') {
      return obj.seconds * 1000 + Math.floor((obj.nanoseconds ?? 0) / 1e6);
    }
  }
  return fallback;
}

/**
 * Pure transform: legacy `restock_propertyResupplyRequests` row → canonical
 * `resupplyRequests` write shape (TURNWRK-74). Uses shared status/items
 * normalizers so old-doc read and new-doc write stay aligned.
 */
export function legacyPropertyResupplyToCanonical(
  doc: LegacyPropertyResupplyDoc,
  now = Date.now(),
): CanonicalResupplyWriteShape | null {
  if (!doc.orgId || !doc.propertyId) return null;

  const normalized = normalizeResupplyDoc({
    status: doc.status,
    itemTypes: doc.itemTypes,
    items: doc.items,
  });
  // Prefer itemTypes projection when legacy only had slugs (typical Restock).
  const itemTypes =
    Array.isArray(doc.itemTypes) && doc.itemTypes.length > 0
      ? doc.itemTypes.filter((s): s is string => typeof s === 'string' && s.length > 0)
      : normalized.itemTypes;
  const items = projectResupplyItemsFromItemTypes(itemTypes, normalized.items);
  const createdAt = resupplyTimestampToMillis(doc.createdAt, now);
  const updatedAt = resupplyTimestampToMillis(doc.updatedAt, createdAt);

  const canonical: CanonicalResupplyWriteShape = {
    orgId: doc.orgId,
    propertyId: doc.propertyId,
    status: normalizeResupplyStatus(doc.status),
    source: 'restock-app',
    vendorType: 'cleaning',
    items,
    itemTypes,
    createdAt,
    updatedAt,
  };
  if (doc.tokenId) canonical.tokenId = doc.tokenId;
  if (doc.cleanerId) canonical.cleanerId = doc.cleanerId;
  if (doc.cleanerName) canonical.cleanerName = doc.cleanerName;
  if (doc.notes) canonical.notes = doc.notes;
  if (doc.notesImageUrls?.length) canonical.notesImageUrls = doc.notesImageUrls;
  if (doc.storagePhotos?.length) canonical.storagePhotos = doc.storagePhotos;
  return canonical;
}
