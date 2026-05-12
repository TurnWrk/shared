import type { Role } from '../roles';

export interface Membership {
  orgId: string;
  roles: Role[];
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  memberships: Membership[];

  // Denormalized indexes derived from memberships. Firestore rules cannot
  // destructure arrays-of-objects, so these flat lists exist purely so rules
  // can check `orgId in userDoc.orgIds`. Must be kept in sync with
  // memberships — use `deriveUserIndex()` whenever memberships change.
  orgIds: string[];
  adminOrgIds: string[];

  // cross-org superadmin. Grants access to suite-wide collections that have
  // no orgId scope (e.g. product catalog, curated lists). Use sparingly.
  platformAdmin?: boolean;

  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;

  // billing (optional; restock uses these today)
  stripeCustomerId?: string;
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | null;
}

export interface UserIndex {
  orgIds: string[];
  adminOrgIds: string[];
}

export function deriveUserIndex(memberships: Membership[]): UserIndex {
  const orgIds = memberships.map((m) => m.orgId);
  const adminOrgIds = memberships
    .filter((m) => m.roles.some((r) => r === 'owner' || r === 'admin'))
    .map((m) => m.orgId);
  return { orgIds, adminOrgIds };
}

export function orgRoles(user: User, orgId: string): Role[] {
  return user.memberships.find((m) => m.orgId === orgId)?.roles ?? [];
}

export function isMemberOf(user: User, orgId: string): boolean {
  return user.memberships.some((m) => m.orgId === orgId);
}

export function isPlatformAdmin(user: User): boolean {
  return user.platformAdmin === true;
}
