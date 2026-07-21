import type { OnboardingCatalog } from '../types';

/**
 * hostfix vendor SPA (`/technician`) — ONBOARDING-FRAMEWORK.md §4.
 * No checklist (profile wizard covers setup). Overlay must register with
 * `useBackHandler` when wired (TURNWRK-204).
 */
export const HOSTFIX_VENDOR_CATALOG: OnboardingCatalog = {
  id: 'hostfix-vendor',
  app: 'hostfix',
  persona: 'vendor',
  killSwitchKey: 'hostfix:tours-off',
  checklist: [],
  tours: [
    {
      id: 'hostfix:vendor-orientation',
      trigger: 'mount',
      version: 1,
      steps: [
        // The center FAB doubles as the Home entry — the old separate "Homes"
        // step anchored the same element, so the two are folded into one.
        {
          id: 'home-fab',
          anchor: 'hostfix-vendor-fab',
          title: 'Home & quick actions',
          body: 'Your properties and their chats live here — and the button also logs a quick work order wherever you are.',
          placement: 'top',
          advanceOn: 'next',
        },
        {
          id: 'tab-schedule',
          anchor: 'hostfix-vendor-tab-schedule',
          title: 'Tasks',
          body: 'Upcoming work across the week.',
          placement: 'top',
          advanceOn: 'next',
        },
        {
          id: 'tab-route',
          anchor: 'hostfix-vendor-tab-route',
          title: 'Route',
          body: 'Today’s stops in order — useful when you’re on the road.',
          placement: 'top',
          advanceOn: 'next',
        },
        {
          id: 'tab-pay',
          anchor: 'hostfix-vendor-tab-pay',
          title: 'Pay',
          body: 'Receipts and payouts for completed jobs.',
          placement: 'top',
          advanceOn: 'next',
        },
        {
          id: 'tab-account',
          anchor: 'hostfix-vendor-tab-account',
          title: 'Account',
          body: 'Profile, availability, and notifications — plus tour replays.',
          placement: 'top',
          advanceOn: 'next',
        },
      ],
    },
    {
      id: 'hostfix:vendor-work-order-lifecycle',
      trigger: 'surface',
      version: 1,
      zeroCompletionsSignal: 'zeroCompletedWorkOrders',
      steps: [
        {
          id: 'accept',
          anchor: 'hostfix-vendor-accept-job',
          title: 'Accept the job',
          body: 'Confirm you’ll take this work order before heading over.',
          placement: 'bottom',
          advanceOn: 'click',
        },
        {
          id: 'start',
          anchor: 'hostfix-vendor-start-job',
          title: 'Start work',
          body: 'Tap Start when you begin so the dispatcher sees you’re on site.',
          placement: 'bottom',
          advanceOn: 'click',
        },
        {
          id: 'finish',
          anchor: 'hostfix-vendor-finish-job',
          title: 'Finish & photos',
          body: 'Mark complete from the work dock and attach proof photos.',
          placement: 'top',
          advanceOn: 'click',
        },
      ],
    },
  ],
};
