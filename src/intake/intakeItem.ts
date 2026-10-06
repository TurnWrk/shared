/**
 * Pure payload builder + read normalizer for inbox items
 * (`cmms_woIntakeRequests`, typed as `IntakeItem`).
 *
 * Every writer — dispatch's `createIntakeItem`, and cortex's guest/vendor
 * intake once it lands — builds its doc here, so the omit-undefined rule and
 * the creation defaults live in exactly one place.
 */
import type { ChecklistCustomItemInput } from '../checklist';
import type {
  IntakeAiAssessment,
  IntakeDeflection,
  IntakeItem,
  IntakeReporter,
  IntakeServiceAddress,
  IntakeSource,
  IntakeTriage,
  WoIntakePersistMode,
  WoIntakeStatus,
} from '../types/woIntake';
import { INTAKE_SOURCES, WO_INTAKE_SOURCES } from '../types/woIntake';
import { stripUndefined } from '../stripUndefined';

export interface IntakeItemInput {
  orgId: string;
  source: IntakeSource;
  text: string;
  /** Epoch ms; becomes `receivedAt`. */
  now: number;
  /** Defaults to `{ kind: 'staff', id: requestedByUid }`. */
  reporter?: IntakeReporter;
  requestedByUid?: string;

  propertyId?: string;
  propertyAddress?: string;
  customerId?: string;
  serviceAddress?: IntakeServiceAddress;
  bookingId?: string;
  parentWorkOrderId?: string;
  sourceMessageId?: string;
  mediaUrls?: string[];

  /** Defaults to `workOrders`. */
  persistMode?: WoIntakePersistMode;
  emergency?: boolean;
  /** Only written on an emergency. */
  assignedTechId?: string;
  /** Only written on an emergency. Org-local `YYYY-MM-DD`. */
  scheduledDate?: string;
  /** `''` is meaningful (explicitly no checklist); only undefined is dropped. */
  checklistTemplateId?: string;
  checklistCustomItems?: ChecklistCustomItemInput[];

  ai?: IntakeAiAssessment;
  /** Defaults to `defaultTriageFor(source)`. */
  triage?: IntakeTriage;
  triagedBy?: string;
  triagedAt?: number;
  autoAcceptedByRuleId?: string;
  deflection?: IntakeDeflection;
}

/**
 * A brain dump (dispatch / PM portal / proposal wizard) is a staff member
 * choosing to create work — the decision is already made, and the generated
 * work orders get their own review in Approvals. Everything else arrives from
 * outside and waits on a human.
 */
export function defaultTriageFor(source: IntakeSource): IntakeTriage {
  return (WO_INTAKE_SOURCES as readonly string[]).includes(source) ? 'accepted' : 'pending';
}

/**
 * Build the doc for a new inbox item. Never emits an undefined value at any
 * depth — Firestore rejects them — and a trade intake carries no propertyId at
 * all rather than an empty one.
 *
 * Created at `pending-retry` with `attemptCount: 0` rather than `processing`:
 * cortex's reclaim clock then anchors on `receivedAt`, so a handoff that never
 * arrives is swept in ~45s instead of sitting out a 12-minute processing lease.
 */
export function buildIntakeItemPayload(input: IntakeItemInput): Record<string, unknown> {
  const emergency = input.emergency === true;
  const triage = input.triage ?? defaultTriageFor(input.source);
  const reporter = input.reporter ?? staffReporter(input.requestedByUid);

  const doc: Record<string, unknown> = {
    orgId: input.orgId,
    source: input.source,
    reporter,
    text: input.text,
    persistMode: input.persistMode ?? 'workOrders',
    emergency,
    status: 'pending-retry',
    attemptCount: 0,
    receivedAt: input.now,
    triage,
  };

  if (input.requestedByUid) doc.requestedByUid = input.requestedByUid;
  if (input.propertyId) doc.propertyId = input.propertyId;
  if (input.customerId) doc.customerId = input.customerId;
  if (input.serviceAddress) doc.serviceAddress = input.serviceAddress;
  if (input.propertyAddress) doc.propertyAddress = input.propertyAddress;
  if (input.bookingId) doc.bookingId = input.bookingId;
  if (input.parentWorkOrderId) doc.parentWorkOrderId = input.parentWorkOrderId;
  if (input.sourceMessageId) doc.sourceMessageId = input.sourceMessageId;
  if (input.mediaUrls?.length) doc.mediaUrls = input.mediaUrls;
  if (input.checklistTemplateId !== undefined) doc.checklistTemplateId = input.checklistTemplateId;
  if (input.checklistCustomItems) doc.checklistCustomItems = input.checklistCustomItems;
  if (emergency) {
    if (input.assignedTechId) doc.assignedTechId = input.assignedTechId;
    if (input.scheduledDate) doc.scheduledDate = input.scheduledDate;
  }
  if (input.ai) doc.ai = input.ai;

  // A decided item records who decided and when; for a brain dump that is the
  // filer, at filing time.
  if (triage !== 'pending' && triage !== 'troubleshooting') {
    const triagedBy = input.triagedBy ?? input.requestedByUid;
    if (triagedBy) doc.triagedBy = triagedBy;
    doc.triagedAt = input.triagedAt ?? input.now;
  }
  if (input.autoAcceptedByRuleId) doc.autoAcceptedByRuleId = input.autoAcceptedByRuleId;
  if (input.deflection) doc.deflection = input.deflection;

  // Nested caller objects (serviceAddress, checklist items, deflection, ai,
  // reporter) can carry undefined too; strip at every depth in one pass.
  return stripUndefined(doc);
}

const STATUSES: readonly WoIntakeStatus[] = ['pending-retry', 'processing', 'completed', 'dead-letter'];
const TRIAGES: readonly IntakeTriage[] = [
  'troubleshooting',
  'pending',
  'accepted',
  'declined',
  'snoozed',
  'duplicate',
];

/**
 * Read a raw `cmms_woIntakeRequests` doc as an `IntakeItem`.
 *
 * Docs written before TURNWRK-733 are brain dumps with no inbox fields: they
 * already carry `source` ('dispatch' | 'pm' | 'proposal'), so `reporter` and
 * `triage` are derived from it exactly as `buildIntakeItemPayload` would have
 * written them. Unknown values fall back to the safe default rather than
 * leaking an unrenderable state into the UI.
 */
export function normalizeIntakeItem(data: Record<string, unknown>, id: string): IntakeItem {
  const source = pick(data.source, INTAKE_SOURCES, 'dispatch');
  const requestedByUid = typeof data.requestedByUid === 'string' ? data.requestedByUid : undefined;
  const reporter = isReporter(data.reporter) ? data.reporter : staffReporter(requestedByUid);
  return {
    ...(data as unknown as IntakeItem),
    id,
    source,
    reporter,
    status: pick(data.status, STATUSES, 'pending-retry'),
    attemptCount: typeof data.attemptCount === 'number' ? data.attemptCount : 0,
    persistMode: data.persistMode === 'draftsOnly' ? 'draftsOnly' : 'workOrders',
    emergency: data.emergency === true,
    triage: pick(data.triage, TRIAGES, defaultTriageFor(source)),
  };
}

function staffReporter(uid: string | undefined): IntakeReporter {
  return uid ? { kind: 'staff', id: uid } : { kind: 'staff' };
}

function isReporter(v: unknown): v is IntakeReporter {
  if (!v || typeof v !== 'object') return false;
  const kind = (v as { kind?: unknown }).kind;
  return kind === 'guest' || kind === 'cleaner' || kind === 'tech' || kind === 'staff';
}

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}
