/**
 * Service catalog types (Verticals C2 — TURNWRK-321).
 *
 * Extracted from src/types/clean.ts. Pricing and duration already carried ZERO
 * cleaning logic — this is the shared core wearing a Clean name.
 *
 * Frequencies (`CleanFrequencyKey`, `CleanFrequency`, `DEFAULT_CLEAN_FREQUENCIES`)
 * deliberately stay in types/clean.ts for now: shared#14 (TURNWRK-318) is
 * actively opening that union, and moving it here would guarantee a conflict.
 * They come across with a later extraction.
 */
import type { CleanFrequency, CleanPaymentPolicy } from '../types/clean';

export type ServiceMode = 'residential' | 'str' | 'both';

/** A ± stepper row on the wizard ("Bedrooms", "Full Baths", …). */
export interface PricingParam {
  id: string;
  label: string;
  unitPriceMinor: number;
  unitMinutes: number;
  min: number;
  max: number;
  sort: number;
}

export interface ServiceOffering {
  id: string;
  name: string;
  description?: string;
  basePriceMinor: number;
  baseMinutes: number;
  mode: ServiceMode;
  active: boolean;
  /** Optional cmms_pmTemplates doc id — attaches a checklist to jobs. */
  checklistTemplateId?: string;
  params: PricingParam[];
  /** Which org extras are offered for this service. */
  extraIds: string[];
  /** Per-service payment-policy override (e.g. commercial services on terms). */
  paymentPolicy?: CleanPaymentPolicy;
}

export interface ServiceExtra {
  id: string;
  label: string;
  priceMinor: number;
  minutes: number;
  /** When true the wizard shows a qty stepper ("Carpets ×3"). */
  qtyEnabled: boolean;
  description?: string;
}

export interface ServiceDiscountCode {
  /** Whole percent off the subtotal. Mutually exclusive with fixedMinor. */
  pct?: number;
  /** Fixed amount off in minor units. */
  fixedMinor?: number;
  active: boolean;
}

/**
 * The org's whole service catalog as ONE doc — a single read serves the
 * booking widget and edits are atomic. Catalogs are small (well under the
 * 1 MiB doc limit). Prices/labels are snapshotted onto bookings, so editing
 * the catalog never mutates history.
 */
export interface ServiceCatalog {
  orgId: string;
  services: ServiceOffering[];
  extras: ServiceExtra[];
  frequencies: CleanFrequency[];
  /** Keyed by uppercase code. */
  discountCodes?: Record<string, ServiceDiscountCode>;
  updatedAt: number;
}
