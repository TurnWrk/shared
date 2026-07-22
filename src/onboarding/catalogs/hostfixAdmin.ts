import type { OnboardingCatalog } from '../types';

/**
 * hostfix org admin / dispatcher — ONBOARDING-FRAMEWORK.md §4.
 * Anchors are `data-tour` values wired in TURNWRK-200+.
 */
export const HOSTFIX_ADMIN_CATALOG: OnboardingCatalog = {
  id: 'hostfix-admin',
  app: 'hostfix',
  persona: 'admin',
  killSwitchKey: 'hostfix:tours-off',
  checklist: [
    {
      id: 'first-property',
      label: 'Add first property',
      description: 'Homes you dispatch work against.',
      href: '/dispatch?view=properties',
      signal: 'properties>=1',
    },
    {
      id: 'invite-vendor',
      label: 'Invite a vendor',
      description: 'Technicians and cleaners who take jobs.',
      href: '/dispatch?view=vendors-and-team',
      signal: 'vendors>=1',
    },
    {
      id: 'first-work-order',
      label: 'Create first work order',
      description: 'Walk through creating and assigning a job.',
      href: '/dispatch?tour=hostfix:create-work-order',
      tourId: 'hostfix:create-work-order',
      signal: 'workOrders>=1',
    },
    {
      id: 'invite-teammate',
      label: 'Invite a teammate',
      description: 'Another dispatcher or org admin.',
      href: '/dispatch?view=vendors-and-team',
      signal: 'members>1',
    },
    {
      id: 'review-org-settings',
      label: 'Review org settings',
      description: 'Timezone, branding, and defaults.',
      // The real org-settings surface — NOT the dispatch ?view=settings tab
      // (that renders API tokens/Mercury); the visit marker writes here.
      href: '/settings/organization',
      signal: 'visited-org-settings',
    },
  ],
  tours: [
    {
      id: 'hostfix:dispatch-orientation',
      trigger: 'mount',
      version: 1,
      steps: [
        {
          id: 'nav-board',
          anchor: 'hostfix-nav-board',
          title: 'Dispatch board',
          body: 'Work orders live here — drag cards between columns as jobs move.',
          placement: 'right',
          advanceOn: 'next',
        },
        {
          id: 'nav-properties',
          anchor: 'hostfix-nav-properties',
          title: 'Properties',
          body: 'Your homes and units. Add addresses before assigning jobs.',
          placement: 'right',
          advanceOn: 'next',
        },
        {
          id: 'nav-vendors-team',
          anchor: 'hostfix-nav-vendors-and-team',
          title: 'Vendors & team',
          body: 'Invite technicians, cleaners, and other admins.',
          placement: 'right',
          advanceOn: 'next',
        },
        {
          id: 'nav-settings',
          anchor: 'hostfix-nav-settings',
          title: 'Settings',
          body: 'Org defaults, timezone, and integrations.',
          placement: 'right',
          advanceOn: 'next',
        },
        {
          id: 'create-wo-button',
          anchor: 'hostfix-create-work-order',
          title: 'Create a work order',
          body: 'Start here when something needs fixing or a turnover clean.',
          placement: 'bottom',
          advanceOn: 'next',
        },
      ],
    },
    {
      id: 'hostfix:create-work-order',
      trigger: 'surface',
      version: 1,
      zeroCompletionsSignal: 'zeroWorkOrders',
      steps: [
        {
          id: 'pick-property',
          anchor: 'hostfix-create-wo-property',
          title: 'Pick a property',
          body: 'Choose which home this job is for.',
          placement: 'bottom',
          advanceOn: 'click',
        },
        {
          id: 'describe',
          anchor: 'hostfix-create-wo-description',
          title: 'Describe the work',
          body: 'A short title and notes help your vendor show up prepared.',
          placement: 'bottom',
          advanceOn: 'click',
        },
        {
          id: 'assign',
          anchor: 'hostfix-create-wo-assign',
          title: 'Assign a vendor',
          body: 'Optional now — you can assign later from the board.',
          placement: 'bottom',
          advanceOn: 'click',
        },
        {
          id: 'submit',
          anchor: 'hostfix-create-wo-submit',
          title: 'Create the card',
          body: 'Submit to place it on the dispatch board.',
          placement: 'top',
          advanceOn: 'click',
        },
        {
          id: 'on-board',
          anchor: 'hostfix-nav-board',
          title: 'On the board',
          body: 'Your new work order appears here. Drag it as status changes.',
          placement: 'right',
          advanceOn: 'next',
        },
      ],
    },
  ],
};
