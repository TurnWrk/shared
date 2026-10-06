/**
 * TURNWRK-733 — `IntakeItem` payload builder + legacy-doc normalizer.
 */
import { describe, expect, it } from 'vitest';
import {
  buildIntakeItemPayload,
  defaultTriageFor,
  normalizeIntakeItem,
} from '../../src/intake';

const brainDump = {
  orgId: 'o1',
  source: 'dispatch' as const,
  text: 'Faucet drips',
  requestedByUid: 'u1',
  propertyId: 'p1',
  now: 1000,
};

describe('defaultTriageFor', () => {
  it('treats brain dumps as already accepted and outside reports as pending', () => {
    expect(defaultTriageFor('dispatch')).toBe('accepted');
    expect(defaultTriageFor('pm')).toBe('accepted');
    expect(defaultTriageFor('proposal')).toBe('accepted');
    for (const s of ['guest_web', 'guest_sms', 'vendor_sms', 'relay', 'inspection'] as const) {
      expect(defaultTriageFor(s)).toBe('pending');
    }
  });
});

describe('buildIntakeItemPayload', () => {
  it('creates at pending-retry / attemptCount 0 so the sweeper can recover a lost handoff', () => {
    const doc = buildIntakeItemPayload(brainDump);
    expect(doc).toMatchObject({ status: 'pending-retry', attemptCount: 0, receivedAt: 1000 });
  });

  it('stamps a brain dump as staff-reported and accepted by its filer', () => {
    const doc = buildIntakeItemPayload(brainDump);
    expect(doc.reporter).toEqual({ kind: 'staff', id: 'u1' });
    expect(doc.triage).toBe('accepted');
    expect(doc.triagedBy).toBe('u1');
    expect(doc.triagedAt).toBe(1000);
    expect(doc.persistMode).toBe('workOrders');
    expect(doc.emergency).toBe(false);
  });

  it('leaves a guest report pending with no triage stamp and no requester', () => {
    const doc = buildIntakeItemPayload({
      orgId: 'o1',
      source: 'guest_sms',
      text: 'No hot water',
      now: 5,
      reporter: { kind: 'guest', phoneE164: '+15551234567', shareGuestId: undefined },
      bookingId: 'b1',
      sourceMessageId: 'SM123',
      mediaUrls: ['https://x/1.jpg'],
      ai: { category: 'plumbing', priority: 'High', emergencyClass: 'water', confidence: 0.9 },
    });
    expect(doc.triage).toBe('pending');
    expect('triagedBy' in doc).toBe(false);
    expect('triagedAt' in doc).toBe(false);
    expect('requestedByUid' in doc).toBe(false);
    expect(doc.reporter).toEqual({ kind: 'guest', phoneE164: '+15551234567' });
    expect(doc).toMatchObject({ bookingId: 'b1', sourceMessageId: 'SM123', mediaUrls: ['https://x/1.jpg'] });
    expect(doc.ai).toEqual({ category: 'plumbing', priority: 'High', emergencyClass: 'water', confidence: 0.9 });
  });

  it('never emits an undefined value, even nested — Firestore rejects them', () => {
    const doc = buildIntakeItemPayload({
      ...brainDump,
      propertyId: undefined,
      propertyAddress: undefined,
      mediaUrls: [],
      ai: { category: 'hvac', priority: 'Low', confidence: 0.2, duplicateOfIntakeId: undefined },
    });
    const walk = (v: unknown): boolean =>
      v === undefined ? false : v && typeof v === 'object' ? Object.values(v).every(walk) : true;
    expect(walk(doc)).toBe(true);
    expect('mediaUrls' in doc).toBe(false);
    expect('propertyId' in doc).toBe(false);
  });

  it('writes the emergency assignment only on an emergency', () => {
    const extra = { assignedTechId: 't1', scheduledDate: '2026-10-06' };
    expect('assignedTechId' in buildIntakeItemPayload({ ...brainDump, ...extra })).toBe(false);
    expect(buildIntakeItemPayload({ ...brainDump, ...extra, emergency: true })).toMatchObject(extra);
  });

  it("keeps an explicit '' checklistTemplateId (no checklist) but drops undefined", () => {
    expect(buildIntakeItemPayload({ ...brainDump, checklistTemplateId: '' }).checklistTemplateId).toBe('');
    expect('checklistTemplateId' in buildIntakeItemPayload(brainDump)).toBe(false);
  });
});

describe('normalizeIntakeItem', () => {
  const legacy = {
    orgId: 'o1',
    propertyId: 'p1',
    requestedByUid: 'u1',
    source: 'pm',
    text: 'x',
    persistMode: 'workOrders',
    emergency: false,
    status: 'dead-letter',
    attemptCount: 3,
    receivedAt: 1,
  };

  it('derives reporter and triage for a pre-733 brain-dump doc', () => {
    const item = normalizeIntakeItem(legacy, 'i1');
    expect(item.id).toBe('i1');
    expect(item.source).toBe('pm');
    expect(item.reporter).toEqual({ kind: 'staff', id: 'u1' });
    expect(item.triage).toBe('accepted');
    // The processing lifecycle is untouched.
    expect(item.status).toBe('dead-letter');
    expect(item.attemptCount).toBe(3);
  });

  it('round-trips a doc written by the builder', () => {
    const doc = buildIntakeItemPayload({ orgId: 'o1', source: 'relay', text: 'x', now: 1, reporter: { kind: 'cleaner', id: 'c1' } });
    const item = normalizeIntakeItem(doc, 'i2');
    expect(item.reporter).toEqual({ kind: 'cleaner', id: 'c1' });
    expect(item.triage).toBe('pending');
    expect(item.source).toBe('relay');
  });

  it('falls back to safe defaults on missing or garbage fields', () => {
    const item = normalizeIntakeItem({ orgId: 'o1', source: 'nope', triage: 'maybe', status: 42 }, 'i3');
    expect(item.source).toBe('dispatch');
    expect(item.triage).toBe('accepted');
    expect(item.status).toBe('pending-retry');
    expect(item.attemptCount).toBe(0);
    expect(item.persistMode).toBe('workOrders');
    expect(item.emergency).toBe(false);
    expect(item.reporter).toEqual({ kind: 'staff' });
  });
});
