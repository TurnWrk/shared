import type { WOPriority, WOType } from './workOrder';

/**
 * One item in the org's intake inbox (`cmms_woIntakeRequests`).
 *
 * Started life as the async AI work-order generation queue (TURNWRK-305):
 * dispatch enqueues one doc per brain dump and returns immediately;
 * turnwrk-cortex claims it, runs Ollama out-of-band, and writes the resulting
 * work orders. TURNWRK-733 grew it into the single inbox model — guest, vendor,
 * relay and inspection reports land here too — rather than standing up a twin
 * collection. Clients only ever READ these — every writer uses the Admin SDK.
 *
 * Two independent state machines live on one doc:
 * - `status` is the AI PROCESSING lifecycle, and nothing else. Its fields
 *   deliberately mirror `dispatch_smsInbox` field-for-field so cortex's
 *   existing pure reclaim logic (`inboxReprocessLogic.ts`) drives this
 *   collection unchanged. That is also why a fresh doc is created at
 *   `pending-retry` with `attemptCount: 0` rather than a bespoke `queued`
 *   status: the clock anchor then falls back to `receivedAt`, so a handoff that
 *   never reached cortex is swept in ~45s instead of sitting under a 12-minute
 *   exclusive processing lease.
 * - `triage` is the HUMAN inbox decision (accept / decline / snooze / merge).
 *
 * Docs written before TURNWRK-733 lack the inbox fields; read through
 * `normalizeIntakeItem` (`@turnwrk/shared/intake`), never a bare cast.
 */
export interface IntakeItem {
  /** Doc id — a client-minted uuid, so a double-click is idempotent via create(). */
  id: string;
  orgId: string;
  propertyId: string;
  /** Denormalized for the LLM prompt and the failed-card display. */
  propertyAddress?: string;
  /**
   * Auth uid of the staff/PM user who filed it; audit + "your request failed"
   * attribution. Absent on guest, vendor and relay items — see `reporter`.
   */
  requestedByUid?: string;
  /** Which surface created this — drives the emergency assignment rule. */
  source: IntakeSource;
  /** Who reported it. Legacy docs default to `staff` + `requestedByUid`. */
  reporter: IntakeReporter;

  /** Trades keying (Verticals D1): the customer the job belongs to. */
  customerId?: string;
  /** Trades keying: where the work happens when there is no Property doc. */
  serviceAddress?: IntakeServiceAddress;
  /** The stay the report arrived during (guest sources). */
  bookingId?: string;
  /** Follow-up on an existing job (inspection finding, reopen). */
  parentWorkOrderId?: string;
  /** Upstream message id (SMS sid, relay message id) — idempotency + threading. */
  sourceMessageId?: string;
  /** Photos/video attached by the reporter. */
  mediaUrls?: string[];

  /** The raw brain dump. Clamped at the enqueue route. */
  text: string;
  /**
   * `workOrders` writes real work orders on success. `draftsOnly` writes the
   * drafts to this doc and nothing else — used by the proposal wizard, whose
   * later steps consume the drafts and which must not leave orphan work orders
   * behind if abandoned.
   */
  persistMode: WoIntakePersistMode;
  /**
   * Emergency intakes bypass the review inbox: results land `Scheduled` +
   * `isEmergency` with the tech/date stamped below.
   */
  emergency: boolean;
  /**
   * The emergency detector found a possible emergency it could not confirm
   * because the model was unavailable (TURNWRK-738). The item waits in the
   * Inbox (pinned to the top) and org admins were paged; a human decides.
   */
  possibleEmergency?: boolean;
  /** Resolved on-call tech. Absent for PM-portal emergencies (broadcast-accept). */
  assignedTechId?: string;
  /** Org-local `YYYY-MM-DD`, resolved at enqueue — cortex runs UTC. */
  scheduledDate?: string;
  /** Batch-level checklist choice, applied when the work order is approved. */
  checklistTemplateId?: string;
  /** Stay-specific items composed with the template at approval or create. */
  checklistCustomItems?: import('../checklist').ChecklistCustomItemInput[];

  // --- lifecycle (mirrors dispatch_smsInbox) ---
  status: WoIntakeStatus;
  attemptCount: number;
  receivedAt: number;
  processingAt?: number;
  reclaimedAt?: number;
  completedAt?: number;
  deadLetteredAt?: number;
  /** Short machine-ish cause, e.g. `ollama-circuit-open`, `no-orders`. */
  reason?: string;

  /** Always written on a successful generation, whatever the persist mode. */
  drafts?: WoIntakeDraft[];
  /** Only when `persistMode === 'workOrders'`. */
  workOrderIds?: string[];
  /** Firestore TTL field — `completedAt + 7d`. */
  expireAt?: number;

  // --- AI assessment (written by the processor) ---
  ai?: IntakeAiAssessment;

  // --- human triage (the inbox decision; independent of `status`) ---
  triage: IntakeTriage;
  /** Uid of whoever made the triage decision. */
  triagedBy?: string;
  triagedAt?: number;
  declineReason?: string;
  /** Epoch ms the item resurfaces when `triage === 'snoozed'`. */
  snoozeUntil?: number;
  /** Work order id a human merged this into (`triage === 'duplicate'`). */
  duplicateOf?: string;
  /** Auto-accept rule that accepted this without a human. */
  autoAcceptedByRuleId?: string;
  /** Guest self-help troubleshooting before the item reached triage. */
  deflection?: IntakeDeflection;
  /** When each reporter-facing status update went out (dedupes resends). */
  reporterStatusSentAt?: IntakeReporterStatusSentAt;
}

/** Brain-dump surfaces that enqueue AI work-order generation. */
export type WoIntakeSource = 'dispatch' | 'pm' | 'proposal';

/** Every surface that can put an item in the inbox. */
export type IntakeSource =
  | 'guest_web'
  | 'guest_sms'
  | 'vendor_sms'
  | 'relay'
  | 'inspection'
  | WoIntakeSource;

export const INTAKE_SOURCES: readonly IntakeSource[] = [
  'guest_web',
  'guest_sms',
  'vendor_sms',
  'relay',
  'inspection',
  'dispatch',
  'pm',
  'proposal',
];

export const WO_INTAKE_SOURCES: readonly WoIntakeSource[] = ['dispatch', 'pm', 'proposal'];

export type IntakeReporterKind = 'guest' | 'cleaner' | 'tech' | 'staff';

export interface IntakeReporter {
  kind: IntakeReporterKind;
  /** Uid / member id when the reporter is a known user. */
  id?: string;
  phoneE164?: string;
  /** Guest identity on a share link, when the report came through one. */
  shareGuestId?: string;
}

/** Same shape as dispatch's `EstimateServiceAddress`. */
export interface IntakeServiceAddress {
  address: string;
  addressParts?: {
    line1: string;
    line2?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
}

export type IntakeEmergencyClass = 'water' | 'hvac' | 'lockout' | 'gas' | 'power';

export interface IntakeAiAssessment {
  category: string;
  priority: WOPriority;
  emergencyClass?: IntakeEmergencyClass;
  /**
   * 0..1. Absent when the assessor reports none — the relay chat extractor
   * returns category and priority only, and a made-up number would read as a
   * real score in the Inbox.
   */
  confidence?: number;
  duplicateOfWorkOrderId?: string;
  duplicateOfIntakeId?: string;
}

/**
 * `troubleshooting` — the guest is still in self-help deflection.
 * `pending` — waiting on a human. The rest are terminal-ish decisions;
 * `snoozed` resurfaces at `snoozeUntil`.
 */
export type IntakeTriage =
  | 'troubleshooting'
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'snoozed'
  | 'duplicate';

export interface IntakeDeflection {
  outcome: 'resolved' | 'escalated';
  steps: string[];
}

export interface IntakeReporterStatusSentAt {
  received?: number;
  scheduled?: number;
  done?: number;
}

export type WoIntakePersistMode = 'workOrders' | 'draftsOnly';

/**
 * `completed` and `dead-letter` are terminal. `pending-retry` covers both
 * "never handed off" (attemptCount 0) and "transient failure, will retry".
 */
export type WoIntakeStatus =
  | 'pending-retry'
  | 'processing'
  | 'completed'
  | 'dead-letter';

/** One generated task, normalized from the LLM response. */
export interface WoIntakeDraft {
  title: string;
  description: string;
  priority: WOPriority;
  estimatedHours: number;
  type: WOType;
}
