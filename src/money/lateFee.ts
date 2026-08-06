/**
 * Optional late-fee policy for trade A/R invoices (TURNWRK-287 / P2.4).
 * Pure domain — callers apply on the overdue flip inside the dunning sweep.
 */
export interface LateFeePolicy {
  /** Master switch; default false when absent. */
  enabled?: boolean;
  /** One-time flat surcharge in minor units. */
  flatFeeMinor?: number;
  /** Percent of outstanding balance in basis points (150 = 1.5%). */
  percentBps?: number;
  /** Customer-facing disclosure copied onto invoice terms. */
  disclosureText?: string;
}

export interface LateFeeComputation {
  feeMinor: number;
  disclosureText?: string;
}

/**
 * Compute a late fee for an outstanding balance. Uses flat fee when set,
 * otherwise percent of balance. Returns zero when disabled or nothing configured.
 */
export function computeLateFeeMinor(
  balanceMinor: number,
  policy: LateFeePolicy | undefined,
): LateFeeComputation {
  if (!policy?.enabled || balanceMinor <= 0) {
    return { feeMinor: 0 };
  }

  let feeMinor = 0;
  if (typeof policy.flatFeeMinor === 'number' && policy.flatFeeMinor > 0) {
    feeMinor = Math.trunc(policy.flatFeeMinor);
  } else if (
    typeof policy.percentBps === 'number' &&
    Number.isInteger(policy.percentBps) &&
    policy.percentBps > 0
  ) {
    feeMinor = Math.round((balanceMinor * policy.percentBps) / 10_000);
  }

  const disclosureText =
    typeof policy.disclosureText === 'string' && policy.disclosureText.trim()
      ? policy.disclosureText.trim()
      : undefined;

  return { feeMinor: Math.max(0, feeMinor), disclosureText };
}

/** Format late-fee disclosure for invoice terms footers. */
export function formatLateFeeDisclosure(policy: LateFeePolicy | undefined): string | undefined {
  if (!policy?.enabled) return undefined;
  if (policy.disclosureText?.trim()) return policy.disclosureText.trim();

  const parts: string[] = [];
  if (typeof policy.flatFeeMinor === 'number' && policy.flatFeeMinor > 0) {
    parts.push(`a $${(policy.flatFeeMinor / 100).toFixed(2)} late fee`);
  } else if (typeof policy.percentBps === 'number' && policy.percentBps > 0) {
    parts.push(`a ${(policy.percentBps / 100).toFixed(2)}% late fee`);
  }
  if (parts.length === 0) return undefined;
  return `Overdue balances may incur ${parts[0]}.`;
}
