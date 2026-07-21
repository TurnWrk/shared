import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CLEAN_TEMPLATES,
  SAMPLE_TEMPLATE_VARS,
  CLEAN_NOTIFICATION_EVENT_KEYS,
  defaultTemplateFor,
} from '../../src/clean/notificationDefaults';
import type { CleanTemplateBody } from '../../src/clean/notificationDefaults';
import { extractTemplateVars, renderTemplate } from '../../src/clean/templateRender';
import type { CleanNotificationChannel } from '../../src/types/clean';

const CHANNELS: CleanNotificationChannel[] = ['email', 'sms', 'push'];
const BODY_SLOTS: (keyof CleanTemplateBody)[] = [
  'subject',
  'heading',
  'body',
  'ctaLabel',
  'footnote',
];

/** Collect every {{token}} referenced by a default template body. */
function tokensInDefaults(): string[] {
  const seen = new Set<string>();
  for (const eventKey of CLEAN_NOTIFICATION_EVENT_KEYS) {
    for (const channel of CHANNELS) {
      const tmpl = defaultTemplateFor(eventKey, channel);
      if (!tmpl) continue;
      for (const slot of BODY_SLOTS) {
        const text = tmpl[slot];
        if (typeof text !== 'string') continue;
        for (const token of extractTemplateVars(text)) seen.add(token);
      }
    }
  }
  return [...seen].sort();
}

describe('notificationDefaults completeness (TURNWRK-101)', () => {
  it('exposes every event key in DEFAULT_CLEAN_TEMPLATES', () => {
    expect(CLEAN_NOTIFICATION_EVENT_KEYS.length).toBeGreaterThan(5);
    for (const key of CLEAN_NOTIFICATION_EVENT_KEYS) {
      expect(DEFAULT_CLEAN_TEMPLATES[key]?.audience).toBeTruthy();
    }
  });

  it('SAMPLE_TEMPLATE_VARS covers every token used by code defaults', () => {
    const tokens = tokensInDefaults();
    expect(tokens.length).toBeGreaterThan(5);
    const missing = tokens.filter((t) => SAMPLE_TEMPLATE_VARS[t] === undefined);
    expect(missing).toEqual([]);
  });

  it('every default channel body renders with SAMPLE_TEMPLATE_VARS (never-partial)', () => {
    for (const eventKey of CLEAN_NOTIFICATION_EVENT_KEYS) {
      for (const channel of CHANNELS) {
        const tmpl = defaultTemplateFor(eventKey, channel);
        if (!tmpl?.body) continue;
        const result = renderTemplate(tmpl.body, SAMPLE_TEMPLATE_VARS);
        expect(result.ok, `${eventKey}/${channel}: ${JSON.stringify(result)}`).toBe(true);
      }
    }
  });
});
