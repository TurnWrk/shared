import { describe, expect, it } from 'vitest';
import { referralPublicPath, type ReferralLink } from '../../src/crm/referral';
import type { CustomerSource } from '../../src/crm/types';

describe('crm referral (TURNWRK-288)', () => {
  it('includes referral in CustomerSource', () => {
    const source: CustomerSource = 'referral';
    expect(source).toBe('referral');
  });

  it('builds a public path from the token', () => {
    expect(referralPublicPath('abc123')).toBe('/r/abc123');
  });

  it('rejects empty tokens', () => {
    expect(() => referralPublicPath('  ')).toThrow(/required/);
  });

  it('shapes a ReferralLink with redeemedCount', () => {
    const link: ReferralLink = {
      id: 'tok',
      orgId: 'o1',
      referrerCustomerId: 'c1',
      createdAt: 1,
      redeemedCount: 0,
    };
    expect(link.redeemedCount).toBe(0);
  });
});
