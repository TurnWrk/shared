import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_CATALOGS,
  HOSTFIX_ADMIN_CATALOG,
  HOSTFIX_VENDOR_CATALOG,
  RESTOCK_ADMIN_CATALOG,
  CLEAN_OPERATOR_CATALOG,
  allCatalogTourIds,
  catalogById,
  type OnboardingCatalog,
  type TourDefinition,
  type ChecklistItemDefinition,
} from '../src/onboarding';

const TOUR_ID_RE = /^(hostfix|restock|clean):[a-z0-9-]+$/;
const ADVANCE_ON = new Set(['next', 'click', 'predicate']);
const PLACEMENTS = new Set(['top', 'bottom', 'left', 'right', 'auto', undefined]);

function assertTourShape(tour: TourDefinition, catalogId: string): void {
  expect(tour.id, `${catalogId} tour id`).toMatch(TOUR_ID_RE);
  expect(tour.version).toBeGreaterThanOrEqual(1);
  expect(['mount', 'surface', 'manual']).toContain(tour.trigger);
  expect(tour.steps.length).toBeGreaterThan(0);
  for (const step of tour.steps) {
    expect(step.id.length).toBeGreaterThan(0);
    expect(step.anchor.length).toBeGreaterThan(0);
    expect(step.title.length).toBeGreaterThan(0);
    expect(step.body.length).toBeGreaterThan(0);
    expect(ADVANCE_ON.has(step.advanceOn)).toBe(true);
    expect(PLACEMENTS.has(step.placement)).toBe(true);
  }
}

function assertChecklistShape(item: ChecklistItemDefinition, catalogId: string): void {
  expect(item.id.length, `${catalogId} checklist id`).toBeGreaterThan(0);
  expect(item.label.length).toBeGreaterThan(0);
  expect(item.href.length).toBeGreaterThan(0);
  expect(item.signal.length).toBeGreaterThan(0);
  if (item.tourId) {
    expect(item.tourId).toMatch(TOUR_ID_RE);
  }
}

describe('onboarding catalogs (TURNWRK-196)', () => {
  it('exports the four v1 personas from §4', () => {
    expect(ONBOARDING_CATALOGS.map((c) => c.id).sort()).toEqual([
      'clean-operator',
      'hostfix-admin',
      'hostfix-vendor',
      'restock-admin',
    ]);
    expect(catalogById('hostfix-admin')).toBe(HOSTFIX_ADMIN_CATALOG);
  });

  it('hostfix vendor has tours but no checklist', () => {
    expect(HOSTFIX_VENDOR_CATALOG.checklist).toEqual([]);
    expect(HOSTFIX_VENDOR_CATALOG.tours.map((t) => t.id)).toEqual([
      'hostfix:vendor-orientation',
      'hostfix:vendor-work-order-lifecycle',
    ]);
  });

  it('every catalog has valid shapes, namespaced tour ids, and unique ids', () => {
    const seenTourIds = new Set<string>();
    const seenCatalogIds = new Set<string>();

    for (const catalog of ONBOARDING_CATALOGS as OnboardingCatalog[]) {
      expect(seenCatalogIds.has(catalog.id)).toBe(false);
      seenCatalogIds.add(catalog.id);
      expect(['hostfix', 'restock', 'clean']).toContain(catalog.app);
      expect(['admin', 'vendor', 'operator']).toContain(catalog.persona);
      expect(catalog.killSwitchKey).toMatch(/:tours-off$/);

      for (const tour of catalog.tours) {
        assertTourShape(tour, catalog.id);
        expect(tour.id.startsWith(`${catalog.app}:`)).toBe(true);
        expect(seenTourIds.has(tour.id), `duplicate tour ${tour.id}`).toBe(false);
        seenTourIds.add(tour.id);
      }

      const checklistIds = new Set<string>();
      for (const item of catalog.checklist) {
        assertChecklistShape(item, catalog.id);
        expect(checklistIds.has(item.id)).toBe(false);
        checklistIds.add(item.id);
        if (item.tourId) {
          expect(
            catalog.tours.some((t) => t.id === item.tourId),
            `${item.id} tourId must exist in same catalog`,
          ).toBe(true);
        }
      }
    }

    expect(allCatalogTourIds()).toEqual([...seenTourIds].sort());
  });

  it('matches framework tour roster', () => {
    expect(HOSTFIX_ADMIN_CATALOG.tours.map((t) => t.id)).toEqual([
      'hostfix:dispatch-orientation',
      'hostfix:create-work-order',
    ]);
    expect(RESTOCK_ADMIN_CATALOG.tours.map((t) => t.id)).toEqual([
      'restock:first-supply-list',
      'restock:invite-cleaner-and-qr',
    ]);
    expect(CLEAN_OPERATOR_CATALOG.tours.map((t) => t.id)).toEqual(['clean:first-booking']);
    expect(HOSTFIX_ADMIN_CATALOG.checklist).toHaveLength(5);
    expect(RESTOCK_ADMIN_CATALOG.checklist).toHaveLength(6);
    expect(CLEAN_OPERATOR_CATALOG.checklist).toHaveLength(7);
  });
});
