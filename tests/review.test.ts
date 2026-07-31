import { describe, it, expect } from 'vitest';
import {
  DEFAULT_REVIEW_THRESHOLD,
  DEFAULT_REVIEW_DELAY_HOURS,
  routeReview,
  validateRating,
  reviewRequestedAt,
  resolveReviewParty,
  reviewActorId,
  buildReviewRequest,
} from '../src/review';
import type { Review } from '../src/review';

describe('routeReview', () => {
  it('routes at/above the threshold to a public prompt', () => {
    expect(routeReview(4)).toBe('public_prompt');
    expect(routeReview(5)).toBe('public_prompt');
  });
  it('routes below the threshold to a private alert', () => {
    expect(routeReview(3)).toBe('private_alert');
    expect(routeReview(1)).toBe('private_alert');
  });
  it('honours a custom threshold', () => {
    expect(routeReview(4, 5)).toBe('private_alert');
    expect(routeReview(5, 5)).toBe('public_prompt');
  });
});

describe('validateRating', () => {
  it('rounds a fractional rating', () => {
    expect(validateRating(4.4)).toBe(4);
    expect(validateRating(4.6)).toBe(5);
  });
  it('throws when out of the 1..5 range', () => {
    expect(() => validateRating(0)).toThrow();
    expect(() => validateRating(6)).toThrow();
  });
});

describe('reviewRequestedAt', () => {
  it('adds the default delay', () => {
    expect(reviewRequestedAt(0)).toBe(DEFAULT_REVIEW_DELAY_HOURS * 3_600_000);
  });
  it('adds a custom delay', () => {
    expect(reviewRequestedAt(1_000, 2)).toBe(1_000 + 2 * 3_600_000);
  });
});

describe('resolveReviewParty (dual-read)', () => {
  it('prefers the new party', () => {
    const party = { customerId: 'c1', name: 'Jo' };
    expect(resolveReviewParty({ party, customerId: 'legacy' })).toBe(party);
  });
  it('synthesizes a party from the legacy customerId', () => {
    expect(resolveReviewParty({ customerId: 'legacy' })).toEqual({ customerId: 'legacy' });
  });
  it('returns an empty party when nothing is known (honest gap)', () => {
    expect(resolveReviewParty({})).toEqual({});
  });
});

describe('reviewActorId', () => {
  it('uses the new party customer', () => {
    expect(reviewActorId({ party: { customerId: 'c1' } })).toBe('customer:c1');
  });
  it('falls back to the legacy customerId', () => {
    expect(reviewActorId({ customerId: 'legacy' })).toBe('customer:legacy');
  });
  it('degrades to anonymous when no customer is known', () => {
    expect(reviewActorId({ party: { name: 'Walk-in' } })).toBe('party:anonymous');
    expect(reviewActorId({})).toBe('party:anonymous');
  });
});

describe('buildReviewRequest', () => {
  it('keys a new request on jobRef + party', () => {
    const doc = buildReviewRequest({
      orgId: 'o1',
      token: 'tok',
      now: 1_000,
      jobRef: { app: 'service', collection: 'svc_bookings', id: 'b1' },
      party: { customerId: 'c1', email: 'c@x.com' },
    });
    expect(doc.jobRef).toEqual({ app: 'service', collection: 'svc_bookings', id: 'b1' });
    expect(doc.party).toEqual({ customerId: 'c1', email: 'c@x.com' });
    expect(doc.requestedAt).toBe(1_000 + DEFAULT_REVIEW_DELAY_HOURS * 3_600_000);
    expect(doc.createdAt).toBe(1_000);
    expect(doc.updatedAt).toBe(1_000);
  });

  it('carries the legacy bookingId/customerId when supplied', () => {
    const doc = buildReviewRequest({
      orgId: 'o1',
      token: 'tok',
      now: 0,
      bookingId: 'bk1',
      customerId: 'c1',
    });
    expect(doc.bookingId).toBe('bk1');
    expect(doc.customerId).toBe('c1');
  });

  it('prunes undefined so no invalid field reaches Firestore', () => {
    const doc = buildReviewRequest({ orgId: 'o1', token: 'tok', now: 0 });
    expect(Object.values(doc).every((v) => v !== undefined)).toBe(true);
    expect('jobRef' in doc).toBe(false);
    expect('party' in doc).toBe(false);
    expect('bookingId' in doc).toBe(false);
  });

  it('drops an all-undefined party rather than persisting an empty object', () => {
    const doc = buildReviewRequest({
      orgId: 'o1',
      token: 'tok',
      now: 0,
      party: { customerId: undefined, name: undefined },
    });
    expect('party' in doc).toBe(false);
  });

  it('shapes a doc that satisfies the Review contract once an id is added', () => {
    const doc = buildReviewRequest({ orgId: 'o1', token: 'tok', now: 5 });
    const review: Review = { id: 'r1', ...doc };
    expect(review.token).toBe('tok');
    expect(review.rating).toBeUndefined();
  });
});
