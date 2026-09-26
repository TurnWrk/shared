/**
 * Maintenance plan catalog types (TURNWRK-630).
 *
 * The catalog is DATA, the same way a vertical pack is: for each amenity or
 * asset class it says what a tech checks on every turn, which preventive tasks
 * recur and how often, which trade answers a corrective call, and how long
 * each of those takes. `planForProperty` (plan.ts) folds a property's amenity
 * list and asset register through it into schedules to create, a composed
 * per-turn inspection, and a monthly labour load split by trade.
 *
 * Nothing here is a price. Minutes and cadences are order-of-magnitude
 * defaults an org overrides; money comes from the org's rates and the vertical
 * pack service seeds at quote time (TURNWRK-632).
 */
import type { PropertyAmenity, PropertyAsset } from '../types/property';
import type { WOPriority } from '../types/workOrder';
import type { ChecklistTemplateItem, ChecklistTemplateSection } from '../types/checklist';

/**
 * Who answers the work. `handyman`, `pool` and `landscaping` share their
 * spelling with `VerticalKey` on purpose so an org that has authored that pack
 * can route straight to it; the rest are specialty trades the suite does not
 * model as packs (yet). Which trades are IN-HOUSE is an org fact passed into
 * the planner, never a catalog fact: Breezy Keys' handyman is on staff, a
 * pool-only operator's is not.
 */
export type MaintenanceTrade =
  | 'handyman'
  | 'pool'
  | 'landscaping'
  | 'hvac'
  | 'electrical'
  | 'plumbing'
  | 'appliance'
  | 'gas'
  | 'arcade'
  | 'court_surface'
  | 'locksmith'
  | 'pest';

export const MAINTENANCE_TRADES: readonly MaintenanceTrade[] = [
  'handyman',
  'pool',
  'landscaping',
  'hvac',
  'electrical',
  'plumbing',
  'appliance',
  'gas',
  'arcade',
  'court_surface',
  'locksmith',
  'pest',
] as const;

/** Structurally identical to dispatch's `PMCadenceUnit` (types.ts). */
export type MaintenanceCadenceUnit = 'days' | 'weeks' | 'months';

/** One recurring preventive task. Becomes a PM template plus a schedule. */
export interface PreventiveTaskSpec {
  /** Stable within the catalog; consumers derive template ids from it. */
  key: string;
  name: string;
  description: string;
  /** `PMTemplate.category` ("Pool", "HVAC", "Exterior"...). */
  category: string;
  trade: MaintenanceTrade;
  cadenceValue: number;
  cadenceUnit: MaintenanceCadenceUnit;
  /** Tech time on site per occurrence. */
  minutes: number;
  priority: WOPriority;
  sections: readonly ChecklistTemplateSection[];
  /**
   * True when the visit verifies a vendor's recurring service (the weekly
   * pool company came, the lawn was cut) rather than performing it. The
   * vendor's own visits are not on this plan; they are the owner's contract.
   */
  verifiesVendorService?: boolean;
}

/** What a tech checks about one amenity on every guest-experience walk. */
export interface PerTurnInspectionSpec {
  minutes: number;
  items: readonly ChecklistTemplateItem[];
}

/** Unplanned calls: how often something about this amenity breaks. */
export interface CorrectiveLoadSpec {
  /** Order-of-magnitude expected calls per year in a rented home. */
  callsPerYear: number;
  trade: MaintenanceTrade;
  /** Typical minutes on site per call, travel excluded. */
  minutes: number;
}

export interface AmenityMaintenanceSpec {
  amenity: PropertyAmenity;
  label: string;
  /** Absent when the amenity carries no per-turn check (a workspace). */
  perTurn?: PerTurnInspectionSpec;
  preventive: readonly PreventiveTaskSpec[];
  /** Absent when nothing about it breaks in a way we would be called for. */
  corrective?: CorrectiveLoadSpec;
}

/**
 * Equipment classes recognised from a free-text `PropertyAsset` (name, brand,
 * model). An asset register is richer than an amenity list: "Rheem 50 gal"
 * under a water heater tells us to plan a flush even when no amenity says so.
 */
export type MaintenanceAssetClass =
  | 'hvac_unit'
  | 'water_heater'
  | 'pool_pump'
  | 'pool_heater'
  | 'garage_door'
  | 'smart_lock'
  | 'washer_dryer'
  | 'refrigerator'
  | 'dishwasher'
  | 'irrigation'
  | 'septic';

export interface AssetMaintenanceSpec {
  assetClass: MaintenanceAssetClass;
  label: string;
  /** Lower-cased substrings that identify the class in an asset's name/model. */
  keywords: readonly string[];
  preventive: readonly PreventiveTaskSpec[];
  corrective?: CorrectiveLoadSpec;
}

export interface PlanInput {
  /** Amenity classes, or free-text labels, or a mix. Labels are normalized. */
  amenities: readonly string[];
  assets?: readonly PropertyAsset[];
  /** Guest turns per month; drives the per-turn inspection load. */
  turnsPerMonth: number;
  /** Trades the org staffs itself. Defaults to `['handyman']`. */
  inHouseTrades?: readonly MaintenanceTrade[];
}

export interface PlannedSchedule extends PreventiveTaskSpec {
  /** Amenity or asset class that put this schedule on the plan. */
  source: { kind: 'amenity'; amenity: PropertyAmenity } | { kind: 'asset'; assetClass: MaintenanceAssetClass; assetId: string };
  inHouse: boolean;
  /** Expected occurrences in an average month (30.44 days). */
  occurrencesPerMonth: number;
  minutesPerMonth: number;
}

export interface TradeLoad {
  trade: MaintenanceTrade;
  inHouse: boolean;
  perTurnMinutesPerMonth: number;
  preventiveMinutesPerMonth: number;
  correctiveMinutesPerMonth: number;
  totalMinutesPerMonth: number;
}

export interface MaintenanceLoad {
  perTurnMinutesPerTurn: number;
  perTurnMinutesPerMonth: number;
  preventiveMinutesPerMonth: number;
  correctiveMinutesPerMonth: number;
  totalMinutesPerMonth: number;
  inHouseMinutesPerMonth: number;
  specialtyMinutesPerMonth: number;
  byTrade: readonly TradeLoad[];
}

export interface MaintenancePlan {
  schedules: readonly PlannedSchedule[];
  perTurnInspection: { minutes: number; sections: readonly ChecklistTemplateSection[] };
  load: MaintenanceLoad;
  /** Amenity classes the plan accounted for, in catalog order, deduplicated. */
  matchedAmenities: readonly PropertyAmenity[];
  /** Inputs recognised as supply, service or marketing labels with no maintenance load. */
  ignoredAmenities: readonly string[];
  /** Inputs the catalog could not place. Never silently dropped. */
  unmappedAmenities: readonly string[];
  matchedAssets: readonly { assetId: string; assetClass: MaintenanceAssetClass }[];
  unmappedAssets: readonly string[];
}
