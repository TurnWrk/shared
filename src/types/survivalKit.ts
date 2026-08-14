/**
 * The cleaner survival kit (TURNWRK-33).
 *
 * A named, small list of supplies a cleaner carries or receives direct-shipped,
 * for units that have no secure on-site closet to stock. It is deliberately NOT
 * the same primitive as full closet stocking:
 *
 *   - `restock_curatedLists` are platform-authored, published presets for PM
 *     tier stocking of a whole property. Global, admin-written, tier-shaped.
 *   - A survival kit is an operator's own short list, org-scoped, attached to
 *     the properties where `PropertySupply.noOwnerCloset` is set.
 *
 * MVP scope, per the 2026-08-05 approval: a name and a list of lines. No par
 * levels, no automatic replenishment, and no routing — how a kit gets restocked
 * is a separate slice. The kit is a description of what should be in the
 * cleaner's hands, and the clean booking card reads it so the cleaner can see
 * it instead of the empty supply list they get today.
 */

/** One line of a kit: what, and how many. */
export interface SurvivalKitLine {
  /** FK → restock_products when the operator picked a catalog product. */
  productId?: string;
  /** Catalog item type (`toilet_paper`, `trash_bags`, …) when there is one. */
  itemType?: string;
  /** What the cleaner should see. Required — a line with no name is unreadable. */
  name: string;
  quantity: number;
}

export interface SurvivalKit {
  id: string;
  /** Owning org. Kits are never global; two operators' kits never mix. */
  orgId: string;
  name: string;
  description?: string;
  lines: SurvivalKitLine[];
  /** Unix ms. */
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
}

export type SurvivalKitInput = Omit<SurvivalKit, 'id' | 'createdAt' | 'updatedAt'>;

/** A line the UI can render: named, positive quantity. */
export function isValidSurvivalKitLine(line: unknown): line is SurvivalKitLine {
  if (!line || typeof line !== 'object') return false;
  const l = line as Partial<SurvivalKitLine>;
  if (typeof l.name !== 'string' || l.name.trim().length === 0) return false;
  if (typeof l.quantity !== 'number' || !Number.isFinite(l.quantity) || l.quantity <= 0) {
    return false;
  }
  if (l.productId !== undefined && typeof l.productId !== 'string') return false;
  if (l.itemType !== undefined && typeof l.itemType !== 'string') return false;
  return true;
}

/**
 * Trim a submitted kit to what is storable: drop unusable lines, trim strings,
 * collapse duplicates of the same product/itemType/name by summing quantity,
 * and omit blank optional fields entirely.
 *
 * Blank-drops rather than empty-strings because no `undefined` may reach a
 * Firestore payload and an empty string is not the same as absent — a line with
 * `productId: ''` would look like a catalog link that resolves to nothing.
 */
export function normalizeSurvivalKitLines(lines: unknown): SurvivalKitLine[] {
  if (!Array.isArray(lines)) return [];
  const merged = new Map<string, SurvivalKitLine>();

  for (const raw of lines) {
    if (!isValidSurvivalKitLine(raw)) continue;
    const productId = raw.productId?.trim();
    const itemType = raw.itemType?.trim();
    const name = raw.name.trim();
    const key = productId || itemType || name.toLowerCase();

    const existing = merged.get(key);
    if (existing) {
      existing.quantity += raw.quantity;
      continue;
    }
    const line: SurvivalKitLine = { name, quantity: raw.quantity };
    if (productId) line.productId = productId;
    if (itemType) line.itemType = itemType;
    merged.set(key, line);
  }

  return [...merged.values()];
}

/** How many individual units a kit puts in a cleaner's hands. */
export function survivalKitUnitCount(kit: Pick<SurvivalKit, 'lines'>): number {
  return kit.lines.reduce((total, line) => total + line.quantity, 0);
}
