// ============================================================================
// Shared types + API client for org-member management.
//
// Both restock and hostfix-cmms expose the same endpoints under
// `/api/orgs/{orgId}/members` (+ the existing `/api/invites/*` endpoints).
// This module provides the typed data contract and a fetch-based client so
// both apps' UIs can call the same endpoints with the same response shape.
//
// Each app passes in its own `authedFetch` (a function that attaches the
// caller's Firebase ID token to the request). The shared package stays
// framework-agnostic — no React, no Next.js — so it can be imported from
// any side of either app.
// ============================================================================

import type { Role } from './roles';
import type { Invite, InviteRole } from './types/invite';

// Roles a member may hold inside a single org. `guest` is implicit and not
// persisted on `Membership`; `owner` requires special privileges to grant.
export const MEMBER_ROLES: Role[] = ['owner', 'admin', 'pm', 'tech', 'cleaner'];

// The roles the role-picker UI surfaces in *each* app. `cleaner` lives on
// the restock side; `tech` is hostfix-only. Each app passes the right
// subset to the UI it builds.
export const RESTOCK_ROLES: Role[] = ['admin', 'pm', 'cleaner'];
export const CMMS_ROLES: Role[] = ['admin', 'pm', 'tech'];

export const ROLE_LABEL: Record<Role, string> = {
    owner: 'Owner',
    admin: 'Admin',
    pm: 'Property Manager',
    tech: 'Technician',
    cleaner: 'Cleaner',
    guest: 'Guest',
};

export interface MemberSummary {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
    roles: Role[];
    lastLoginAt?: number;
    createdAt?: number;
    isYou: boolean;
}

export interface IssuedInvite {
    code: string;
    role: InviteRole;
}

// A function that issues an authenticated request — typically wraps `fetch`
// and attaches `Authorization: Bearer <id-token>`. Each app supplies its
// own implementation since auth-token plumbing differs per app.
export type AuthedFetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface MembersApi {
    listMembers(orgId: string): Promise<MemberSummary[]>;
    updateMemberRoles(orgId: string, uid: string, roles: Role[]): Promise<void>;
    removeMember(orgId: string, uid: string): Promise<void>;
    listInvites(orgId: string, opts?: { source?: 'cmms' | 'restock' | 'all' }): Promise<Invite[]>;
    createInvite(args: {
        orgId: string;
        role: InviteRole;
        email?: string;
        // For cleaner invites the caller may pass `linkedDocId` to bind the
        // new member to a specific app-side record (e.g. restock_cleaners).
        linkedDocId?: string;
    }): Promise<IssuedInvite>;
    revokeInvite(code: string): Promise<void>;
}

export interface MakeMembersApiOpts {
    authedFetch: AuthedFetch;
    // Each app may host the cleaner-invite endpoint differently — restock
    // has a domain-specific `/api/cleaners/invite` (which provisions a
    // restock_cleaners doc + invite atomically), while CMMS reuses the
    // generic `/api/invites/generate`. Override `createInviteUrl` to point
    // at the app-specific endpoint when the role is `cleaner`.
    cleanerInviteUrl?: string;
}

export function makeMembersApi(opts: MakeMembersApiOpts): MembersApi {
    const { authedFetch, cleanerInviteUrl } = opts;

    const parseError = async (res: Response): Promise<string> => {
        try {
            const data = await res.json();
            return data?.error ?? `Request failed with ${res.status}`;
        } catch {
            return `Request failed with ${res.status}`;
        }
    };

    return {
        async listMembers(orgId) {
            const res = await authedFetch(`/api/orgs/${encodeURIComponent(orgId)}/members`);
            if (!res.ok) throw new Error(await parseError(res));
            const { members } = (await res.json()) as { members: MemberSummary[] };
            return members;
        },

        async updateMemberRoles(orgId, uid, roles) {
            const res = await authedFetch(
                `/api/orgs/${encodeURIComponent(orgId)}/members/${encodeURIComponent(uid)}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roles }),
                },
            );
            if (!res.ok) throw new Error(await parseError(res));
        },

        async removeMember(orgId, uid) {
            const res = await authedFetch(
                `/api/orgs/${encodeURIComponent(orgId)}/members/${encodeURIComponent(uid)}`,
                { method: 'DELETE' },
            );
            if (!res.ok) throw new Error(await parseError(res));
        },

        async listInvites(orgId, { source = 'all' } = {}) {
            const url = `/api/invites/list?source=${encodeURIComponent(source)}`;
            const res = await authedFetch(url, {
                headers: { 'x-org-id': orgId },
            });
            if (!res.ok) throw new Error(await parseError(res));
            const { invites } = (await res.json()) as { invites: Invite[] };
            return invites;
        },

        async createInvite({ orgId, role, email, linkedDocId }) {
            // Restock's cleaner invites need a custom endpoint that also
            // creates the `restock_cleaners` doc. The generic invites
            // endpoint can't do that since it's app-agnostic.
            if (role === 'cleaner' && cleanerInviteUrl) {
                const res = await authedFetch(cleanerInviteUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orgId,
                        ...(email ? { email } : {}),
                        ...(linkedDocId ? { linkedDocId } : {}),
                    }),
                });
                if (!res.ok) throw new Error(await parseError(res));
                const data = (await res.json()) as { code: string };
                return { code: data.code, role };
            }

            const res = await authedFetch(`/api/invites/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role,
                    orgId,
                    ...(email ? { email } : {}),
                    ...(linkedDocId ? { linkedDocId } : {}),
                }),
            });
            if (!res.ok) throw new Error(await parseError(res));
            const data = (await res.json()) as { code: string };
            return { code: data.code, role };
        },

        async revokeInvite(code) {
            const res = await authedFetch(`/api/invites/revoke`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });
            if (!res.ok) throw new Error(await parseError(res));
        },
    };
}
