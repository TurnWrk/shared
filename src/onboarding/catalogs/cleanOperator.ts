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
      href: '/app/services',
      signal: 'services>=1',
    },
    {
      id: 'booking-slug-policy',
      label: 'Set booking slug & payment policy',
      description: 'Public site URL and how you collect payment.',
      href: '/app/settings',
      signal: 'bookingSiteSlugSet',
    },
    {
      id: 'branding',
      label: 'Add branding',
      description: 'Logo and accent color on the booking site.',
      href: '/app/settings/branding',
      signal: 'brandingSet',
    },
    {
      id: 'notification-templates',
      label: 'Review notification templates',
      description: 'Confirm SMS/email copy for booking events.',
      href: '/app/settings/communications',
      signal: 'visited-notification-templates',
    },
    {
      id: 'add-contractor-or-teammate',
      label: 'Add a contractor or teammate',
      description: 'Someone who can take assignments.',
      href: '/app/team',
      signal: 'contractorsOrMembers',
    },
    {
      id: 'share-booking-link',
      label: 'Share your booking link',
      description: 'Copy the public URL for guests and owners.',
      href: '/app/settings',
      signal: 'visited-share-booking-link',
    },
    {
      id: 'first-booking',
      label: 'First booking on the books',
      description: 'Create one manually or wait for a public booking.',
      href: '/app/bookings?tour=clean:first-booking',
      tourId: 'clean:first-booking',
      signal: 'bookings>=1',
    },
  ],
  tours: [
    {
      // Orientation over the AppShell sidebar (desktop only — mobile nav is a
      // hamburger sheet). `surface`-triggered: the AppShell-level host arms it
      // when the desktop nav is visible; the checklist remains clean's primary
      // onboarding (this tour is a light nav layer on top).
      id: 'clean:operator-orientation',
      trigger: 'surface',
      version: 1,
      steps: [
        {
          id: 'nav-bookings',
          anchor: 'clean-nav-bookings',
          title: 'Bookings',
          body: 'The day-to-day queue — every job from booked to paid.',
          placement: 'right',
          advanceOn: 'next',
        },
        {
          id: 'nav-scheduler',
          anchor: 'clean-nav-scheduler',
          title: 'Scheduler',
          body: 'Calendar view of who cleans what, when.',
          placement: 'right',
          advanceOn: 'next',
        },
        {
          id: 'nav-payments',
          anchor: 'clean-nav-payments',
          title: 'Payments',
          body: 'Job payments, invoices, and dunning in one place.',
          placement: 'right',
          advanceOn: 'next',
        },
        {
          id: 'nav-services',
          anchor: 'clean-nav-services',
          title: 'Services',
          body: 'What customers can book — pricing and duration.',
          placement: 'right',
          advanceOn: 'next',
        },
        {
          id: 'nav-settings',
          anchor: 'clean-nav-settings',
          title: 'Settings',
          body: 'Booking site, branding, payment policy, and templates.',
          placement: 'right',
          advanceOn: 'next',
        },
      ],
    },
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
          id: 'fill-details',
          anchor: 'clean-assign-panel',
          title: 'Fill in the booking',
          body: 'Pick the customer, service, and schedule — assign cleaners from the booking detail after you save.',
          placement: 'left',
          advanceOn: 'next',
        },
        {
          id: 'confirm',
          anchor: 'clean-booking-confirm',
          title: 'Save the booking',
          body: 'Confirm — it appears on your schedule. Open it afterward to assign who cleans.',
          placement: 'top',
          advanceOn: 'click',
        },
      ],
    },
  ],
};
