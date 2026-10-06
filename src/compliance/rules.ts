import type { Property } from '../types/property';
import type {
  ComplianceCadence,
  ComplianceJurisdictionLevel,
  ComplianceKind,
} from './types';

/** The property facts a rule's applicability predicate may read. */
export type CompliancePropertyFacts = Pick<Property, 'compliance' | 'supply'>;

/**
 * One jurisdiction obligation, as data. A seeding pass turns each applicable
 * rule into a `ComplianceItem` with `ruleKey: rule.key`.
 */
export interface ComplianceRule {
  /** Stable, state-prefixed (`fl.dbpr_vr_license`). Persisted as `ComplianceItem.ruleKey`. */
  key: string;
  kind: ComplianceKind;
  label: string;
  level: ComplianceJurisdictionLevel;
  /**
   * `seed`: created automatically once the rule applies (source
   * `jurisdiction_seed`). `operator`: a template the operator fills in,
   * because the authority, number or cadence varies by county, city or HOA.
   */
  entry: 'seed' | 'operator';
  cadence?: ComplianceCadence;
  leadDays: number;
  /**
   * Day of month the item's `nextDueDate` lands on, for filings with a fixed
   * monthly deadline. Absent = the due date follows cadence from the last
   * completion or issue date.
   */
  dueDayOfMonth?: number;
  ownerVisible: boolean;
  /** Statute or code section the obligation comes from. */
  citation?: string;
  applies: (facts: CompliancePropertyFacts) => boolean;
}

/** The rules of `rules` that apply to a property, in declaration order. */
export function applicableComplianceRules(
  rules: readonly ComplianceRule[],
  facts: CompliancePropertyFacts,
): ComplianceRule[] {
  return rules.filter((rule) => rule.applies(facts));
}
