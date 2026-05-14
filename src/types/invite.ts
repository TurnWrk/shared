import type { Role } from '../roles';

export type InviteStatus = 'active' | 'used' | 'revoked';

// Roles that may be granted via an invite code. 'owner' and 'guest' are not
// invitable: 'owner' is bootstrapped at org creation and 'guest' is implicit
// for unauthenticated guest-QR flows.
export type InviteRole = Extract<Role, 'admin' | 'pm' | 'tech' | 'cleaner'>;

// Which app issued the invite. The collection is shared across the suite, so
// this lets each app filter to invites it cares about and lets the signup
// flow know which post-acceptance hooks to run (e.g. linking a cleaner doc).
export type InviteSource = 'cmms' | 'restock';

export interface Invite {
  code: string;
  role: InviteRole;
  source: InviteSource;
  createdBy: string;
  createdAt: number;
  status: InviteStatus;

  // Set when the invite is consumed at signup. Both fields are written
  // together; readers should treat absence of either as "not yet consumed".
  usedBy?: string;
  usedAt?: number;

  // Optional linkage written by the issuer so the consumer flow can hydrate
  // the right app-side record on signup. For cleaners, this is the
  // restock_cleaners doc id that should be patched with the new user's uid.
  linkedDocId?: string;

  // The org(s) this invite grants membership in. Both fields are optional at
  // the type level so legacy single-org and new multi-org code paths both
  // typecheck; at runtime one or the other should be set. Use the
  // `inviteOrgIds()` / `inviteOrgId()` helpers to read either form safely.
  orgId?: string;
  orgIds?: string[];
}

export const INVITABLE_ROLES: readonly InviteRole[] = [
  'admin',
  'pm',
  'tech',
  'cleaner',
] as const;

export function isInvitableRole(value: unknown): value is InviteRole {
  return typeof value === 'string' && (INVITABLE_ROLES as readonly string[]).includes(value);
}

// 6-char alphanumeric, uppercase. Excludes O/0/I/1 to avoid confusion.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(length: number = 6): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
  }
  return result;
}

export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function inviteOrgIds(invite: Partial<Pick<Invite, 'orgIds' | 'orgId'>>): string[] {
  if (Array.isArray(invite.orgIds) && invite.orgIds.length > 0) return invite.orgIds;
  if (typeof invite.orgId === 'string' && invite.orgId) return [invite.orgId];
  return [];
}

// Legacy single-org helper. Returns the single orgId when the invite is bound
// to exactly one org (either via the singular `orgId` field or a one-element
// `orgIds` array), otherwise null. Kept for backward compatibility with
// consumer code written before multi-org invites; new code should prefer
// `inviteOrgIds` and handle the array case explicitly.
export function inviteOrgId(invite: Partial<Pick<Invite, 'orgIds' | 'orgId'>>): string | null {
  if (typeof invite.orgId === 'string' && invite.orgId) return invite.orgId;
  if (Array.isArray(invite.orgIds) && invite.orgIds.length === 1) {
    const only = invite.orgIds[0];
    return typeof only === 'string' && only ? only : null;
  }
  return null;
}
