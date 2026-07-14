/**
 * Pure Akita → canonical integration helpers (TURNWRK-77).
 * Old-doc reads use getIntegrationOwnerSnapshot; writes use these transforms.
 */

export function normalizeIntegrationMatchPart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * Stable dedupe key for external work orders (hostfix ingest + migrate script).
 * Optional `externalItemId` matches the live work-orders API shape.
 */
export function buildIntegrationMatchKey(
  source: string,
  externalWorkOrderId: string,
  title: string,
  externalItemId?: string,
): string {
  const parts = [
    `src:${normalizeIntegrationMatchPart(source)}`,
    `wo:${normalizeIntegrationMatchPart(externalWorkOrderId)}`,
  ];
  if (externalItemId) {
    parts.push(`item:${normalizeIntegrationMatchPart(externalItemId)}`);
  }
  parts.push(`title:${normalizeIntegrationMatchPart(title || 'untitled')}`);
  return parts.join('|');
}

export interface WorkOrderIntegrationMetadataWrite {
  source: string;
  externalWorkOrderId: string;
  externalParentId?: string;
  externalItemId?: string;
  matchKey: string;
  sourcePropertyName?: string;
  sourceCategory?: string;
  sourceStatus?: string;
}

/** Map legacy `akitaWorkOrderId` (+ title) into canonical `integrationMetadata`. */
export function legacyAkitaWorkOrderToIntegrationMetadata(input: {
  akitaWorkOrderId: string;
  title?: string;
  source?: string;
  externalItemId?: string;
}): WorkOrderIntegrationMetadataWrite | null {
  const externalWorkOrderId = input.akitaWorkOrderId.trim();
  if (!externalWorkOrderId) return null;
  const source = (input.source || 'akita').trim() || 'akita';
  const title = input.title || '';
  const externalItemId = input.externalItemId?.trim() || undefined;
  return {
    source,
    externalWorkOrderId,
    externalParentId: externalWorkOrderId,
    ...(externalItemId ? { externalItemId } : {}),
    matchKey: buildIntegrationMatchKey(source, externalWorkOrderId, title, externalItemId),
  };
}

/** Legacy → canonical maintenance field pairs for property docs. */
export const AKITA_MAINTENANCE_FIELD_PAIRS = [
  ['akitaOwnerName', 'integrationOwnerName'],
  ['akitaOwnerPhone', 'integrationOwnerPhone'],
  ['akitaPropertyName', 'externalPropertyName'],
] as const;

export type AkitaMaintenanceLegacyField = (typeof AKITA_MAINTENANCE_FIELD_PAIRS)[number][0];
export type AkitaMaintenanceCanonicalField = (typeof AKITA_MAINTENANCE_FIELD_PAIRS)[number][1];

/**
 * Given a maintenance object, return dotted-path patches that copy legacy Akita
 * snapshots onto canonical integration fields when the canonical slot is empty.
 */
export function legacyAkitaMaintenanceToCanonicalPatches(
  maintenance: Record<string, unknown> | null | undefined,
): Record<string, string> {
  if (!maintenance) return {};
  const patch: Record<string, string> = {};
  for (const [legacy, target] of AKITA_MAINTENANCE_FIELD_PAIRS) {
    const legacyVal =
      typeof maintenance[legacy] === 'string' ? maintenance[legacy].trim() : '';
    const targetVal =
      typeof maintenance[target] === 'string' ? maintenance[target].trim() : '';
    if (legacyVal && !targetVal) {
      patch[`maintenance.${target}`] = legacyVal;
    }
  }
  return patch;
}
