import type { ComplianceRule } from '../rules';
import { FL_COMPLIANCE_RULES } from './fl';

export { FL_COMPLIANCE_RULES } from './fl';

const RULES_BY_STATE: Readonly<Record<string, readonly ComplianceRule[]>> = {
  FL: FL_COMPLIANCE_RULES,
};

/** Rule set for a two-letter state code; empty for a state with no rules yet. */
export function complianceRulesForState(state: string | undefined): readonly ComplianceRule[] {
  return (state && RULES_BY_STATE[state.trim().toUpperCase()]) || [];
}
