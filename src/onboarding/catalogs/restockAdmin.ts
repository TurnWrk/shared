import type { OnboardingCatalog } from '../types';

/**
 * restock org admin — ONBOARDING-FRAMEWORK.md §4.
 * Cleaner inspect onboarding stays `full_checklist` mode (no tour here).
 */
export const RESTOCK_ADMIN_CATALOG: OnboardingCatalog = {
  id: 'restock-admin',
  app: 'restock',
  persona: 'admin',
  killSwitchKey: 'restock:tours-off',
  checklist: [
    {
      id: 'first-property',
      label: 'Add first property',
      description: 'Homes that need supply lists and inspect QR codes.',
      href: '/properties',
      signal: 'properties>=1',
    },
    {
      id: 'first-supply-list',
      label: 'Build a supply list',
      description: 'Generate the products cleaners check on turnover.',
      href: '/dashboard/products?tour=restock:first-supply-list',
      tourId: 'restock:first-supply-list',
      signal: 'supplyLists>=1',
    },
    {
      id: 'set-par-levels',
      label: 'Set par levels',
      description: 'Target stock counts per property.',
      href: '/properties',
      signal: 'propertyHasPars',
    },
    {
      id: 'invite-cleaner',
      label: 'Invite a cleaner',
      description: 'Someone who runs inspect and resupply from their phone.',
      href: '/dashboard/cleaners?tour=restock:invite-cleaner-and-qr',
      tourId: 'restock:invite-cleaner-and-qr',
      signal: 'cleaners>=1',
    },
    {
      id: 'share-inspect-qr',
      label: 'Share the inspect QR',
      description: 'Give cleaners a link or QR to start an inspect.',
      href: '/properties',
      signal: 'inspectShareExists',
    },
    {
      id: 'first-resupply-request',
      label: 'First resupply request',
      description: 'Waiting on your cleaner until the first request lands.',
      href: '/inbox',
      signal: 'requests>=1',
    },
  ],
  tours: [
    {
      id: 'restock:first-supply-list',
      trigger: 'surface',
      version: 1,
      zeroCompletionsSignal: 'zeroSupplyLists',
      steps: [
        {
          id: 'open-generator',
          anchor: 'restock-supply-list-generator',
          title: 'Master supply list',
          body: 'Curate the products cleaners see — one pick per tier per item type.',
          placement: 'bottom',
          advanceOn: 'next',
        },
        {
          id: 'pick-products',
          anchor: 'restock-supply-list-property',
          title: 'Pick products',
          body: 'Choose budget, mid, and premium picks so inspect stays accurate.',
          placement: 'bottom',
          advanceOn: 'click',
        },
        {
          id: 'confirm-list',
          anchor: 'restock-supply-list-confirm',
          title: 'Add item types',
          body: 'Add rows as you grow the catalog — then set pars and share QR.',
          placement: 'top',
          advanceOn: 'click',
        },
      ],
    },
    {
      id: 'restock:invite-cleaner-and-qr',
      trigger: 'surface',
      version: 1,
      zeroCompletionsSignal: 'zeroCleaners',
      steps: [
        {
          id: 'cleaners-view',
          anchor: 'restock-cleaners-view',
          title: 'Cleaners',
          body: 'Invite the people who inspect and request resupply.',
          placement: 'bottom',
          advanceOn: 'next',
        },
        {
          id: 'invite',
          anchor: 'restock-invite-cleaner',
          title: 'Send an invite',
          body: 'Add their email — they’ll get access to inspect for your homes.',
          placement: 'bottom',
          advanceOn: 'click',
        },
        {
          id: 'share-qr',
          anchor: 'restock-share-inspect-qr',
          title: 'Share inspect QR',
          body: 'Open a property and generate or copy the QR so they can inspect on site.',
          placement: 'left',
          advanceOn: 'click',
        },
      ],
    },
  ],
};
