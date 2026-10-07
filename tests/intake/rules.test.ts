/**
 * TURNWRK-737 — intake auto-accept rules engine.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INSPECTION_RULE_ID,
  DEFAULT_INTAKE_RULES,
  DEFAULT_VENDOR_SMS_RULE_ID,
  MAX_INTAKE_RULES,
  effectiveIntakeRules,
  evaluateIntakeRules,
  intakeRuleFacts,
  intakeRuleMatches,
  parseIntakeRules,
  seedOrgIntakeRules,
  type IntakeRule,
  type IntakeRuleFacts,
} from '../../src/intake';

const facts = (over: Partial<IntakeRuleFacts> = {}): IntakeRuleFacts => ({
  source: 'vendor_sms',
  emergency: false,
  reporterKind: 'cleaner',
  ...over,
});

const rule = (id: string, when: IntakeRule['when'], then: IntakeRule['then'] = { autoAccept: true }): IntakeRule => ({
  id,
  name: id,
  when,
  then,
});

describe('default rules', () => {
  it('auto-accept SMS from a known cleaner or tech', () => {
    for (const reporterKind of ['cleaner', 'tech'] as const) {
      expect(evaluateIntakeRules(DEFAULT_INTAKE_RULES, facts({ reporterKind }))?.id).toBe(DEFAULT_VENDOR_SMS_RULE_ID);
    }
  });

  it('auto-accept inspection findings', () => {
    const hit = evaluateIntakeRules(DEFAULT_INTAKE_RULES, facts({ source: 'inspection', reporterKind: 'tech' }));
    expect(hit?.id).toBe(DEFAULT_INSPECTION_RULE_ID);
    expect(hit?.then.autoAccept).toBe(true);
  });

  it('leave guest, relay and staff reports for a human', () => {
    for (const source of ['guest_web', 'guest_sms', 'relay', 'dispatch'] as const) {
      expect(evaluateIntakeRules(DEFAULT_INTAKE_RULES, facts({ source, reporterKind: 'guest' }))).toBeUndefined();
    }
    // vendor_sms from someone who is not a known vendor is not auto-accepted.
    expect(evaluateIntakeRules(DEFAULT_INTAKE_RULES, facts({ reporterKind: 'guest' }))).toBeUndefined();
  });

  it('are frozen, and the seed hands out a copy', () => {
    const seeded = seedOrgIntakeRules('org-1', 42);
    expect(seeded).toEqual({ orgId: 'org-1', rules: DEFAULT_INTAKE_RULES, updatedAt: 42, updatedBy: 'seed' });
    seeded.rules[0].then.autoAccept = false;
    expect(DEFAULT_INTAKE_RULES[0].then.autoAccept).toBe(true);
  });

  it('round-trip through the parser unchanged', () => {
    expect(parseIntakeRules(DEFAULT_INTAKE_RULES)).toEqual({ ok: true, rules: DEFAULT_INTAKE_RULES });
  });
});

describe('intakeRuleMatches', () => {
  it('matches anything with an empty when', () => {
    expect(intakeRuleMatches(rule('any', {}), facts({ source: 'guest_web', reporterKind: 'guest' }))).toBe(true);
  });

  it('requires every present condition', () => {
    const r = rule('r', { sources: ['guest_sms'], categories: ['Plumbing'], emergency: true });
    expect(intakeRuleMatches(r, facts({ source: 'guest_sms', category: 'plumbing', emergency: true }))).toBe(true);
    expect(intakeRuleMatches(r, facts({ source: 'guest_sms', category: 'plumbing', emergency: false }))).toBe(false);
    expect(intakeRuleMatches(r, facts({ source: 'guest_sms', category: 'hvac', emergency: true }))).toBe(false);
    expect(intakeRuleMatches(r, facts({ source: 'guest_web', category: 'plumbing', emergency: true }))).toBe(false);
  });

  it('never matches a category condition on an uncategorised item', () => {
    expect(intakeRuleMatches(rule('r', { categories: ['hvac'] }), facts())).toBe(false);
  });

  it('emergency:false matches only non-emergencies', () => {
    const r = rule('r', { emergency: false });
    expect(intakeRuleMatches(r, facts({ emergency: false }))).toBe(true);
    expect(intakeRuleMatches(r, facts({ emergency: true }))).toBe(false);
  });
});

describe('evaluateIntakeRules', () => {
  it('first match wins, so order is the precedence', () => {
    const hold = rule('hold-emergencies', { emergency: true }, { autoAccept: false, priority: 'High' });
    const accept = rule('accept-vendors', { sources: ['vendor_sms'] });
    expect(evaluateIntakeRules([hold, accept], facts({ emergency: true }))?.id).toBe('hold-emergencies');
    expect(evaluateIntakeRules([accept, hold], facts({ emergency: true }))?.id).toBe('accept-vendors');
  });

  it('returns undefined for an empty list', () => {
    expect(evaluateIntakeRules([], facts())).toBeUndefined();
  });
});

describe('intakeRuleFacts', () => {
  it('reads source, emergency, reporter kind and the AI category off an item', () => {
    expect(
      intakeRuleFacts({
        source: 'guest_sms',
        emergency: true,
        reporter: { kind: 'guest' },
        ai: { category: 'water' },
      }),
    ).toEqual({ source: 'guest_sms', emergency: true, reporterKind: 'guest', category: 'water' });
    expect(intakeRuleFacts({ source: 'inspection', emergency: false, reporter: { kind: 'tech' } })).toEqual({
      source: 'inspection',
      emergency: false,
      reporterKind: 'tech',
    });
  });
});

describe('effectiveIntakeRules', () => {
  it('runs an org with no stored doc on the defaults', () => {
    expect(effectiveIntakeRules(undefined)).toEqual(DEFAULT_INTAKE_RULES);
  });

  it('honours a stored empty list — the admin deleted every rule', () => {
    expect(effectiveIntakeRules({ orgId: 'o', rules: [] })).toEqual([]);
  });

  it('uses the stored list in its stored order', () => {
    const stored = [rule('b', { sources: ['relay'] }), rule('a', {})];
    expect(effectiveIntakeRules({ rules: stored }).map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('falls back to the defaults when the stored doc is malformed', () => {
    expect(effectiveIntakeRules({ rules: 'nope' })).toEqual(DEFAULT_INTAKE_RULES);
  });
});

describe('parseIntakeRules', () => {
  it('canonicalises: trims, dedupes lists, drops empty conditions and unknown keys', () => {
    const out = parseIntakeRules([
      {
        id: ' r1 ',
        name: ' Plumbing to Sam ',
        when: { sources: ['guest_sms', 'guest_sms'], categories: [' plumbing ', ''], reporterKinds: [], emergency: null },
        then: { autoAccept: true, priority: 'High', assigneeId: 'tech-9', extra: 1 },
        junk: true,
      },
    ]);
    expect(out).toEqual({
      ok: true,
      rules: [
        {
          id: 'r1',
          name: 'Plumbing to Sam',
          when: { sources: ['guest_sms'], categories: ['plumbing'] },
          then: { autoAccept: true, priority: 'High', assigneeId: 'tech-9' },
        },
      ],
    });
  });

  it.each([
    ['not an array', {}, 'rules must be an array'],
    ['missing name', [{ id: 'a', when: {}, then: {} }], 'rule 1: a name is required'],
    ['bad id', [{ id: 'a b', name: 'x' }], 'rule 1: id must be 1-64 url-safe characters'],
    ['duplicate id', [{ id: 'a', name: 'x' }, { id: 'a', name: 'y' }], 'rule 2: duplicate id a'],
    ['unknown source', [{ id: 'a', name: 'x', when: { sources: ['fax'] } }], 'rule 1: unknown source'],
    ['unknown reporter', [{ id: 'a', name: 'x', when: { reporterKinds: ['owner'] } }], 'rule 1: unknown reporter kind'],
    ['bad priority', [{ id: 'a', name: 'x', then: { priority: 'Urgent' } }], 'rule 1: unknown priority'],
    ['bad emergency', [{ id: 'a', name: 'x', when: { emergency: 'yes' } }], 'rule 1: emergency must be true, false or absent'],
  ])('refuses %s', (_label, input, error) => {
    expect(parseIntakeRules(input)).toEqual({ ok: false, error });
  });

  it('caps the list length', () => {
    const many = Array.from({ length: MAX_INTAKE_RULES + 1 }, (_, i) => ({ id: `r${i}`, name: 'x' }));
    expect(parseIntakeRules(many)).toEqual({ ok: false, error: `at most ${MAX_INTAKE_RULES} rules` });
  });

  it('treats a missing autoAccept as false', () => {
    const out = parseIntakeRules([{ id: 'a', name: 'x' }]);
    expect(out.ok && out.rules[0].then).toEqual({ autoAccept: false });
  });
});
