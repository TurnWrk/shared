import { describe, it, expect } from 'vitest';
import {
  canonicalNotificationEventKey,
  notificationEventKeyLookupOrder,
} from '../../src/notifications/eventKeys';
import { defaultTemplateFor } from '../../src/notifications/defaults';

describe('notification event key dual-read', () => {
  it('maps the legacy en-route key to the canonical key', () => {
    expect(canonicalNotificationEventKey('cleaner_en_route')).toBe('worker_en_route');
    expect(canonicalNotificationEventKey('worker_en_route')).toBe('worker_en_route');
  });

  it('lists canonical before legacy for override lookups', () => {
    expect(notificationEventKeyLookupOrder('cleaner_en_route')).toEqual([
      'worker_en_route',
      'cleaner_en_route',
    ]);
  });

  it('resolves default templates through the legacy key', () => {
    const canonical = defaultTemplateFor('worker_en_route', 'sms');
    const legacy = defaultTemplateFor('cleaner_en_route', 'sms');
    expect(legacy).toEqual(canonical);
    expect(legacy?.body).toContain('{{worker.first_name}}');
  });
});
