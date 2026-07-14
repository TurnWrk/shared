import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AUTH_INTENT_KEY,
  PENDING_INVITE_CODE_KEY,
  PENDING_ORG_NAME_KEY,
  clearPendingAuthFlags,
  getAuthIntent,
  setAuthIntent,
  resolveNewUserAction,
  markPostSignupOnboarding,
  consumePostSignupOnboarding,
  POST_SIGNUP_ONBOARDING_KEY,
} from '../src/authFlow';

describe('authFlow resolveNewUserAction', () => {
  const mem = new Map<string, string>();

  beforeEach(() => {
    mem.clear();
    (globalThis as unknown as { window: StorageLike }).window = {
      localStorage: {
        getItem: (k) => mem.get(k) ?? null,
        setItem: (k, v) => {
          mem.set(k, v);
        },
        removeItem: (k) => {
          mem.delete(k);
        },
      },
    };
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('prefers pending invite over bootstrap / signin', () => {
    mem.set(PENDING_INVITE_CODE_KEY, 'ABC123');
    mem.set(PENDING_ORG_NAME_KEY, 'Ignored Org');
    mem.set(AUTH_INTENT_KEY, 'signin');
    expect(resolveNewUserAction({ restock: true })).toEqual({
      type: 'consume_invite',
      inviteCode: 'ABC123',
    });
  });

  it('bootstraps when org name is pending', () => {
    mem.set(PENDING_ORG_NAME_KEY, 'Acme Clean');
    expect(resolveNewUserAction({ clean: true, cmms: true })).toEqual({
      type: 'bootstrap',
      orgName: 'Acme Clean',
      enabledApps: { clean: true, cmms: true },
    });
  });

  it('signs out when intent is signin with no invite/org', () => {
    setAuthIntent('signin');
    expect(getAuthIntent()).toBe('signin');
    expect(resolveNewUserAction({ restock: true })).toEqual({ type: 'sign_out_no_account' });
  });

  it('needs onboarding otherwise; clearPendingAuthFlags wipes keys', () => {
    mem.set(PENDING_INVITE_CODE_KEY, 'X');
    mem.set(AUTH_INTENT_KEY, 'join');
    clearPendingAuthFlags();
    expect(mem.size).toBe(0);
    expect(resolveNewUserAction({ restock: true })).toEqual({ type: 'needs_onboarding' });
  });

  it('mark/consume post-signup onboarding flag', () => {
    expect(consumePostSignupOnboarding()).toBe(false);
    markPostSignupOnboarding();
    expect(mem.get(POST_SIGNUP_ONBOARDING_KEY)).toBe('1');
    expect(consumePostSignupOnboarding()).toBe(true);
    expect(consumePostSignupOnboarding()).toBe(false);
  });
});

interface StorageLike {
  localStorage: {
    getItem: (k: string) => string | null;
    setItem: (k: string, v: string) => void;
    removeItem: (k: string) => void;
  };
}
