import { describe, it, expect } from 'vitest';
import {
  shouldAutoStartTour,
  checklistProgress,
  completeTour,
  dismissTour,
  isTourSettled,
  isTourSuppressed,
  checklistPreferenceTourId,
  type TourDefinition,
  type ChecklistItemDefinition,
} from '../src/onboarding';

const orientation: TourDefinition = {
  id: 'hostfix:dispatch-orientation',
  trigger: 'mount',
  version: 1,
  steps: [
    {
      id: 'nav',
      anchor: 'dispatch-nav',
      title: 'Navigation',
      body: 'Board, properties, team.',
      advanceOn: 'next',
    },
  ],
};

const createWo: TourDefinition = {
  id: 'hostfix:create-work-order',
  trigger: 'surface',
  version: 1,
  zeroCompletionsSignal: 'zeroWorkOrders',
  steps: [
    {
      id: 'open',
      anchor: 'create-wo',
      title: 'Create',
      body: 'Start here.',
      advanceOn: 'click',
    },
  ],
};

const checklist: ChecklistItemDefinition[] = [
  {
    id: 'first-property',
    label: 'Add first property',
    href: '/properties',
    signal: 'hasProperty',
  },
  {
    id: 'first-wo',
    label: 'Create first work order',
    href: '/dispatch?tour=hostfix:create-work-order',
    tourId: 'hostfix:create-work-order',
    signal: 'hasWorkOrder',
  },
];

describe('isTourSuppressed', () => {
  it('treats any non-empty localStorage value as suppressed', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
    };
    expect(isTourSuppressed(storage, 'hostfix:tours-off')).toBe(false);
    store.set('hostfix:tours-off', '1');
    expect(isTourSuppressed(storage, 'hostfix:tours-off')).toBe(true);
    expect(isTourSuppressed(null, 'hostfix:tours-off')).toBe(false);
  });
});

describe('shouldAutoStartTour', () => {
  it('starts orientation once when unsettled and not suppressed', () => {
    expect(shouldAutoStartTour(orientation, undefined, {})).toBe(true);
    expect(
      shouldAutoStartTour(orientation, undefined, {}, { suppressed: true }),
    ).toBe(false);
    expect(
      shouldAutoStartTour(orientation, undefined, {}, { anotherTourActive: true }),
    ).toBe(false);
  });

  it('requires the zero-completions signal for workflow tours', () => {
    expect(shouldAutoStartTour(createWo, undefined, {})).toBe(false);
    expect(
      shouldAutoStartTour(createWo, undefined, { zeroWorkOrders: true }),
    ).toBe(true);
    expect(
      shouldAutoStartTour(createWo, undefined, { zeroWorkOrders: false }),
    ).toBe(false);
  });

  it('never auto-starts after complete or dismiss', () => {
    const completed = completeTour(undefined, createWo.id, 1, 1000);
    expect(
      shouldAutoStartTour(createWo, completed, { zeroWorkOrders: true }),
    ).toBe(false);
    const dismissed = dismissTour(undefined, createWo.id, 1, 1000);
    expect(
      shouldAutoStartTour(createWo, dismissed, { zeroWorkOrders: true }),
    ).toBe(false);
  });
});

describe('completeTour / dismissTour', () => {
  it('writes completedAt and clears dismissedAt', () => {
    const afterDismiss = dismissTour(undefined, 't1', 1, 10);
    const afterComplete = completeTour(afterDismiss, 't1', 2, 20);
    expect(isTourSettled(afterComplete, 't1')).toBe(true);
    expect(afterComplete.t1).toEqual({
      completedAt: 20,
      version: 2,
      dismissedAt: undefined,
    });
  });

  it('writes dismissedAt and clears completedAt', () => {
    const afterComplete = completeTour(undefined, 't1', 1, 10);
    const afterDismiss = dismissTour(afterComplete, 't1', 1, 20);
    expect(afterDismiss.t1).toEqual({
      dismissedAt: 20,
      version: 1,
      completedAt: undefined,
    });
  });
});

describe('checklistProgress', () => {
  it('derives percent from live signals', () => {
    expect(checklistProgress(checklist, {})).toEqual({
      total: 2,
      completed: 0,
      percent: 0,
      doneIds: [],
      remainingIds: ['first-property', 'first-wo'],
    });
    expect(
      checklistProgress(checklist, { hasProperty: true, hasWorkOrder: true }),
    ).toMatchObject({ completed: 2, percent: 100, remainingIds: [] });
    expect(checklistProgress(checklist, { hasProperty: true })).toMatchObject({
      completed: 1,
      percent: 50,
      doneIds: ['first-property'],
      remainingIds: ['first-wo'],
    });
  });

  it('returns 100% for an empty checklist', () => {
    expect(checklistProgress([], {})).toEqual({
      total: 0,
      completed: 0,
      percent: 100,
      doneIds: [],
      remainingIds: [],
    });
  });
});

describe('checklistPreferenceTourId', () => {
  it('namespaces the collapse preference as a pseudo-tour id', () => {
    expect(checklistPreferenceTourId('hostfix')).toBe('checklist:hostfix');
  });
});
