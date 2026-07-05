/**
 * Turnwrk Clean pricing engine — a pure function shared by the booking widget
 * (display) and server routes (authoritative). The server recomputes on every
 * mutation; clients never post a computed price.
 *
 * Formula (docs/projects/cleaning-app/02-ENGINEERING-SPEC.md §5.3):
 *   subtotal = service.basePriceMinor + Σ param.qty × unitPriceMinor
 *            + Σ extra.qty × priceMinor
 *   discount = round(subtotal × frequency.discountPct%) + discount code
 *   tax      = round((subtotal − discount) × taxPct%)
 *   total    = subtotal − discount + tax
 */

import type {
  CleanCatalog,
  CleanExtraSnapshot,
  CleanParamSnapshot,
  CleanQuote,
  CleanQuoteSelection,
} from '../types/clean';

export interface CleanQuoteContext {
  /** Org tax as a whole percent (e.g. 8.25). */
  taxPct: number;
  /** ISO 4217 currency code (e.g. 'USD'). */
  currency: string;
}

export class CleanQuoteError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'unknown_service'
      | 'inactive_service'
      | 'unknown_frequency'
      | 'unknown_extra'
      | 'invalid_discount_code',
  ) {
    super(message);
    this.name = 'CleanQuoteError';
  }
}

function pctOf(amountMinor: number, pct: number): number {
  return Math.round((amountMinor * pct) / 100);
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Math.trunc(value), min), max);

/**
 * Price a selection against a catalog. Throws CleanQuoteError on references
 * the catalog cannot resolve (unknown service/frequency/extra, inactive
 * service, bad discount code) — callers surface these as validation errors.
 *
 * Params omitted from the selection default to their catalog `min`; param ids
 * not in the service are ignored. Extras must be offered by the service.
 */
export function priceCleanQuote(
  catalog: CleanCatalog,
  selection: CleanQuoteSelection,
  context: CleanQuoteContext,
): CleanQuote {
  const service = catalog.services.find((s) => s.id === selection.serviceId);
  if (!service) {
    throw new CleanQuoteError(`Unknown service ${selection.serviceId}`, 'unknown_service');
  }
  if (!service.active) {
    throw new CleanQuoteError(`Service ${service.name} is inactive`, 'inactive_service');
  }

  const frequency = catalog.frequencies.find((f) => f.key === selection.frequencyKey);
  if (!frequency) {
    throw new CleanQuoteError(
      `Unknown frequency ${selection.frequencyKey}`,
      'unknown_frequency',
    );
  }

  const qtyById = new Map(selection.params.map((p) => [p.id, p.qty]));
  const paramsSnapshot: CleanParamSnapshot[] = [...service.params]
    .sort((a, b) => a.sort - b.sort)
    .map((param) => {
      const qty = clamp(qtyById.get(param.id) ?? param.min, param.min, param.max);
      return {
        paramId: param.id,
        label: param.label,
        qty,
        unitPriceMinor: param.unitPriceMinor,
        unitMinutes: param.unitMinutes,
        lineTotalMinor: qty * param.unitPriceMinor,
      };
    });

  const extrasSnapshot: CleanExtraSnapshot[] = selection.extras
    .filter((sel) => sel.qty > 0)
    .map((sel) => {
      const extra = catalog.extras.find((e) => e.id === sel.id);
      if (!extra || !service.extraIds.includes(sel.id)) {
        throw new CleanQuoteError(
          `Extra ${sel.id} is not offered for ${service.name}`,
          'unknown_extra',
        );
      }
      const qty = extra.qtyEnabled ? Math.max(1, Math.trunc(sel.qty)) : 1;
      return {
        extraId: extra.id,
        label: extra.label,
        qty,
        priceMinor: extra.priceMinor,
        minutes: extra.minutes,
        lineTotalMinor: qty * extra.priceMinor,
      };
    });

  const subtotalMinor =
    service.basePriceMinor +
    paramsSnapshot.reduce((sum, p) => sum + p.lineTotalMinor, 0) +
    extrasSnapshot.reduce((sum, e) => sum + e.lineTotalMinor, 0);

  let discountMinor = pctOf(subtotalMinor, frequency.discountPct);
  if (selection.discountCode) {
    const code = catalog.discountCodes?.[selection.discountCode.toUpperCase()];
    if (!code || !code.active) {
      throw new CleanQuoteError(
        `Discount code ${selection.discountCode} is not valid`,
        'invalid_discount_code',
      );
    }
    discountMinor += code.pct ? pctOf(subtotalMinor, code.pct) : (code.fixedMinor ?? 0);
  }
  discountMinor = Math.min(discountMinor, subtotalMinor);

  const taxMinor = pctOf(subtotalMinor - discountMinor, context.taxPct);
  const totalMinor = subtotalMinor - discountMinor + taxMinor;

  const estMinutes =
    service.baseMinutes +
    paramsSnapshot.reduce((sum, p) => sum + p.qty * p.unitMinutes, 0) +
    extrasSnapshot.reduce((sum, e) => sum + e.qty * e.minutes, 0);

  return {
    selection,
    serviceLabel: service.name,
    paramsSnapshot,
    extrasSnapshot,
    pricing: {
      subtotalMinor,
      discountMinor,
      taxPct: context.taxPct,
      taxMinor,
      totalMinor,
      currency: context.currency,
    },
    estMinutes,
  };
}

/**
 * Even auto-split of a job's estimated minutes across n contractors
 * (8h + 2 cleaners → [240, 240]); remainders go to the earliest slots so the
 * parts always sum to the input. Per-assignment minutes stay operator-editable.
 */
export function splitAllocatedMinutes(estMinutes: number, n: number): number[] {
  if (n <= 0) return [];
  const total = Math.max(0, Math.trunc(estMinutes));
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}
