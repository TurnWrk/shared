import type { StorageLocation } from './types/property';

/** Restock storage purposes that map onto hostfix maintenance slots. */
export type StoragePurposeSlot = 'owner' | 'cleaning';

/**
 * Minimal shape of a `restock_storage` doc for dual-read / backfill.
 * Keep framework-agnostic (no Firestore Timestamp types).
 */
export interface RestockStorageRow {
  purpose?: string | null;
  locationDescription?: string | null;
  imageUrl?: string | null;
  accessNote?: string | null;
  isActive?: boolean | null;
  /** Epoch ms, Date, or Firestore-like `{ seconds }` — used only for pick order. */
  updatedAt?: unknown;
}

function updatedAtMillis(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object') {
    const v = value as { seconds?: number; toMillis?: () => number };
    if (typeof v.toMillis === 'function') {
      try {
        return v.toMillis();
      } catch {
        /* ignore */
      }
    }
    if (typeof v.seconds === 'number') return v.seconds * 1000;
  }
  return 0;
}

/** Map a restock storage row into the descriptive hostfix `StorageLocation`. */
export function storageLocationFromRestockRow(
  row: RestockStorageRow | null | undefined,
): StorageLocation | null {
  if (!row || row.isActive === false) return null;
  const location = (row.locationDescription || '').trim();
  const imageUrl = (row.imageUrl || '').trim() || undefined;
  const accessNote = (row.accessNote || '').trim() || undefined;
  if (!location && !imageUrl) return null;
  return {
    location: location || 'Not specified',
    ...(imageUrl ? { imageUrl } : {}),
    ...(accessNote ? { accessRestrictionNote: accessNote } : {}),
  };
}

/**
 * Prefer the newest active restock_storage row for `purpose`.
 * Returns null when no matching canonical row exists (caller falls back).
 */
export function pickRestockStorageForPurpose(
  rows: RestockStorageRow[] | null | undefined,
  purpose: StoragePurposeSlot,
): StorageLocation | null {
  if (!rows?.length) return null;
  let best: RestockStorageRow | null = null;
  let bestMs = -1;
  for (const row of rows) {
    if (row.purpose !== purpose) continue;
    if (row.isActive === false) continue;
    const ms = updatedAtMillis(row.updatedAt);
    if (!best || ms >= bestMs) {
      best = row;
      bestMs = ms;
    }
  }
  return storageLocationFromRestockRow(best);
}

export interface PropertyStorageSlots {
  ownerStorage?: StorageLocation;
  cleaningStorage?: StorageLocation;
}

/**
 * Dual-read: prefer `restock_storage` (canonical) for owner/cleaning slots,
 * fall back to legacy `property.maintenance.ownerStorage` / `cleaningStorage`
 * so hostfix UIs keep working before / during backfill (TURNWRK-81).
 */
export function resolvePropertyStorageSlots(input: {
  maintenance?: PropertyStorageSlots | null;
  restockRows?: RestockStorageRow[] | null;
}): PropertyStorageSlots {
  const owner =
    pickRestockStorageForPurpose(input.restockRows, 'owner') ??
    input.maintenance?.ownerStorage;
  const cleaning =
    pickRestockStorageForPurpose(input.restockRows, 'cleaning') ??
    input.maintenance?.cleaningStorage;
  return {
    ...(owner ? { ownerStorage: owner } : {}),
    ...(cleaning ? { cleaningStorage: cleaning } : {}),
  };
}

/**
 * Merge resolved slots onto a property's `maintenance` object without
 * dropping unrelated maintenance fields.
 */
export function applyResolvedStorageToMaintenance<
  T extends { maintenance?: (PropertyStorageSlots & Record<string, unknown>) | null },
>(property: T, restockRows?: RestockStorageRow[] | null): T {
  const slots = resolvePropertyStorageSlots({
    maintenance: property.maintenance ?? undefined,
    restockRows,
  });
  if (!slots.ownerStorage && !slots.cleaningStorage) return property;
  const maintenance = {
    ...(property.maintenance ?? {}),
    ...slots,
  };
  return { ...property, maintenance };
}
