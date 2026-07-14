import { describe, it, expect, vi } from 'vitest';
import {
  MEMBER_ROLES,
  RESTOCK_ROLES,
  CMMS_ROLES,
  ROLE_LABEL,
  makeMembersApi,
} from '../src/members';

describe('member role constants', () => {
  it('exposes persisted MEMBER_ROLES and app-specific pickers', () => {
    expect(MEMBER_ROLES).toEqual(['owner', 'admin', 'pm', 'tech', 'cleaner']);
    expect(RESTOCK_ROLES).toEqual(['admin', 'pm', 'cleaner']);
    expect(CMMS_ROLES).toEqual(['admin', 'pm', 'tech']);
    expect(ROLE_LABEL.pm).toBe('Property Manager');
  });
});

describe('makeMembersApi', () => {
  function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
    return vi.fn(impl);
  }

  it('listMembers hits org members path and returns members', async () => {
    const authedFetch = mockFetch(async (url) => {
      expect(url).toBe('/api/orgs/org%2F1/members');
      return new Response(JSON.stringify({ members: [{ uid: 'u1', email: 'a@b.c', roles: ['pm'], isYou: false }] }), {
        status: 200,
      });
    });
    const api = makeMembersApi({ authedFetch });
    const members = await api.listMembers('org/1');
    expect(members).toHaveLength(1);
    expect(members[0].uid).toBe('u1');
  });

  it('updateMemberRoles PATCHes JSON body; removeMember DELETEs', async () => {
    const calls: Array<{ url: string; method?: string; body?: string }> = [];
    const authedFetch = mockFetch(async (url, init) => {
      calls.push({ url, method: init?.method, body: init?.body as string | undefined });
      return new Response('{}', { status: 200 });
    });
    const api = makeMembersApi({ authedFetch });
    await api.updateMemberRoles('o1', 'u1', ['admin']);
    await api.removeMember('o1', 'u1');
    expect(calls[0]).toMatchObject({
      url: '/api/orgs/o1/members/u1',
      method: 'PATCH',
      body: JSON.stringify({ roles: ['admin'] }),
    });
    expect(calls[1]).toMatchObject({ url: '/api/orgs/o1/members/u1', method: 'DELETE' });
  });

  it('createInvite uses cleanerInviteUrl for cleaner role', async () => {
    const authedFetch = mockFetch(async (url, init) => {
      expect(url).toBe('/api/cleaners/invite');
      expect(JSON.parse(init!.body as string)).toEqual({ orgId: 'o1', email: 'c@x.com' });
      return new Response(JSON.stringify({ code: 'ABC' }), { status: 200 });
    });
    const api = makeMembersApi({
      authedFetch,
      cleanerInviteUrl: '/api/cleaners/invite',
    });
    const issued = await api.createInvite({ orgId: 'o1', role: 'cleaner', email: 'c@x.com' });
    expect(issued).toEqual({ code: 'ABC', role: 'cleaner' });
  });

  it('throws with API error message on non-OK', async () => {
    const authedFetch = mockFetch(async () =>
      new Response(JSON.stringify({ error: 'Nope' }), { status: 403 }),
    );
    const api = makeMembersApi({ authedFetch });
    await expect(api.listMembers('o1')).rejects.toThrow('Nope');
  });
});
