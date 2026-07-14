import { describe, it, expect } from 'vitest';
import { hasRole, hasAnyRole, ROLE_RANK } from '../src/roles';

describe('hasRole (rank ladder)', () => {
  it('grants access when any user role ranks >= required', () => {
    expect(hasRole(['admin'], 'pm')).toBe(true);
    expect(hasRole(['pm'], 'admin')).toBe(false);
    expect(hasRole(['owner'], 'guest')).toBe(true);
    expect(hasRole(['tech'], 'cleaner')).toBe(true); // equal rank 2
    expect(hasRole(['cleaner'], 'tech')).toBe(true);
    expect(hasRole(['guest'], 'tech')).toBe(false);
  });

  it('is false for empty roles', () => {
    expect(hasRole([], 'guest')).toBe(false);
  });
});

describe('hasAnyRole', () => {
  it('matches exact membership, not rank', () => {
    expect(hasAnyRole(['admin', 'pm'], ['tech', 'pm'])).toBe(true);
    expect(hasAnyRole(['owner'], ['admin', 'pm'])).toBe(false);
    expect(hasAnyRole([], ['admin'])).toBe(false);
  });
});

describe('ROLE_RANK', () => {
  it('orders owner > admin > pm > tech/cleaner > guest', () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeGreaterThan(ROLE_RANK.pm);
    expect(ROLE_RANK.pm).toBeGreaterThan(ROLE_RANK.tech);
    expect(ROLE_RANK.tech).toBe(ROLE_RANK.cleaner);
    expect(ROLE_RANK.cleaner).toBeGreaterThan(ROLE_RANK.guest);
  });
});
