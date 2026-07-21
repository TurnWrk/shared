import type { OnboardingCatalog, TourId } from '../types';
import { CLEAN_OPERATOR_CATALOG } from './cleanOperator';
import { HOSTFIX_ADMIN_CATALOG } from './hostfixAdmin';
import { HOSTFIX_VENDOR_CATALOG } from './hostfixVendor';
import { RESTOCK_ADMIN_CATALOG } from './restockAdmin';

export { HOSTFIX_ADMIN_CATALOG } from './hostfixAdmin';
export { HOSTFIX_VENDOR_CATALOG } from './hostfixVendor';
export { RESTOCK_ADMIN_CATALOG } from './restockAdmin';
export { CLEAN_OPERATOR_CATALOG } from './cleanOperator';

/** All v1 catalogs (TURNWRK-196). */
export const ONBOARDING_CATALOGS: readonly OnboardingCatalog[] = [
  HOSTFIX_ADMIN_CATALOG,
  HOSTFIX_VENDOR_CATALOG,
  RESTOCK_ADMIN_CATALOG,
  CLEAN_OPERATOR_CATALOG,
];

/** Every tour id declared across catalogs (stable for fixtures / e2e). */
export function allCatalogTourIds(): TourId[] {
  const ids = new Set<TourId>();
  for (const catalog of ONBOARDING_CATALOGS) {
    for (const tour of catalog.tours) {
      ids.add(tour.id);
    }
  }
  return [...ids].sort();
}

export function catalogById(id: string): OnboardingCatalog | undefined {
  return ONBOARDING_CATALOGS.find((c) => c.id === id);
}
