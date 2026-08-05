import { normalizePhoneToE164 } from '../phone';
import type { TwentyFieldMap, TwentyOwnerFields } from './types';

export const DEFAULT_TWENTY_FIELD_MAP: TwentyFieldMap = {
  firstName: 'name.firstName',
  lastName: 'name.lastName',
  email: 'emails.primaryEmail',
  phone: 'phones.primaryPhoneNumber',
};

function stringOrUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/** Split a display name into first/last — first token is firstName, remainder is lastName. */
export function splitPersonName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: '', lastName: '' };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

/**
 * Read a dot-path from a Twenty record, tolerating composite fields that arrive as a
 * nested object, bare string, array of objects, or missing.
 */
export function readPath(record: unknown, path: string): string | undefined {
  if (record == null || typeof path !== 'string' || !path) {
    return undefined;
  }

  const segments = path.split('.');
  if (segments.length < 2) {
    return undefined;
  }

  const rootKey = segments[0];
  const leafKey = segments[segments.length - 1];

  let root: unknown;
  if (typeof record === 'object' && !Array.isArray(record)) {
    root = (record as Record<string, unknown>)[rootKey];
  } else {
    return undefined;
  }

  if (root == null) {
    return undefined;
  }

  if (typeof root === 'string') {
    if (rootKey === 'name') {
      const split = splitPersonName(root);
      if (leafKey === 'firstName') return split.firstName || undefined;
      if (leafKey === 'lastName') return split.lastName || undefined;
    }
    return stringOrUndefined(root);
  }

  if (Array.isArray(root)) {
    for (const item of root) {
      if (item == null) continue;
      if (typeof item === 'string') {
        return stringOrUndefined(item);
      }
      if (typeof item === 'object' && !Array.isArray(item)) {
        const leaf = (item as Record<string, unknown>)[leafKey];
        const value = stringOrUndefined(leaf);
        if (value !== undefined) return value;
      }
    }
    return undefined;
  }

  if (typeof root === 'object') {
    return stringOrUndefined((root as Record<string, unknown>)[leafKey]);
  }

  return undefined;
}

export function toOwnerFields(
  record: unknown,
  fieldMap: TwentyFieldMap = DEFAULT_TWENTY_FIELD_MAP,
): TwentyOwnerFields {
  const firstName = readPath(record, fieldMap.firstName) ?? '';
  const lastName = readPath(record, fieldMap.lastName) ?? '';
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  const email = readPath(record, fieldMap.email);
  const phoneRaw = readPath(record, fieldMap.phone) ?? '';
  const phone = normalizePhoneToE164(phoneRaw) ?? phoneRaw.trim();

  const fields: TwentyOwnerFields = { name, phone };
  if (email) {
    fields.email = email;
  }
  return fields;
}

function setNested(
  body: Record<string, unknown>,
  path: string,
  value: string | undefined,
): void {
  if (value === undefined) return;

  const segments = path.split('.');
  if (segments.length < 2) return;

  const parentKey = segments[0];
  const leafKey = segments[segments.length - 1];
  const existing = body[parentKey];
  const container =
    typeof existing === 'object' &&
    existing !== null &&
    !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};

  container[leafKey] = value;
  body[parentKey] = container;
}

/** Strip undefined keys recursively — Firestore rejects undefined values. */
export function stripUndefined(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    if (
      entry !== null &&
      typeof entry === 'object' &&
      !Array.isArray(entry)
    ) {
      const nested = stripUndefined(entry as Record<string, unknown>);
      if (Object.keys(nested).length > 0) {
        out[key] = nested;
      }
      continue;
    }
    out[key] = entry;
  }
  return out;
}

export function toTwentyCreateBody(
  fields: TwentyOwnerFields,
  fieldMap: TwentyFieldMap = DEFAULT_TWENTY_FIELD_MAP,
): Record<string, unknown> {
  const { firstName, lastName } = splitPersonName(fields.name);
  const body: Record<string, unknown> = {};

  if (firstName) {
    setNested(body, fieldMap.firstName, firstName);
  }
  if (lastName) {
    setNested(body, fieldMap.lastName, lastName);
  }
  if (fields.email) {
    setNested(body, fieldMap.email, fields.email);
  }
  if (fields.phone) {
    setNested(body, fieldMap.phone, fields.phone);
  }

  return stripUndefined(body);
}
