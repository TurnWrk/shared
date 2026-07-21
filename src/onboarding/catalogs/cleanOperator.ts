import type { OnboardingCatalog } from '../types';

/**
 * clean operator admin — checklist-first (ONBOARDING-FRAMEWORK.md §4).
 * Stripe provider config is env-only — not an org-facing checklist step.
 */
export const CLEAN_OPERATOR_CATALOG: OnboardingCatalog = {
  id: 'clean-operator',
  app: 'clean',
  persona: 'operator',
  killSwitchKey: 'clean:tours-off',
  checklist: [
    {
      id: 'create-services',
      label: 'Create your services',
      description: 'What customers book — pricing and duration.',
      href: '/catalog',
      signal: 'services>=1',
    },
    {
      id: 'booking-slug-policy',
      label: 'Set booking slug & payment policy',
      description: 'Public site URL and how you collect payment.',
      href: '/settings',
      signal: 'bookingSiteSlugSet',
    },
    {
      id: 'branding',
      label: 'Add branding',
      description: 'Logo and accent color on the booking site.',
      href: '/settings/branding',
      signal: 'brandingSet',
    },
    {
      id: 'notification-templates',
      label: 'Review notification templates',
      description: 'Confirm SMS/email copy for booking events.',
      href: '/settings/notifications',
      signal: 'visited-notification-templates',
    },
    {
      id: 'add-contractor-or-teammate',
      label: 'Add a contractor or teammate',
      description: 'Someone who can take assignments.',
      href: '/team',
      signal: 'contractorsOrMembers',
    },
    {
      id: 'share-booking-link',
      label: 'Share your booking link',
      description: 'Copy the public URL for guests and owners.',
      href: '/settings',
      signal: 'visited-share-booking-link',
    },
    {
      id: 'first-booking',
      label: 'First booking on the books',
      description: 'Create one manually or wait for a public booking.',
      href: '/bookings?tour=clean:first-booking',
      tourId: 'clean:first-booking',
      signal: 'bookings>=1',
    },
  ],
  tours: [
    {
      id: 'clean:first-booking',
      trigger: 'surface',
      version: 1,
      zeroCompletionsSignal: 'zeroBookings',
      steps: [
        {
          id: 'add-booking',
          anchor: 'clean-add-booking',
          title: 'Add a booking',
          body: 'Create a job on the books when a guest or owner books offline.',
          placement: 'bottom',
          advanceOn: 'click',
        },
        {
          id: 'assign',
          anchor: 'clean-assign-panel',
          title: 'Assign who cleans',
          body: 'Pick a contractor or teammate from the assign panel.',
          placement: 'left',
          advanceOn: 'click',
        },
        {
          id: 'confirm',
          anchor: 'clean-booking-confirm',
          title: 'Confirm',
          body: 'Save — the booking appears on your schedule.',
          placement: 'top',
          advanceOn: 'click',
        },
      ],
    },
  ],
};
