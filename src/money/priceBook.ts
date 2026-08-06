/**
 * Trade price book — saved line items reusable on estimates and invoices
 * (TURNWRK-287 / P2.3). Same `lineType` keys as the AI Estimator RateSource
 * (TURNWRK-274) so the price book is not a second rate store.
 */
export const PRICE_BOOK_UNITS = [
  'hour',
  'each',
  'linear-foot',
  'square-foot',
  'cubic-yard',
  'gallon',
  'day',
] as const;

export type PriceBookUnit = (typeof PRICE_BOOK_UNITS)[number];

export type PriceBookItemKind = 'labor' | 'material';

/** Persisted org-scoped saved line item (`cmms_priceBookItems`). */
export interface PriceBookItem {
  id: string;
  orgId: string;
  /** Normalized rate key, e.g. `labor:plumbing`. */
  lineType: string;
  kind: PriceBookItemKind;
  label: string;
  unit: PriceBookUnit;
  /** Integer minor units (USD cents). */
  unitMinor: number;
  active?: boolean;
  sortOrder?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PriceBookItemInput {
  id?: string;
  kind: PriceBookItemKind;
  label: string;
  unit?: PriceBookUnit;
  unitMinor: number;
  lineType?: string;
  active?: boolean;
  sortOrder?: number;
}

const SLUG_RE = /[^a-z0-9]+/g;

/** Build a stable `lineType` slug from kind + label. */
export function slugifyPriceBookLineType(kind: PriceBookItemKind, label: string): string {
  const slug = label.trim().toLowerCase().replace(SLUG_RE, '-').replace(/^-+|-+$/g, '');
  return `${kind}:${slug || 'item'}`;
}

function isPriceBookUnit(v: unknown): v is PriceBookUnit {
  return typeof v === 'string' && (PRICE_BOOK_UNITS as readonly string[]).includes(v);
}

/** Default unit by kind — labor is hourly, materials are per-each. */
export function defaultPriceBookUnit(kind: PriceBookItemKind): PriceBookUnit {
  return kind === 'labor' ? 'hour' : 'each';
}

/**
 * Validate and normalize a price-book write. Returns null when the row is
 * unusable (empty label, bad cents, unknown kind).
 */
export function normalizePriceBookItemInput(
  orgId: string,
  input: PriceBookItemInput,
  now: number,
  index = 0,
): Omit<PriceBookItem, 'id'> & { id?: string } | null {
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  if (!label) return null;
  if (input.kind !== 'labor' && input.kind !== 'material') return null;
  if (!Number.isInteger(input.unitMinor) || input.unitMinor < 0) return null;

  const lineType =
    typeof input.lineType === 'string' && input.lineType.trim()
      ? input.lineType.trim()
      : slugifyPriceBookLineType(input.kind, label);
  const unit = isPriceBookUnit(input.unit) ? input.unit : defaultPriceBookUnit(input.kind);

  const row: Omit<PriceBookItem, 'id'> & { id?: string } = {
    orgId,
    lineType,
    kind: input.kind,
    label,
    unit,
    unitMinor: input.unitMinor,
    createdAt: now,
    updatedAt: now,
  };
  if (typeof input.id === 'string' && input.id.trim()) row.id = input.id.trim();
  if (input.active === false) row.active = false;
  if (typeof input.sortOrder === 'number' && Number.isFinite(input.sortOrder)) {
    row.sortOrder = Math.trunc(input.sortOrder);
  } else {
    row.sortOrder = index;
  }
  return row;
}
