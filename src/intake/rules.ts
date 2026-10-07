/**
 * Intake auto-accept rules (TURNWRK-737). Pure: no Firestore, no clock.
 *
 * An org keeps an ORDERED list of rules in `cmms_intakeRules/{orgId}`
 * (Admin-SDK only). When an inbox item is created already processed, every
 * writer — dispatch's `createIntakeItem`, cortex's vendor SMS pipeline —
 * evaluates the list top to bottom; the FIRST rule whose `when` matches
 * decides. `then.autoAccept` accepts the item through the same work-order
 * builder a human Accept uses (`buildAcceptedWorkOrders`) and stamps
 * `autoAcceptedByRuleId`; otherwise the item waits in the Inbox, carrying the
 * rule's priority as a hint.
 *
 * An org that has never stored rules runs on `DEFAULT_INTAKE_RULES`, which keep
 * the behaviour that predates the Inbox: a known vendor's SMS becomes Backlog
 * work immediately, and so does an inspection finding.
 */
import type { WOPriority } from '../types/workOrder';
import type { IntakeItem, IntakeReporterKind, IntakeSource } from '../types/woIntake';
import { INTAKE_SOURCES } from '../types/woIntake';

/** Every condition present must hold; an absent (or empty) list matches anything. */
export interface IntakeRuleWhen {
  sources?: IntakeSource[];
  /** Compared case-insensitively against `ai.category`. */
  categories?: string[];
  /** Absent matches both; `true` / `false` match only that. */
  emergency?: boolean;
  reporterKinds?: IntakeReporterKind[];
}

export interface IntakeRuleThen {
  autoAccept: boolean;
  /** Overrides every draft's priority (an emergency stays High). */
  priority?: WOPriority;
  /** Technician id stamped as `assignedTechId` on auto-accepted work orders. */
  assigneeId?: string;
}

export interface IntakeRule {
  /** Stable id; becomes `IntakeItem.autoAcceptedByRuleId`. */
  id: string;
  name: string;
  when: IntakeRuleWhen;
  then: IntakeRuleThen;
}

/** `cmms_intakeRules/{orgId}`. */
export interface OrgIntakeRules {
  orgId: string;
  /** Evaluated in order; first match wins. */
  rules: IntakeRule[];
  updatedAt: number;
  /** Uid of the last editor, or `'seed'`. */
  updatedBy: string;
}

export const DEFAULT_VENDOR_SMS_RULE_ID = 'default-vendor-sms';
export const DEFAULT_INSPECTION_RULE_ID = 'default-inspection';

/** The canonical defaults every org is seeded with. */
export const DEFAULT_INTAKE_RULES: readonly IntakeRule[] = Object.freeze([
  {
    id: DEFAULT_VENDOR_SMS_RULE_ID,
    name: 'Auto-accept SMS from known vendors',
    when: { sources: ['vendor_sms'], reporterKinds: ['cleaner', 'tech'] },
    then: { autoAccept: true },
  },
  {
    id: DEFAULT_INSPECTION_RULE_ID,
    name: 'Auto-accept inspection findings',
    when: { sources: ['inspection'] },
    then: { autoAccept: true },
  },
]);

/** What a rule can see of an item. */
export interface IntakeRuleFacts {
  source: IntakeSource;
  category?: string;
  emergency: boolean;
  reporterKind: IntakeReporterKind;
}

export function intakeRuleFacts(
  item: Pick<IntakeItem, 'source' | 'emergency' | 'reporter'> & { ai?: { category?: string } },
): IntakeRuleFacts {
  const facts: IntakeRuleFacts = {
    source: item.source,
    emergency: item.emergency === true,
    reporterKind: item.reporter?.kind ?? 'staff',
  };
  if (item.ai?.category) facts.category = item.ai.category;
  return facts;
}

export function intakeRuleMatches(rule: IntakeRule, facts: IntakeRuleFacts): boolean {
  const { when } = rule;
  if (when.sources?.length && !when.sources.includes(facts.source)) return false;
  if (when.reporterKinds?.length && !when.reporterKinds.includes(facts.reporterKind)) return false;
  if (when.emergency !== undefined && when.emergency !== facts.emergency) return false;
  if (when.categories?.length) {
    const category = facts.category?.trim().toLowerCase();
    if (!category || !when.categories.some((c) => c.trim().toLowerCase() === category)) return false;
  }
  return true;
}

/** The first matching rule, or undefined when none matches. */
export function evaluateIntakeRules(
  rules: readonly IntakeRule[],
  facts: IntakeRuleFacts,
): IntakeRule | undefined {
  return rules.find((rule) => intakeRuleMatches(rule, facts));
}

/**
 * The rules an org runs on. No doc at all (never seeded, never edited) means
 * the defaults; a stored doc is authoritative even when its list is empty —
 * an admin who deleted every rule meant it.
 */
export function effectiveIntakeRules(doc: unknown): IntakeRule[] {
  if (!doc || typeof doc !== 'object') return DEFAULT_INTAKE_RULES.map(cloneRule);
  const parsed = parseIntakeRules((doc as { rules?: unknown }).rules);
  // A malformed stored doc is not "no rules": fall back to the safe defaults.
  return parsed.ok ? parsed.rules : DEFAULT_INTAKE_RULES.map(cloneRule);
}

/** The doc a new org (or the one-off migration) is seeded with. */
export function seedOrgIntakeRules(orgId: string, now: number): OrgIntakeRules {
  return { orgId, rules: DEFAULT_INTAKE_RULES.map(cloneRule), updatedAt: now, updatedBy: 'seed' };
}

export const MAX_INTAKE_RULES = 50;
const MAX_NAME = 120;
const MAX_CATEGORIES = 20;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const PRIORITIES: readonly WOPriority[] = ['High', 'Medium', 'Low'];
const REPORTER_KINDS: readonly IntakeReporterKind[] = ['guest', 'cleaner', 'tech', 'staff'];

export type ParseIntakeRulesResult = { ok: true; rules: IntakeRule[] } | { ok: false; error: string };

/**
 * Validate an untrusted rule list (the Settings API body, a stored doc) into
 * canonical rules: unknown keys dropped, empty conditions omitted, never an
 * undefined value (the result is written to Firestore as-is).
 */
export function parseIntakeRules(input: unknown): ParseIntakeRulesResult {
  if (!Array.isArray(input)) return { ok: false, error: 'rules must be an array' };
  if (input.length > MAX_INTAKE_RULES) return { ok: false, error: `at most ${MAX_INTAKE_RULES} rules` };
  const rules: IntakeRule[] = [];
  const ids = new Set<string>();
  for (const [i, raw] of input.entries()) {
    const at = `rule ${i + 1}`;
    if (!raw || typeof raw !== 'object') return { ok: false, error: `${at}: must be an object` };
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id.trim() : '';
    if (!ID_PATTERN.test(id)) return { ok: false, error: `${at}: id must be 1-64 url-safe characters` };
    if (ids.has(id)) return { ok: false, error: `${at}: duplicate id ${id}` };
    ids.add(id);
    const name = typeof r.name === 'string' ? r.name.trim().slice(0, MAX_NAME) : '';
    if (!name) return { ok: false, error: `${at}: a name is required` };

    const w = (r.when && typeof r.when === 'object' ? r.when : {}) as Record<string, unknown>;
    const when: IntakeRuleWhen = {};
    const sources = stringList(w.sources);
    if (sources === null || sources.some((s) => !(INTAKE_SOURCES as readonly string[]).includes(s))) {
      return { ok: false, error: `${at}: unknown source` };
    }
    if (sources.length) when.sources = sources as IntakeSource[];
    const kinds = stringList(w.reporterKinds);
    if (kinds === null || kinds.some((k) => !(REPORTER_KINDS as readonly string[]).includes(k))) {
      return { ok: false, error: `${at}: unknown reporter kind` };
    }
    if (kinds.length) when.reporterKinds = kinds as IntakeReporterKind[];
    const categories = stringList(w.categories);
    if (categories === null || categories.length > MAX_CATEGORIES) {
      return { ok: false, error: `${at}: categories must be a list of at most ${MAX_CATEGORIES}` };
    }
    const cleanCategories = categories.map((c) => c.trim().slice(0, 64)).filter(Boolean);
    if (cleanCategories.length) when.categories = cleanCategories;
    if (w.emergency !== undefined && w.emergency !== null) {
      if (typeof w.emergency !== 'boolean') return { ok: false, error: `${at}: emergency must be true, false or absent` };
      when.emergency = w.emergency;
    }

    const t = (r.then && typeof r.then === 'object' ? r.then : {}) as Record<string, unknown>;
    const then: IntakeRuleThen = { autoAccept: t.autoAccept === true };
    if (t.priority !== undefined && t.priority !== null && t.priority !== '') {
      if (!(PRIORITIES as readonly unknown[]).includes(t.priority)) return { ok: false, error: `${at}: unknown priority` };
      then.priority = t.priority as WOPriority;
    }
    if (typeof t.assigneeId === 'string' && t.assigneeId.trim()) {
      const assigneeId = t.assigneeId.trim();
      if (!ID_PATTERN.test(assigneeId)) return { ok: false, error: `${at}: invalid assignee` };
      then.assigneeId = assigneeId;
    }
    rules.push({ id, name, when, then });
  }
  return { ok: true, rules };
}

/** A string array, [] when absent, null when present but not a string array. */
function stringList(v: unknown): string[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) return null;
  return [...new Set(v as string[])];
}

function cloneRule(rule: IntakeRule): IntakeRule {
  return JSON.parse(JSON.stringify(rule)) as IntakeRule;
}
