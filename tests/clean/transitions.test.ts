import { describe, it, expect } from 'vitest';
import {
  assertBookingTransition,
  assertPaymentTransition,
  assertAssignmentTransition,
  assertLeadTransition,
  canCheckIn,
  woStatusForBookingStatus,
  CleanTransitionError,
  PREAUTH_ELIGIBLE_STATUSES,
} from '../../src/clean/transitions';

describe('booking transitions', () => {
  it('allows the happy path', () => {
    expect(() => assertBookingTransition('booked', 'assigned')).not.toThrow();
    expect(() => assertBookingTransition('assigned', 'in_progress')).not.toThrow();
    expect(() => assertBookingTransition('in_progress', 'completed')).not.toThrow();
    expect(() => assertBookingTransition('completed', 'closed')).not.toThrow();
  });

  it('allows decline re-flagging and hold/release', () => {
    expect(() => assertBookingTransition('assigned', 'booked')).not.toThrow();
    expect(() => assertBookingTransition('booked', 'on_hold')).not.toThrow();
    expect(() => assertBookingTransition('on_hold', 'assigned')).not.toThrow();
  });

  it('rejects illegal jumps and exits from terminal states', () => {
    expect(() => assertBookingTransition('booked', 'completed')).toThrow(CleanTransitionError);
    expect(() => assertBookingTransition('closed', 'booked')).toThrow(CleanTransitionError);
    expect(() => assertBookingTransition('canceled', 'booked')).toThrow(CleanTransitionError);
    expect(() => assertBookingTransition('completed', 'canceled')).toThrow(CleanTransitionError);
  });

  it('maps statuses onto Kanban columns (on_hold keeps its column)', () => {
    expect(woStatusForBookingStatus('booked')).toBe('Backlog');
    expect(woStatusForBookingStatus('assigned')).toBe('Scheduled');
    expect(woStatusForBookingStatus('in_progress')).toBe('In Progress');
    expect(woStatusForBookingStatus('completed')).toBe('Review');
    expect(woStatusForBookingStatus('closed')).toBe('Completed');
    expect(woStatusForBookingStatus('canceled')).toBe('Cancelled');
    expect(woStatusForBookingStatus('on_hold')).toBeNull();
  });
});

describe('payment transitions', () => {
  it('supports vault → preauth → capture and charge-now', () => {
    expect(() => assertPaymentTransition('pending', 'vaulted')).not.toThrow();
    expect(() => assertPaymentTransition('vaulted', 'preauthorized')).not.toThrow();
    expect(() => assertPaymentTransition('preauthorized', 'captured')).not.toThrow();
    expect(() => assertPaymentTransition('vaulted', 'captured')).not.toThrow();
  });

  it('supports failure/retry/risk and void back to vaulted', () => {
    expect(() => assertPaymentTransition('vaulted', 'preauth_failed')).not.toThrow();
    expect(() => assertPaymentTransition('preauth_failed', 'retrying')).not.toThrow();
    expect(() => assertPaymentTransition('retrying', 'risk')).not.toThrow();
    expect(() => assertPaymentTransition('risk', 'captured')).not.toThrow();
    expect(() => assertPaymentTransition('preauthorized', 'vaulted')).not.toThrow();
  });

  it('rejects capture from pending and any exit from refunded', () => {
    expect(() => assertPaymentTransition('pending', 'captured')).toThrow(CleanTransitionError);
    expect(() => assertPaymentTransition('refunded', 'captured')).toThrow(CleanTransitionError);
  });

  it('pre-auth worker eligibility covers vaulted + retrying only', () => {
    expect(PREAUTH_ELIGIBLE_STATUSES).toEqual(['vaulted', 'retrying']);
  });
});

describe('assignment transitions', () => {
  it('follows assigned → notified → accepted; declined is terminal', () => {
    expect(() => assertAssignmentTransition('assigned', 'notified')).not.toThrow();
    expect(() => assertAssignmentTransition('notified', 'accepted')).not.toThrow();
    expect(() => assertAssignmentTransition('declined', 'accepted')).toThrow(CleanTransitionError);
  });

  it('permits check-in on any live status only', () => {
    expect(canCheckIn('assigned')).toBe(true);
    expect(canCheckIn('notified')).toBe(true);
    expect(canCheckIn('accepted')).toBe(true);
    expect(canCheckIn('declined')).toBe(false);
    expect(canCheckIn('removed')).toBe(false);
  });
});

describe('lead transitions', () => {
  it('open → contacted → converted; terminal states locked', () => {
    expect(() => assertLeadTransition('open', 'contacted')).not.toThrow();
    expect(() => assertLeadTransition('contacted', 'converted')).not.toThrow();
    expect(() => assertLeadTransition('converted', 'dead')).toThrow(CleanTransitionError);
  });
});
