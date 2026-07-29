import { describe, expect, it } from 'vitest';
import { CLEAN_CONNECT_ACCOUNT_DEFAULTS, assertConnectedAccount } from '../../src/billing';

describe('Connect controller defaults', () => {
  it('locks the direct-charge, operator-liable configuration', () => {
    // These four together are the liability posture. Changing any of them moves
    // chargeback exposure or operator funds onto the platform — decided against
    // 2026-07-28 (docs/projects/PRICING-AND-PAYMENTS.md).
    expect(CLEAN_CONNECT_ACCOUNT_DEFAULTS.chargePattern).toBe('direct');
    expect(CLEAN_CONNECT_ACCOUNT_DEFAULTS.lossesCollector).toBe('stripe');
    expect(CLEAN_CONNECT_ACCOUNT_DEFAULTS.feesCollector).toBe('account');
    expect(CLEAN_CONNECT_ACCOUNT_DEFAULTS.dashboard).toBe('express');
  });
});

describe('assertConnectedAccount', () => {
  it('returns the trimmed account id', () => {
    expect(assertConnectedAccount('acct_123', 'preAuthorize')).toBe('acct_123');
    expect(assertConnectedAccount('  acct_123  ', 'preAuthorize')).toBe('acct_123');
  });

  it('throws rather than falling back to the platform account', () => {
    // A silent fallback would charge Turnwrk instead of the operator.
    for (const bad of [undefined, null, '', '   ']) {
      expect(() => assertConnectedAccount(bad, 'preAuthorize')).toThrow(
        /missing connected account id/,
      );
    }
  });

  it('rejects an id that is not a connected account', () => {
    // cus_/pi_/acct-less ids reaching this guard means a ref got crossed.
    expect(() => assertConnectedAccount('cus_123', 'capture')).toThrow(/expected an acct_/);
  });

  it('names the calling context so a throw is diagnosable', () => {
    expect(() => assertConnectedAccount('', 'createSetupIntent')).toThrow(/createSetupIntent/);
  });
});
