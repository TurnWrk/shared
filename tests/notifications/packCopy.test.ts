/**
 * Verticals C6 (TURNWRK-325) — the pack-beneath-org fallback chain and the
 * dual-read for renamed template variables.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CLEAN_TEMPLATES,
  SAMPLE_TEMPLATE_VARS,
  resolveNotificationDefaults,
} from '../../src/notifications/defaults';
import { TEMPLATE_VAR_ALIASES, renderTemplate } from '../../src/notifications/render';
import { CLEANING_PACK, STR_TURNOVER_PACK } from '../../src/verticals';

describe('resolveNotificationDefaults', () => {
  it('returns the code defaults untouched when a pack overrides nothing', () => {
    // Both phase-A packs ship empty notificationCopy, so today's orgs must be
    // byte-identical to before this card.
    expect(resolveNotificationDefaults(CLEANING_PACK.notificationCopy)).toEqual(
      DEFAULT_CLEAN_TEMPLATES,
    );
    expect(resolveNotificationDefaults(STR_TURNOVER_PACK.notificationCopy)).toEqual(
      DEFAULT_CLEAN_TEMPLATES,
    );
    expect(resolveNotificationDefaults(undefined)).toEqual(DEFAULT_CLEAN_TEMPLATES);
  });

  it('lets a pack replace one event without disturbing the rest', () => {
    const packed = resolveNotificationDefaults({
      review_request: {
        audience: 'customer',
        channels: { sms: { body: 'How was your pool service?' } },
      },
    });
    expect(packed.review_request.channels.sms?.body).toBe('How was your pool service?');
    expect(Object.keys(packed).length).toBe(Object.keys(DEFAULT_CLEAN_TEMPLATES).length);
    expect(packed.receipt).toEqual(DEFAULT_CLEAN_TEMPLATES.receipt);
  });

  it('replaces a whole event rather than merging channels', () => {
    // Half-overriding an event would leave one channel describing another trade.
    const packed = resolveNotificationDefaults({
      booking_confirmed: { audience: 'customer', channels: { sms: { body: 'Booked.' } } },
    });
    expect(packed.booking_confirmed.channels.email).toBeUndefined();
  });

  it('does not mutate the shared default registry', () => {
    const before = JSON.stringify(DEFAULT_CLEAN_TEMPLATES.receipt);
    resolveNotificationDefaults({
      receipt: { audience: 'customer', channels: { sms: { body: 'x' } } },
    });
    expect(JSON.stringify(DEFAULT_CLEAN_TEMPLATES.receipt)).toBe(before);
  });
});

describe('template variable dual-read', () => {
  it('resolves a renamed var from its legacy alias', () => {
    const r = renderTemplate('{{worker.first_name}} is on the way', {
      'cleaner.first_name': 'Maria',
    });
    expect(r.ok === true && r.text).toBe('Maria is on the way');
  });

  it('prefers the new name when both are supplied', () => {
    const r = renderTemplate('{{worker.first_name}}', {
      'worker.first_name': 'Ana',
      'cleaner.first_name': 'Maria',
    });
    expect(r.ok === true && r.text).toBe('Ana');
  });

  it('still fails closed when neither name is supplied', () => {
    // All-or-nothing rendering is the guard that stops a raw {{token}} reaching
    // a customer — aliasing must not weaken it.
    const r = renderTemplate('{{worker.first_name}}', {});
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.missing).toEqual(['worker.first_name']);
  });

  it('leaves un-aliased tokens alone', () => {
    expect(renderTemplate('{{customer.first_name}}', { 'cleaner.first_name': 'Maria' }).ok).toBe(
      false,
    );
  });

  it('keeps the legacy sample var so existing copy still previews', () => {
    for (const token of Object.keys(TEMPLATE_VAR_ALIASES)) {
      for (const alias of TEMPLATE_VAR_ALIASES[token]) {
        expect(SAMPLE_TEMPLATE_VARS[alias], `${alias} missing from sample vars`).toBeDefined();
      }
    }
  });
});
