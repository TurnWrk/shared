export type Role =
  | 'owner'
  | 'admin'
  | 'pm'
  | 'tech'
  | 'cleaner'
  | 'guest';

export const ROLE_RANK: Record<Role, number> = {
  owner: 5,
  admin: 4,
  pm: 3,
  tech: 2,
  cleaner: 2,
  guest: 0,
};

export function hasRole(userRoles: Role[], required: Role): boolean {
  const requiredRank = ROLE_RANK[required];
  return userRoles.some((r) => ROLE_RANK[r] >= requiredRank);
}

export function hasAnyRole(userRoles: Role[], allowed: Role[]): boolean {
  return userRoles.some((r) => allowed.includes(r));
}
