import { describe, it, expect } from 'vitest';
import {
  VERTICAL_KEYS,
  VERTICAL_EXTENSION_KEYS,
  VERTICAL_REGISTRY,
  packFor,
  requirePack,
  isVerticalKey,
  authoredVerticalKeys,
  resolveOrgVerticals,
  resolvePrimaryVertical,
} from '../src/verticals';
import type { VerticalKey } from '../src/verticals';
import type { Org } from '../src/types/org';

// Every VerticalKey now has a pack (TURNWRK-329), so the tolerant/loud lookup
// paths are exercised with a value cast past the type rather than a real key.
const UNAUTHORED = 'not_a_vertical' as VerticalKey;

const org = (patch: Partial<Org>): Org =>
  ({ id: 'o1', name: 'Org', createdAt: 0, updatedAt: 0, ...patch }) as Org;

describe('vertical registry', () => {
  it('is frozen — packs are authored, never registered at runtime', () => {
    expect(Object.isFrozen(VERTICAL_REGISTRY)).toBe(true);
  });

  it('keys every pack by its own key', () => {
    for (const key of authoredVerticalKeys()) {
      expect(packFor(key)?.key).toBe(key);
    }
  });

  it('only references extension keys that exist', () => {
    for (const key of authoredVerticalKeys()) {
      for (const ext of packFor(key)!.extensions) {
        expect(VERTICAL_EXTENSION_KEYS).toContain(ext);
      }
    }
  });

  it('lists authored keys in VERTICAL_KEYS order', () => {
    const authored = authoredVerticalKeys();
    const inOrder = VERTICAL_KEYS.filter((k) => authored.includes(k));
    expect(authored).toEqual(inOrder);
  });

  it('packFor returns undefined for an unauthored trade', () => {
    // A tolerant read must not throw on a key with no pack.
    expect(packFor(UNAUTHORED)).toBeUndefined();
  });

  it('requirePack throws loudly rather than falling back to cleaning', () => {
    expect(() => requirePack(UNAUTHORED)).toThrow(/No vertical pack authored for 'not_a_vertical'/);
  });

  it('isVerticalKey guards unknown input', () => {
    expect(isVerticalKey('cleaning')).toBe(true);
    expect(isVerticalKey('landscaping')).toBe(true); // renamed from `lawn` (TURNWRK-329)
    expect(isVerticalKey('lawn')).toBe(false); // the old spelling is no longer a key
    expect(isVerticalKey(undefined)).toBe(false);
    expect(isVerticalKey(3)).toBe(false);
  });
});

describe('resolveOrgVerticals', () => {
  it('prefers an explicit declaration', () => {
    expect(resolveOrgVerticals(org({ verticals: ['pool', 'landscaping'] }))).toEqual([
      'pool',
      'landscaping',
    ]);
  });

  it('dedupes and drops unknown declared keys', () => {
    const dirty = { verticals: ['pool', 'pool', 'not_a_vertical'] } as unknown as Partial<Org>;
    expect(resolveOrgVerticals(org(dirty))).toEqual(['pool']);
  });

  it('falls back when the declaration holds nothing usable', () => {
    const dirty = { verticals: ['not_a_vertical'], enabledApps: { clean: true } } as unknown as Partial<Org>;
    expect(resolveOrgVerticals(org(dirty))).toEqual(['cleaning']);
  });

  it('maps a Clean-enabled org to cleaning', () => {
    expect(resolveOrgVerticals(org({ enabledApps: { clean: true } }))).toEqual(['cleaning']);
    // Clean wins when both run — matches the decision record's phrasing.
    expect(
      resolveOrgVerticals(org({ enabledApps: { clean: true, hostfixCmms: true } })),
    ).toEqual(['cleaning']);
  });

  it('maps a Dispatch-only org to str_turnover, legacy `cmms` key included', () => {
    expect(resolveOrgVerticals(org({ enabledApps: { hostfixCmms: true } }))).toEqual([
      'str_turnover',
    ]);
    expect(resolveOrgVerticals(org({ enabledApps: { cmms: true } }))).toEqual(['str_turnover']);
  });

  it('treats absent enabledApps like orgAppEnabled does — Dispatch on', () => {
    expect(resolveOrgVerticals(org({}))).toEqual(['str_turnover']);
    expect(resolveOrgVerticals(null)).toEqual(['str_turnover']);
    expect(resolveOrgVerticals(undefined)).toEqual(['str_turnover']);
  });

  it('resolves nothing for an org running neither app', () => {
    expect(resolveOrgVerticals(org({ enabledApps: { restock: true } }))).toEqual([]);
  });

  it('ignores suspension — shape is not entitlement', () => {
    expect(
      resolveOrgVerticals(org({ status: 'suspended', enabledApps: { clean: true } })),
    ).toEqual(['cleaning']);
  });
});

describe('resolvePrimaryVertical', () => {
  it('prefers an explicit primary', () => {
    expect(
      resolvePrimaryVertical(org({ primaryVertical: 'landscaping', verticals: ['pool'] })),
    ).toBe('landscaping');
  });

  it('ignores an unknown primary and falls back to the first resolved', () => {
    const dirty = { primaryVertical: 'not_a_vertical', verticals: ['pool'] } as unknown as Partial<Org>;
    expect(resolvePrimaryVertical(org(dirty))).toBe('pool');
  });

  it('derives from enabledApps when nothing is declared', () => {
    expect(resolvePrimaryVertical(org({ enabledApps: { clean: true } }))).toBe('cleaning');
  });

  it('is undefined for an org running neither app', () => {
    expect(resolvePrimaryVertical(org({ enabledApps: { restock: true } }))).toBeUndefined();
  });
});

describe('service/clean key rename dual-read (TURNWRK-331)', () => {
  it('resolves cleaning from the new service key', () => {
    expect(resolveOrgVerticals(org({ enabledApps: { service: true } }))).toEqual(['cleaning']);
  });

  it('still resolves cleaning from a legacy org doc', () => {
    expect(resolveOrgVerticals(org({ enabledApps: { clean: true } }))).toEqual(['cleaning']);
  });
});
