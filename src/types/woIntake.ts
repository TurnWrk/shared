import type { WOPriority, WOType } from './workOrder';

/**
 * Async AI work-order generation queue (`cmms_woIntakeRequests`).
 *
 * dispatch enqueues one doc per brain dump and returns immediately;
 * turnwrk-cortex claims it, runs Ollama out-of-band, and writes the resulting
 * work orders. Clients only ever READ these — both writers use the Admin SDK.
 *
 * The lifecycle fields deliberately mirror `dispatch_smsInbox` field-for-field
 * so cortex's existing pure reclaim logic (`inboxReprocessLogic.ts`) drives
 * this collection unchanged. That is also why a fresh doc is created at
 * `pending-retry` with `attemptCount: 0` rather than a bespoke `queued`
 * status: the clock anchor then falls back to `receivedAt`, so a handoff that
 * never reached cortex is swept in ~45s instead of sitting under a 12-minute
 * exclusive processing lease.
 */
export interface WoIntakeRequest {
  /** Doc id — a client-minted uuid, so a double-click is idempotent via create(). */
  id: string;
  orgId: string;
  propertyId: string;
  /** Denormalized for the LLM prompt and the failed-card display. */
  propertyAddress?: string;
  /** Auth uid of the requester; audit + "your request failed" attribution. */
  requestedByUid: string;
  /** Which surface enqueued this — drives the emergency assignment rule. */
  source: WoIntakeSource;

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
  /** Resolved on-call tech. Absent for PM-portal emergencies (broadcast-accept). */
  assignedTechId?: string;
  /** Org-local `YYYY-MM-DD`, resolved at enqueue — cortex runs UTC. */
  scheduledDate?: string;
  /** Batch-level checklist choice, applied when the work order is approved. */
  checklistTemplateId?: string;

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
}

export type WoIntakeSource = 'dispatch' | 'pm' | 'proposal';

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
