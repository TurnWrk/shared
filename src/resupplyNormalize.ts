import type { ResupplyItem, ResupplyStatus } from './types/resupply';

const CANONICAL_STATUSES: readonly ResupplyStatus[] = [
  'pending',
  'approved',
  'ordered',
  'fulfilled',
  'rejected',
] as const;

/**
 * Map legacy Restock statuses onto the unified shared schema.
 * `reviewed` → `approved`, `completed` → `fulfilled`.
 */
export function normalizeResupplyStatus(raw: unknown): ResupplyStatus {
  if (raw === 'reviewed') return 'approved';
  if (raw === 'completed') return 'fulfilled';
  if (typeof raw === 'string' && (CANONICAL_STATUSES as readonly string[]).includes(raw)) {
    return raw as ResupplyStatus;
  }
  return 'pending';
}

/**
 * Prefer explicit `itemTypes[]`; otherwise project from CMMS-style `items[]`
 * (`itemType` or free-text `name`) so Restock UI and Hostfix stay aligned.
 */
export function projectResupplyItemTypes(
  itemTypes: unknown,
  items: unknown,
): string[] {
  if (Array.isArray(itemTypes) && itemTypes.length > 0) {
    return itemTypes.filter((s): s is string => typeof s === 'string' && s.length > 0);
  }
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => {
      if (!it || typeof it !== 'object') return '';
      const row = it as { itemType?: unknown; name?: unknown };
      if (typeof row.itemType === 'string' && row.itemType.length > 0) return row.itemType;
      if (typeof row.name === 'string' && row.name.length > 0) return row.name;
      return '';
    })
    .filter((s) => s.length > 0);
}

/**
 * When Restock writes `itemTypes` only, project into canonical `items[]`
 * so Hostfix (which renders from items) sees the same request.
 */
export function projectResupplyItemsFromItemTypes(
  itemTypes: string[],
  existingItems?: ResupplyItem[] | null,
): ResupplyItem[] {
  if (Array.isArray(existingItems) && existingItems.length > 0) return existingItems;
  return itemTypes.map((slug) => ({ itemType: slug, quantity: 1 }));
}

export interface NormalizedResupplyShape {
  status: ResupplyStatus;
  itemTypes: string[];
  items: ResupplyItem[];
}

/** Shared read-path normalizer for resupply docs (TURNWRK-76). */
export function normalizeResupplyDoc(data: {
  status?: unknown;
  itemTypes?: unknown;
  items?: unknown;
}): NormalizedResupplyShape {
  const status = normalizeResupplyStatus(data.status);
  const rawItems = Array.isArray(data.items) ? (data.items as ResupplyItem[]) : [];
  const itemTypes = projectResupplyItemTypes(data.itemTypes, rawItems);
  const items = projectResupplyItemsFromItemTypes(itemTypes, rawItems);
  return { status, itemTypes, items };
}
