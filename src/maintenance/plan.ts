/**
 * `planForProperty` (TURNWRK-630): fold a property's amenities and assets
 * through the catalog into a maintenance plan.
 *
 * Pure and deterministic: same input, same plan, no I/O, no dates. Consumers
 * (dispatch's plan route, TURNWRK-631) turn `schedules` into cmms_pmTemplates
 * and cmms_pmSchedules, hand `perTurnInspection.sections` to the
 * GuestExperience checklist composer, and price `load` at quote time
 * (TURNWRK-632). All minutes are integers; monthly figures are rounded once,
 * at the end, so the by-trade rows still sum to the totals.
 */
import type { PropertyAmenity, PropertyAsset } from '../types/property';
import type { ChecklistTemplateSection } from '../types/checklist';
import { AMENITY_MAINTENANCE_CATALOG, AMENITY_SPEC_BY_CLASS } from './catalog';
import { ASSET_SPEC_BY_CLASS, classifyAsset } from './assets';
import { normalizeAmenities } from './aliases';
import type {
  CorrectiveLoadSpec,
  MaintenanceCadenceUnit,
  MaintenanceLoad,
  MaintenancePlan,
  MaintenanceTrade,
  PlanInput,
  PlannedSchedule,
  PreventiveTaskSpec,
  TradeLoad,
} from './types';
import { MAINTENANCE_TRADES } from './types';

/** Average Gregorian month in days; the same constant a PM schedule's cadence is amortised over. */
export const DAYS_PER_MONTH = 30.4375;

/** Trades an org staffs when it says nothing: the handyman is the default in-house seat. */
export const DEFAULT_IN_HOUSE_TRADES: readonly MaintenanceTrade[] = ['handyman'];

/** Occurrences of a cadence in an average month, unrounded. */
export function occurrencesPerMonth(cadenceValue: number, cadenceUnit: MaintenanceCadenceUnit): number {
  if (!(cadenceValue > 0)) return 0;
  switch (cadenceUnit) {
    case 'days':
      return DAYS_PER_MONTH / cadenceValue;
    case 'weeks':
      return DAYS_PER_MONTH / (cadenceValue * 7);
    case 'months':
      return 1 / cadenceValue;
  }
}

interface Accumulator {
  perTurn: number;
  preventive: number;
  corrective: number;
}

function emptyAccumulator(): Accumulator {
  return { perTurn: 0, preventive: 0, corrective: 0 };
}

export function planForProperty(input: PlanInput): MaintenancePlan {
  const turnsPerMonth = Math.max(0, input.turnsPerMonth);
  const inHouse = new Set<MaintenanceTrade>(input.inHouseTrades ?? DEFAULT_IN_HOUSE_TRADES);
  const isInHouse = (trade: MaintenanceTrade) => inHouse.has(trade);

  const normalized = normalizeAmenities(input.amenities);
  const wanted = new Set<PropertyAmenity>(normalized.matched);
  // Catalog order, not input order: the walk starts at the pool.
  const matchedAmenities = AMENITY_MAINTENANCE_CATALOG.filter((s) => wanted.has(s.amenity)).map((s) => s.amenity);
  // A class the alias table knows but the catalog does not is a catalog bug;
  // report it as unmapped rather than letting it vanish.
  const knownButUnplanned = normalized.matched.filter((a) => !AMENITY_SPEC_BY_CLASS.has(a));

  const byTrade = new Map<MaintenanceTrade, Accumulator>();
  const bucket = (trade: MaintenanceTrade) => {
    let acc = byTrade.get(trade);
    if (!acc) {
      acc = emptyAccumulator();
      byTrade.set(trade, acc);
    }
    return acc;
  };

  const schedules: PlannedSchedule[] = [];
  const inspectionSections: ChecklistTemplateSection[] = [];
  let perTurnMinutesPerTurn = 0;

  const addPreventive = (task: PreventiveTaskSpec, source: PlannedSchedule['source']) => {
    const occ = occurrencesPerMonth(task.cadenceValue, task.cadenceUnit);
    const minutesPerMonth = occ * task.minutes;
    schedules.push({
      ...task,
      source,
      inHouse: isInHouse(task.trade),
      occurrencesPerMonth: occ,
      minutesPerMonth,
    });
    bucket(task.trade).preventive += minutesPerMonth;
  };

  const addCorrective = (c: CorrectiveLoadSpec | undefined) => {
    if (!c) return;
    bucket(c.trade).corrective += (c.callsPerYear / 12) * c.minutes;
  };

  for (const amenity of matchedAmenities) {
    const spec = AMENITY_SPEC_BY_CLASS.get(amenity);
    if (!spec) continue;
    if (spec.perTurn && spec.perTurn.items.length > 0) {
      perTurnMinutesPerTurn += spec.perTurn.minutes;
      inspectionSections.push({ id: `amenity.${amenity}`, title: spec.label, items: [...spec.perTurn.items] });
      // Every per-turn walk is the field seat's work, whichever trade owns the amenity.
      bucket('handyman').perTurn += spec.perTurn.minutes * turnsPerMonth;
    }
    for (const task of spec.preventive) addPreventive(task, { kind: 'amenity', amenity });
    addCorrective(spec.corrective);
  }

  const matchedAssets: { assetId: string; assetClass: NonNullable<ReturnType<typeof classifyAsset>> }[] = [];
  const unmappedAssets: string[] = [];
  const seenAssetClasses = new Set<string>();
  for (const asset of input.assets ?? []) {
    const cls = classifyAsset(asset);
    if (!cls) {
      unmappedAssets.push(assetLabel(asset));
      continue;
    }
    matchedAssets.push({ assetId: asset.id, assetClass: cls });
    // One preventive series per asset class, even when the register lists two
    // units: the template is per property, the schedule covers both.
    if (seenAssetClasses.has(cls)) continue;
    seenAssetClasses.add(cls);
    const spec = ASSET_SPEC_BY_CLASS.get(cls);
    if (!spec) continue;
    for (const task of spec.preventive) addPreventive(task, { kind: 'asset', assetClass: cls, assetId: asset.id });
    addCorrective(spec.corrective);
  }

  const load = summarise(byTrade, isInHouse, perTurnMinutesPerTurn, turnsPerMonth);

  return {
    schedules: schedules.map((s) => ({ ...s, minutesPerMonth: Math.round(s.minutesPerMonth) })),
    perTurnInspection: { minutes: perTurnMinutesPerTurn, sections: inspectionSections },
    load,
    matchedAmenities,
    ignoredAmenities: normalized.ignored,
    unmappedAmenities: [...normalized.unmapped, ...knownButUnplanned],
    matchedAssets,
    unmappedAssets,
  };
}

function summarise(
  byTrade: Map<MaintenanceTrade, Accumulator>,
  isInHouse: (t: MaintenanceTrade) => boolean,
  perTurnMinutesPerTurn: number,
  turnsPerMonth: number,
): MaintenanceLoad {
  const rows: TradeLoad[] = [];
  let perTurn = 0;
  let preventive = 0;
  let corrective = 0;
  let inHouse = 0;
  let specialty = 0;
  // Stable order for consumers rendering a table.
  for (const trade of MAINTENANCE_TRADES) {
    const acc = byTrade.get(trade);
    if (!acc) continue;
    const row: TradeLoad = {
      trade,
      inHouse: isInHouse(trade),
      perTurnMinutesPerMonth: Math.round(acc.perTurn),
      preventiveMinutesPerMonth: Math.round(acc.preventive),
      correctiveMinutesPerMonth: Math.round(acc.corrective),
      totalMinutesPerMonth: 0,
    };
    row.totalMinutesPerMonth = row.perTurnMinutesPerMonth + row.preventiveMinutesPerMonth + row.correctiveMinutesPerMonth;
    if (row.totalMinutesPerMonth === 0) continue;
    rows.push(row);
    perTurn += row.perTurnMinutesPerMonth;
    preventive += row.preventiveMinutesPerMonth;
    corrective += row.correctiveMinutesPerMonth;
    if (row.inHouse) inHouse += row.totalMinutesPerMonth;
    else specialty += row.totalMinutesPerMonth;
  }
  return {
    perTurnMinutesPerTurn,
    perTurnMinutesPerMonth: perTurn,
    preventiveMinutesPerMonth: preventive,
    correctiveMinutesPerMonth: corrective,
    totalMinutesPerMonth: perTurn + preventive + corrective,
    inHouseMinutesPerMonth: inHouse,
    specialtyMinutesPerMonth: specialty,
    byTrade: rows,
  };
}

function assetLabel(asset: PropertyAsset): string {
  return [asset.name, asset.brand, asset.model].filter((v): v is string => !!v).join(' ') || asset.id;
}

/** Whole hours, rounded up, for a minutes figure; what a retainer is quoted in. */
export function hoursCeil(minutes: number): number {
  return Math.ceil(minutes / 60);
}
