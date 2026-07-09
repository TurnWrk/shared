import type { Org } from './types/org';

/** localStorage key for the invite code validated before auth. */
export const PENDING_INVITE_CODE_KEY = 'pendingInviteCode';
export const PENDING_INVITE_ROLE_KEY = 'pendingInviteRole';
export const PENDING_INVITE_ORG_ID_KEY = 'pendingInviteOrgId';
export const PENDING_ORG_NAME_KEY = 'pendingOrgName';
export const EMAIL_FOR_SIGN_IN_KEY = 'emailForSignIn';
export const AUTH_INTENT_KEY = 'authIntent';
export const POST_SIGNUP_ONBOARDING_KEY = 'postSignupOnboarding';

export type AuthIntent = 'signin' | 'create' | 'join';

export function getAuthIntent(): AuthIntent | null {
    if (typeof window === 'undefined') return null;
    const v = window.localStorage.getItem(AUTH_INTENT_KEY);
    if (v === 'signin' || v === 'create' || v === 'join') return v;
    return null;
}

export function setAuthIntent(intent: AuthIntent): void {
    window.localStorage.setItem(AUTH_INTENT_KEY, intent);
}

export function getPendingInviteCode(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(PENDING_INVITE_CODE_KEY);
}

export function getPendingOrgName(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(PENDING_ORG_NAME_KEY)?.trim() || null;
}

export function clearPendingAuthFlags(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(PENDING_INVITE_CODE_KEY);
    window.localStorage.removeItem(PENDING_INVITE_ROLE_KEY);
    window.localStorage.removeItem(PENDING_INVITE_ORG_ID_KEY);
    window.localStorage.removeItem(PENDING_ORG_NAME_KEY);
    window.localStorage.removeItem(AUTH_INTENT_KEY);
}

export function markPostSignupOnboarding(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(POST_SIGNUP_ONBOARDING_KEY, '1');
}

export function consumePostSignupOnboarding(): boolean {
    if (typeof window === 'undefined') return false;
    const v = window.localStorage.getItem(POST_SIGNUP_ONBOARDING_KEY);
    if (v) {
        window.localStorage.removeItem(POST_SIGNUP_ONBOARDING_KEY);
        return true;
    }
    return false;
}

export type ResolveNewUserAction =
    | { type: 'consume_invite'; inviteCode: string }
    | { type: 'bootstrap'; orgName: string; enabledApps: Org['enabledApps'] }
    | { type: 'sign_out_no_account' }
    | { type: 'needs_onboarding' };

/**
 * Decide how to provision a Firebase user who has no Firestore profile yet.
 */
export function resolveNewUserAction(
    enabledApps: Org['enabledApps'],
): ResolveNewUserAction {
    const inviteCode = getPendingInviteCode();
    if (inviteCode) {
        return { type: 'consume_invite', inviteCode };
    }

    const orgName = getPendingOrgName();
    if (orgName) {
        return { type: 'bootstrap', orgName, enabledApps };
    }

    const intent = getAuthIntent();
    if (intent === 'signin') {
        return { type: 'sign_out_no_account' };
    }

    return { type: 'needs_onboarding' };
}

export async function consumeInviteWithToken(
    idToken: string,
    inviteCode: string,
): Promise<{ profile?: unknown }> {
    const res = await fetch('/api/invites/consume', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ inviteCode }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Invite could not be redeemed.');
    }
    return res.json() as Promise<{ profile?: unknown }>;
}

export async function bootstrapOrgWithToken(
    idToken: string,
    name: string,
    enabledApps?: Org['enabledApps'],
): Promise<{ orgId: string; org: Org }> {
    const res = await fetch('/api/orgs/bootstrap', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ name, enabledApps }),
    });
    if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`Org bootstrap failed (${res.status}): ${msg}`);
    }
    return res.json() as Promise<{ orgId: string; org: Org }>;
}

export async function validateInviteCode(
    code: string,
): Promise<{ valid: boolean; role?: string; orgId?: string; error?: string }> {
    const res = await fetch('/api/invites/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !(data as { isValid?: boolean }).isValid) {
        return {
            valid: false,
            error: (data as { message?: string; error?: string }).message
                || (data as { error?: string }).error
                || 'Invalid invite code',
        };
    }
    return {
        valid: true,
        role: (data as { role?: string }).role,
        orgId: (data as { orgId?: string }).orgId,
    };
}

/**
 * Rewrite a Firebase-hosted email action link (`*.firebaseapp.com/__/auth/action`)
 * to the app's `/login` URL with `oobCode` + `apiKey` query params. This bypasses
 * Firebase's hosted action page, which can fail CORS when `init.json` redirects
 * to a marketing domain that doesn't serve Firebase auth helpers.
 */
export function toAppSignInLink(firebaseActionLink: string, appLoginUrl: string): string {
    try {
        const src = new URL(firebaseActionLink);
        const apiKey = src.searchParams.get('apiKey');
        const oobCode = src.searchParams.get('oobCode');
        const mode = src.searchParams.get('mode') ?? 'signIn';
        if (!apiKey || !oobCode) return firebaseActionLink;

        const dest = new URL(appLoginUrl);
        dest.searchParams.set('apiKey', apiKey);
        dest.searchParams.set('oobCode', oobCode);
        dest.searchParams.set('mode', mode);
        const continueUrl = src.searchParams.get('continueUrl');
        if (continueUrl) dest.searchParams.set('continueUrl', continueUrl);
        const lang = src.searchParams.get('lang');
        if (lang) dest.searchParams.set('lang', lang);
        return dest.toString();
    } catch {
        return firebaseActionLink;
    }
}

const PROCESSED_MAGIC_LINK_OOB_KEY = 'turnwrk:processedMagicLinkOob';

/** True if this oobCode was already used to complete sign-in this session. */
export function isMagicLinkOobProcessed(oobCode: string): boolean {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(PROCESSED_MAGIC_LINK_OOB_KEY) === oobCode;
}

export function markMagicLinkOobProcessed(oobCode: string): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(PROCESSED_MAGIC_LINK_OOB_KEY, oobCode);
}

/** Remove one-time sign-in params from the URL so effects don't retry. */
export function clearMagicLinkUrlParams(): void {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('oobCode');
    url.searchParams.delete('apiKey');
    url.searchParams.delete('mode');
    url.searchParams.delete('lang');
    url.searchParams.delete('continueUrl');
    const next = url.pathname + url.search + url.hash;
    window.history.replaceState({}, '', next);
}

export function isInvalidActionCodeError(err: unknown): boolean {
    return (err as { code?: string })?.code === 'auth/invalid-action-code';
}
