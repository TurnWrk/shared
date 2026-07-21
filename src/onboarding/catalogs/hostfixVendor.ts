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
        {
          id: 'tab-homes',
          anchor: 'hostfix-vendor-tab-homes',
          title: 'Homes',
          body: 'Properties assigned to you and upcoming jobs at each.',
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
          id: 'tab-schedule',
          anchor: 'hostfix-vendor-tab-schedule',
          title: 'Schedule',
          body: 'Upcoming work across the week.',
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
          id: 'fab',
          anchor: 'hostfix-vendor-fab',
          title: 'Quick actions',
          body: 'Create a quick work order or jump to common tools from here.',
          placement: 'left',
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
