import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CONNECT_OPERATOR_ACCEPTANCE_LABEL,
  CONNECT_OPERATOR_DISCLOSURE_BULLETS,
  CONNECT_OPERATOR_DISCLOSURE_HEADLINE,
  CONNECT_OPERATOR_PLATFORM_ENTITY_PLACEHOLDER,
  CONNECT_OPERATOR_TERMS_TEXT_HASH,
  CONNECT_OPERATOR_TERMS_VERSION,
  connectOperatorTermsAcceptanceDocId,
  connectOperatorTermsCanonicalText,
} from '../../src/billing/connectOperatorTerms';

describe('connectOperatorTerms', () => {
  it('locks the canonical text hash for acceptance evidence', () => {
    const hash = createHash('sha256')
      .update(connectOperatorTermsCanonicalText(), 'utf8')
      .digest('hex');
    expect(hash).toBe(CONNECT_OPERATOR_TERMS_TEXT_HASH);
  });

  it('builds stable doc ids per org and version', () => {
    expect(
      connectOperatorTermsAcceptanceDocId('org_abc', CONNECT_OPERATOR_TERMS_VERSION),
    ).toBe(`org_abc_${CONNECT_OPERATOR_TERMS_VERSION}`);
  });

  it('includes entity placeholder in bullets for hash pinning', () => {
    expect(CONNECT_OPERATOR_DISCLOSURE_BULLETS.some((b) =>
      b.includes(CONNECT_OPERATOR_PLATFORM_ENTITY_PLACEHOLDER),
    )).toBe(true);
    expect(CONNECT_OPERATOR_DISCLOSURE_HEADLINE).toBe('Your account, your schedule');
    expect(CONNECT_OPERATOR_ACCEPTANCE_LABEL).toContain('Stripe balance');
  });
});
