/**
 * Trade-facing invoice pure domain (TURNWRK-279).
 *
 * Builds on the extracted A/R `Invoice` model in `./types` — no third invoice
 * shape. Dispatch persists these fields and hosts `/invoice/{payToken}`; Stripe
 * Connect direct charges use `@turnwrk/shared/billing` fee helpers.
 *
 * Rules:
 *   - integer minor units only;
 *   - markup rows roll into customer-visible line totals (TURNWRK-273);
 *   - trade UI statuses (draft/sent/…) map to persisted `InvoiceStatus`;
 *   - timestamps are epoch ms UTC; due dates are org-local YYYY-MM-DD strings.
 */
import { applicationFeeForDirectCharge } from '../billing/connect';
import type { Invoice, InvoiceStatus, Pricing } from './types';

// ---------------------------------------------------------------------------
// Line items
// ---------------------------------------------------------------------------

export type TradeLineItemKind = 'labor' | 'material' | 'markup';

export interface TradeLineItem {
  id: string;
  kind: TradeLineItemKind;
  label: string;
  quantity: number;
  unitMinor: number;
  totalMinor: number;
  /** Basis points behind a percent-derived markup row (2500 = 25%). */
  percentBps?: number;
}

/** Customer-visible row — never `kind === 'markup'`. */
export interface TradeCustomerLineItem {
  id: string;
  kind: 'labor' | 'material';
  label: string;
  quantity: number;
  unitMinor: number;
  totalMinor: number;
}

export interface TradeLineItemInput {
  id?: string;
  kind: TradeLineItemKind;
  label: string;
  quantity: number;
  unitMinor: number;
  percentBps?: number;
}

// ---------------------------------------------------------------------------
// Status vocabulary (trade UI ↔ persisted Invoice.status)
// ---------------------------------------------------------------------------

export type TradeInvoiceStatus =
  | 'draft'
  | 'sent'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'void';

const TRADE_TO_INVOICE_STATUS: Record<
  Exclude<TradeInvoiceStatus, 'draft'>,
  InvoiceStatus
> = {
  sent: 'open',
  partially_paid: 'partially_paid',
  paid: 'paid',
  overdue: 'overdue',
  void: 'void',
};

const INVOICE_TO_TRADE_STATUS: Partial<Record<InvoiceStatus, TradeInvoiceStatus>> = {
  open: 'sent',
  partially_paid: 'partially_paid',
  paid: 'paid',
  overdue: 'overdue',
  void: 'void',
};

/** Map a trade-facing status to the persisted A/R `Invoice.status`. */
export function tradeStatusToInvoiceStatus(
  status: Exclude<TradeInvoiceStatus, 'draft'>,
): InvoiceStatus {
  return TRADE_TO_INVOICE_STATUS[status];
}

/** Dual-read a persisted invoice status into trade UI vocabulary. */
export function invoiceStatusToTradeStatus(
  status: InvoiceStatus | undefined,
  issuedAt?: number,
): TradeInvoiceStatus {
  if (!issuedAt) return 'draft';
  if (!status) return 'sent';
  return INVOICE_TO_TRADE_STATUS[status] ?? 'sent';
}

// ---------------------------------------------------------------------------
// Markup rollup + totals
// ---------------------------------------------------------------------------

export interface TradeLineItemTotals {
  laborMinor: number;
  materialsMinor: number;
  markupMinor: number;
  subtotalMinor: number;
}

export interface TradeInvoiceTotals extends TradeLineItemTotals {
  taxPct: number;
  taxMinor: number;
  totalMinor: number;
  depositAppliedMinor: number;
  paidMinor: number;
  balanceMinor: number;
}

/** Normalize one pricing row; drops invalid/unlabeled/zero-qty lines. */
export function normalizeTradeLineItem(
  input: TradeLineItemInput,
  index: number,
): TradeLineItem | null {
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  if (!label) return null;
  if (input.kind !== 'labor' && input.kind !== 'material' && input.kind !== 'markup') {
    return null;
  }
  const quantity =
    typeof input.quantity === 'number' && Number.isFinite(input.quantity) ? input.quantity : NaN;
  const unitMinor =
    typeof input.unitMinor === 'number' && Number.isInteger(input.unitMinor) ? input.unitMinor : NaN;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (!Number.isFinite(unitMinor) || unitMinor < 0) return null;

  const totalMinor = Math.round(quantity * unitMinor);
  const item: TradeLineItem = {
    id:
      typeof input.id === 'string' && input.id.trim() ? input.id.trim() : `line_${index}`,
    kind: input.kind,
    label,
    quantity,
    unitMinor,
    totalMinor,
  };
  if (
    input.kind === 'markup' &&
    typeof input.percentBps === 'number' &&
    Number.isInteger(input.percentBps) &&
    input.percentBps >= 0
  ) {
    item.percentBps = input.percentBps;
  }
  return item;
}

/** Sum labor, materials, and markup from normalized line items. */
export function sumTradeLineItems(lineItems: TradeLineItem[]): TradeLineItemTotals {
  let laborMinor = 0;
  let materialsMinor = 0;
  let markupMinor = 0;
  for (const item of lineItems) {
    if (item.kind === 'labor') laborMinor += item.totalMinor;
    else if (item.kind === 'markup') markupMinor += item.totalMinor;
    else materialsMinor += item.totalMinor;
  }
  return {
    laborMinor,
    materialsMinor,
    markupMinor,
    subtotalMinor: laborMinor + materialsMinor + markupMinor,
  };
}

/**
 * Roll markup into labor/material rows for the customer-facing invoice.
 * Markup rows are omitted; their cents are distributed proportionally across
 * visible rows so line totals still sum to the full subtotal (TURNWRK-273).
 */
export function customerFacingLineItems(lineItems: TradeLineItem[]): TradeCustomerLineItem[] {
  const visible = lineItems.filter((item) => item.kind !== 'markup');
  const markupMinor = lineItems
    .filter((item) => item.kind === 'markup')
    .reduce((sum, item) => sum + item.totalMinor, 0);

  if (markupMinor <= 0) {
    return visible.map((item) => ({
      id: item.id,
      kind: item.kind as 'labor' | 'material',
      label: item.label,
      quantity: item.quantity,
      unitMinor: item.unitMinor,
      totalMinor: item.totalMinor,
    }));
  }

  const visibleSubtotal = visible.reduce((sum, item) => sum + item.totalMinor, 0);
  if (visibleSubtotal <= 0) return [];

  let distributed = 0;
  return visible.map((item, index) => {
    const addMinor =
      index === visible.length - 1
        ? markupMinor - distributed
        : Math.round((item.totalMinor * markupMinor) / visibleSubtotal);
    distributed += addMinor;
    const totalMinor = item.totalMinor + addMinor;
    return {
      id: item.id,
      kind: item.kind as 'labor' | 'material',
      label: item.label,
      quantity: item.quantity,
      unitMinor: Math.round(totalMinor / item.quantity),
      totalMinor,
    };
  });
}

/** Whole-percent tax on a subtotal (25 = 25%). */
export function computeTaxMinor(subtotalMinor: number, taxPct: number): number {
  if (!Number.isInteger(subtotalMinor) || subtotalMinor < 0) return 0;
  if (!Number.isFinite(taxPct) || taxPct <= 0) return 0;
  return Math.round((subtotalMinor * taxPct) / 100);
}

export function computeTradeInvoiceTotals(input: {
  lineItems: TradeLineItem[];
  taxPct?: number;
  depositPaidMinor?: number;
  paidMinor?: number;
}): TradeInvoiceTotals {
  const parts = sumTradeLineItems(input.lineItems);
  const taxPct = typeof input.taxPct === 'number' && input.taxPct >= 0 ? input.taxPct : 0;
  const taxMinor = computeTaxMinor(parts.subtotalMinor, taxPct);
  const totalMinor = parts.subtotalMinor + taxMinor;
  const depositAppliedMinor = Math.min(
    Math.max(0, Math.trunc(input.depositPaidMinor ?? 0)),
    totalMinor,
  );
  const paidMinor = Math.min(
    totalMinor,
    Math.max(depositAppliedMinor, Math.trunc(input.paidMinor ?? depositAppliedMinor)),
  );
  const balanceMinor = Math.max(0, totalMinor - paidMinor);

  return {
    ...parts,
    taxPct,
    taxMinor,
    totalMinor,
    depositAppliedMinor,
    paidMinor,
    balanceMinor,
  };
}

// ---------------------------------------------------------------------------
// Estimate → invoice draft
// ---------------------------------------------------------------------------

/** Dispatch `Estimate` fields needed to derive an invoice — cents/minor are interchangeable. */
export interface TradeEstimateSource {
  id: string;
  orgId: string;
  customerId: string;
  workOrderId: string;
  workOrderIds?: string[];
  amountCents: number;
  laborCents?: number;
  materialsCents?: number;
  lineItems?: Array<{
    id: string;
    kind: TradeLineItemKind;
    label: string;
    quantity: number;
    unitCents: number;
    totalCents: number;
    percentBps?: number;
  }>;
  depositPaidCents?: number;
  title?: string;
}

export interface BuildTradeInvoiceInput {
  estimate: TradeEstimateSource;
  lineItems?: TradeLineItemInput[];
  taxPct?: number;
  currency?: string;
  termsDays?: number;
  issuedAt?: number;
  dueDate?: string;
  dueAtUtc?: number;
  payToken?: string;
  invoiceNumber?: string;
  /** Additional payments beyond the deposit (integer minor units). */
  additionalPaidMinor?: number;
}

export interface TradeInvoiceDraft {
  orgId: string;
  customerId: string;
  estimateId: string;
  workOrderId: string;
  workOrderIds?: string[];
  number: string;
  kind: 'invoice';
  tradeStatus: TradeInvoiceStatus;
  status?: InvoiceStatus;
  totalsSnapshot: Pricing;
  totalMinor: number;
  paidMinor: number;
  balanceMinor: number;
  depositAppliedMinor: number;
  customerLineItems: TradeCustomerLineItem[];
  issuedAt?: number;
  dueDate?: string;
  dueAtUtc?: number;
  termsDays?: number;
  payToken?: string;
  paymentsApplied: [];
  dunningStage: 0;
}

function estimateLineItemsFromSource(estimate: TradeEstimateSource): TradeLineItemInput[] {
  if (Array.isArray(estimate.lineItems) && estimate.lineItems.length > 0) {
    return estimate.lineItems.map((row) => ({
      id: row.id,
      kind: row.kind,
      label: row.label,
      quantity: row.quantity,
      unitMinor: row.unitCents,
      percentBps: row.percentBps,
    }));
  }

  const rows: TradeLineItemInput[] = [];
  const laborMinor = estimate.laborCents ?? 0;
  const materialsMinor = estimate.materialsCents ?? 0;
  const known = laborMinor + materialsMinor;
  const remainder = Math.max(0, estimate.amountCents - known);

  if (laborMinor > 0) {
    rows.push({
      id: 'labor',
      kind: 'labor',
      label: estimate.title?.trim() || 'Labor',
      quantity: 1,
      unitMinor: laborMinor,
    });
  }
  if (materialsMinor > 0) {
    rows.push({
      id: 'materials',
      kind: 'material',
      label: 'Materials',
      quantity: 1,
      unitMinor: materialsMinor,
    });
  }
  if (remainder > 0) {
    rows.push({
      id: 'services',
      kind: 'labor',
      label: estimate.title?.trim() || 'Services',
      quantity: 1,
      unitMinor: remainder,
    });
  }
  if (rows.length === 0 && estimate.amountCents > 0) {
    rows.push({
      id: 'services',
      kind: 'labor',
      label: estimate.title?.trim() || 'Services',
      quantity: 1,
      unitMinor: estimate.amountCents,
    });
  }
  return rows;
}

/**
 * Derive a trade invoice draft from a completed job's approved estimate.
 * Caller assigns `id`, `bookingId`/`paymentId` when wiring Clean-shaped storage,
 * and persists via the app's invoice writer.
 */
export function buildTradeInvoiceFromEstimate(input: BuildTradeInvoiceInput): TradeInvoiceDraft | null {
  const { estimate } = input;
  if (!estimate.id || !estimate.orgId || !estimate.customerId || !estimate.workOrderId) {
    return null;
  }

  const rawInputs = input.lineItems ?? estimateLineItemsFromSource(estimate);
  const lineItems = rawInputs
    .map((row, index) => normalizeTradeLineItem(row, index))
    .filter((row): row is TradeLineItem => row !== null);
  if (lineItems.length === 0) return null;

  const depositPaidMinor = Math.max(0, Math.trunc(estimate.depositPaidCents ?? 0));
  const additionalPaidMinor = Math.max(0, Math.trunc(input.additionalPaidMinor ?? 0));
  const totals = computeTradeInvoiceTotals({
    lineItems,
    taxPct: input.taxPct,
    depositPaidMinor,
    paidMinor: depositPaidMinor + additionalPaidMinor,
  });
  if (totals.totalMinor <= 0) return null;

  const customerLineItems = customerFacingLineItems(lineItems);
  const customerSubtotal = customerLineItems.reduce((sum, row) => sum + row.totalMinor, 0);
  if (customerSubtotal !== totals.subtotalMinor) {
    // Rounding from proportional markup distribution — adjust the last visible row.
    const delta = totals.subtotalMinor - customerSubtotal;
    if (customerLineItems.length > 0 && delta !== 0) {
      const last = customerLineItems[customerLineItems.length - 1];
      last.totalMinor += delta;
      last.unitMinor = Math.round(last.totalMinor / last.quantity);
    }
  }

  const issued = input.issuedAt !== undefined;
  const tradeStatus = resolveTradeInvoiceStatus({
    issuedAt: input.issuedAt,
    dueAtUtc: input.dueAtUtc,
    totalMinor: totals.totalMinor,
    paidMinor: totals.paidMinor,
    balanceMinor: totals.balanceMinor,
    now: input.issuedAt,
  });
  const status =
    tradeStatus === 'draft'
      ? undefined
      : tradeStatusToInvoiceStatus(tradeStatus as Exclude<TradeInvoiceStatus, 'draft'>);

  const currency = input.currency ?? 'USD';
  const pricing: Pricing = {
    subtotalMinor: totals.subtotalMinor,
    discountMinor: 0,
    taxPct: totals.taxPct,
    taxMinor: totals.taxMinor,
    totalMinor: totals.totalMinor,
    currency,
  };

  return {
    orgId: estimate.orgId,
    customerId: estimate.customerId,
    estimateId: estimate.id,
    workOrderId: estimate.workOrderId,
    workOrderIds: estimate.workOrderIds,
    number: input.invoiceNumber ?? 'INV-DRAFT',
    kind: 'invoice',
    tradeStatus,
    status,
    totalsSnapshot: pricing,
    totalMinor: totals.totalMinor,
    paidMinor: totals.paidMinor,
    balanceMinor: totals.balanceMinor,
    depositAppliedMinor: totals.depositAppliedMinor,
    customerLineItems,
    issuedAt: input.issuedAt,
    dueDate: input.dueDate,
    dueAtUtc: input.dueAtUtc,
    termsDays: input.termsDays,
    payToken: input.payToken,
    paymentsApplied: [],
    dunningStage: 0,
  };
}

// ---------------------------------------------------------------------------
// Status resolution + pay link
// ---------------------------------------------------------------------------

export interface TradeInvoiceBalanceView {
  issuedAt?: number;
  dueAtUtc?: number;
  totalMinor?: number;
  paidMinor?: number;
  balanceMinor?: number;
  status?: InvoiceStatus;
  now?: number;
}

/** Resolve trade UI status from balances and due date (pure). */
export function resolveTradeInvoiceStatus(view: TradeInvoiceBalanceView): TradeInvoiceStatus {
  if (!view.issuedAt) return 'draft';

  const totalMinor = Math.max(0, Math.trunc(view.totalMinor ?? 0));
  const paidMinor = Math.max(0, Math.trunc(view.paidMinor ?? 0));
  const balanceMinor =
    typeof view.balanceMinor === 'number'
      ? Math.max(0, view.balanceMinor)
      : Math.max(0, totalMinor - paidMinor);

  if (totalMinor > 0 && balanceMinor <= 0) return 'paid';
  if (view.status === 'void') return 'void';

  const now = view.now ?? Date.now();
  if (view.dueAtUtc !== undefined && view.dueAtUtc <= now && balanceMinor > 0) {
    return 'overdue';
  }
  if (paidMinor > 0 && balanceMinor > 0) return 'partially_paid';
  if (view.status && INVOICE_TO_TRADE_STATUS[view.status]) {
    return INVOICE_TO_TRADE_STATUS[view.status] as TradeInvoiceStatus;
  }
  return 'sent';
}

/** Hosted customer pay page path — matches Dispatch `app/invoice/[token]`. */
export function tradeInvoicePayPath(payToken: string): string {
  const token = typeof payToken === 'string' ? payToken.trim() : '';
  if (!token) return '/invoice';
  return `/invoice/${encodeURIComponent(token)}`;
}

/**
 * Plan a Connect direct charge for the invoice balance. The trade's connected
 * account is the merchant of record; Turnwrk collects the application fee.
 */
export function planTradeInvoiceCharge(input: {
  balanceMinor: number;
  planId?: string | null;
}): {
  amountMinor: number;
  applicationFeeMinor: number;
  takeRateMinor: number;
  processingFeeMinor: number;
  paymentRateBps: number;
} | null {
  const amountMinor = Math.trunc(input.balanceMinor);
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) return null;
  const fee = applicationFeeForDirectCharge({
    amountCents: amountMinor,
    planId: input.planId,
  });
  return {
    amountMinor,
    applicationFeeMinor: fee.applicationFeeCents,
    takeRateMinor: fee.takeRateCents,
    processingFeeMinor: fee.processingFeeCents,
    paymentRateBps: fee.paymentRateBps,
  };
}

/** Pick trade-specific fields off a persisted `Invoice` doc (dual-read). */
export function readTradeInvoiceFields(
  invoice: Pick<
    Invoice,
    | 'customerId'
    | 'estimateId'
    | 'workOrderId'
    | 'workOrderIds'
    | 'depositAppliedMinor'
    | 'customerLineItems'
  >,
): {
  customerId?: string;
  estimateId?: string;
  workOrderId?: string;
  workOrderIds?: string[];
  depositAppliedMinor?: number;
  customerLineItems?: TradeCustomerLineItem[];
} {
  return {
    customerId: invoice.customerId,
    estimateId: invoice.estimateId,
    workOrderId: invoice.workOrderId,
    workOrderIds: invoice.workOrderIds,
    depositAppliedMinor: invoice.depositAppliedMinor,
    customerLineItems: invoice.customerLineItems,
  };
}
