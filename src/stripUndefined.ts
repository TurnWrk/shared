/**
 * Strip `undefined` recursively — Firestore rejects undefined values at any
 * depth, including inside arrays. Recurses into plain objects and arrays only,
 * so Dates / Timestamps / class instances pass through untouched. A nested
 * plain object left empty is dropped; an `undefined` array element is removed.
 */
export function stripUndefined(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const cleaned = stripValue(entry);
    if (cleaned === undefined) continue;
    if (isPlainObject(cleaned) && Object.keys(cleaned).length === 0) continue;
    out[key] = cleaned;
  }
  return out;
}

function stripValue(entry: unknown): unknown {
  if (Array.isArray(entry)) {
    return entry.filter((item) => item !== undefined).map((item) => stripValue(item));
  }
  if (isPlainObject(entry)) return stripUndefined(entry);
  return entry;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}
