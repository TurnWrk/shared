import { describe, expect, it } from 'vitest';
import {
  applicableComplianceRules,
  complianceRulesForState,
  FL_COMPLIANCE_RULES,
  type CompliancePropertyFacts,
} from '../../src/compliance';

const keys = (facts: CompliancePropertyFacts) =>
  applicableComplianceRules(FL_COMPLIANCE_RULES, facts).map((r) => r.key);

const BASELINE = [
  'fl.dbpr_vr_license',
  'fl.fdor_sales_tax_registration',
  'fl.fdor_sales_tax_filing',
  'fl.smoke_alarms',
  'fl.fire_extinguisher_visual',
  'fl.fire_extinguisher_service',
  'fl.county_tdt_registration',
  'fl.county_tdt_filing',
  'fl.city_str_permit',
];

describe('FL compliance rules', () => {
  it('has unique, fl-prefixed keys', () => {
    const all = FL_COMPLIANCE_RULES.map((r) => r.key);
    expect(new Set(all).size).toBe(all.length);
    for (const key of all) expect(key.startsWith('fl.')).toBe(true);
  });

  it('applies only the unconditional rules to a property with no facts', () => {
    expect(keys({})).toEqual(BASELINE);
  });

  it('adds the pool barrier for a pool or heated pool only', () => {
    expect(keys({ supply: { amenities: ['pool'] } })).toContain('fl.pool_barrier');
    expect(keys({ supply: { amenities: ['heated-pool'] } })).toContain('fl.pool_barrier');
    expect(keys({ supply: { amenities: ['hot-tub', 'kitchen'] } })).not.toContain('fl.pool_barrier');
  });

  it('adds balcony certification from 3 stories', () => {
    expect(keys({ compliance: { stories: 2 } })).not.toContain('fl.balcony_certification');
    expect(keys({ compliance: { stories: 3 } })).toContain('fl.balcony_certification');
    expect(keys({ compliance: { stories: 12 } })).toContain('fl.balcony_certification');
  });

  it('adds the CO alarm only for a fuel-burning appliance', () => {
    expect(keys({ compliance: { fuelBurningAppliance: false } })).not.toContain('fl.co_alarm');
    expect(keys({ compliance: { fuelBurningAppliance: true } })).toContain('fl.co_alarm');
  });

  it('adds HOA approval only when an association is named', () => {
    expect(keys({ compliance: { hoaName: '' } })).not.toContain('fl.hoa_approval');
    expect(keys({ compliance: { hoaName: 'Bay Pines HOA' } })).toContain('fl.hoa_approval');
  });

  it('balcony certification recurs every 36 months', () => {
    const rule = FL_COMPLIANCE_RULES.find((r) => r.key === 'fl.balcony_certification');
    expect(rule?.cadence).toEqual({ value: 36, unit: 'months' });
  });

  it('county, city and HOA obligations are operator-entered templates', () => {
    for (const rule of FL_COMPLIANCE_RULES) {
      expect(rule.entry).toBe(rule.level === 'state' ? 'seed' : 'operator');
    }
  });
});

describe('complianceRulesForState', () => {
  it('resolves FL case-insensitively and returns nothing for other states', () => {
    expect(complianceRulesForState('fl')).toBe(FL_COMPLIANCE_RULES);
    expect(complianceRulesForState(' FL ')).toBe(FL_COMPLIANCE_RULES);
    expect(complianceRulesForState('GA')).toEqual([]);
    expect(complianceRulesForState(undefined)).toEqual([]);
  });
});
