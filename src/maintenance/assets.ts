/**
 * Asset register half of the catalog (TURNWRK-630).
 *
 * `PropertyMaintenance.assets` is free text a tech typed on an onboarding walk
 * ("Rheem 50 gal water heater, garage"). This classifies those rows by keyword
 * and attaches the preventive work an asset implies even when no amenity
 * label mentions it. Matching is deliberately conservative: an asset that
 * matches nothing comes back as unmapped, never guessed.
 */
import type { PropertyAsset } from '../types/property';
import type { ChecklistTemplateItem } from '../types/checklist';
import type { AssetMaintenanceSpec, MaintenanceAssetClass, PreventiveTaskSpec } from './types';

function check(id: string, label: string): ChecklistTemplateItem {
  return { id, label, inputType: 'checkbox' };
}

function pm(spec: Omit<PreventiveTaskSpec, 'sections'> & { items: ChecklistTemplateItem[] }): PreventiveTaskSpec {
  const { items, ...rest } = spec;
  return { ...rest, sections: [{ id: rest.key, title: rest.name, items }] };
}

export const ASSET_MAINTENANCE_CATALOG: readonly AssetMaintenanceSpec[] = [
  {
    assetClass: 'hvac_unit',
    label: 'HVAC unit',
    keywords: ['hvac', 'air handler', 'condenser', 'heat pump', 'a/c', 'ac unit', 'air conditioner', 'mini split', 'furnace'],
    preventive: [
      pm({
        key: 'asset_hvac_tune_up',
        name: 'HVAC Tune Up (asset)',
        description: 'Coil clean, refrigerant check, condensate line flush on the registered unit.',
        category: 'HVAC',
        trade: 'hvac',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 60,
        priority: 'High',
        items: [check('coils', 'Coils cleaned'), check('drain', 'Condensate line flushed')],
      }),
    ],
    corrective: { callsPerYear: 2, trade: 'hvac', minutes: 90 },
  },
  {
    assetClass: 'water_heater',
    label: 'Water heater',
    keywords: ['water heater', 'hot water heater', 'tankless', 'rheem', 'bradford white', 'a.o. smith', 'ao smith'],
    preventive: [
      pm({
        key: 'asset_water_heater_flush',
        name: 'Water Heater Flush (asset)',
        description: 'Flush sediment, test relief valve, check anode rod.',
        category: 'Plumbing',
        trade: 'plumbing',
        cadenceValue: 12,
        cadenceUnit: 'months',
        minutes: 60,
        priority: 'Medium',
        items: [check('flushed', 'Flushed'), check('tpr', 'Relief valve tested')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'plumbing', minutes: 90 },
  },
  {
    assetClass: 'pool_pump',
    label: 'Pool pump',
    keywords: ['pool pump', 'variable speed pump', 'pentair', 'hayward', 'jandy', 'pool filter'],
    preventive: [
      pm({
        key: 'asset_pool_pump_inspection',
        name: 'Pool Pump Inspection (asset)',
        description: 'Seals, basket, pressure, timer program.',
        category: 'Pool',
        trade: 'pool',
        cadenceValue: 3,
        cadenceUnit: 'months',
        minutes: 30,
        priority: 'Medium',
        items: [check('seals', 'No seal leaks'), check('program', 'Timer program correct')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'pool', minutes: 90 },
  },
  {
    assetClass: 'pool_heater',
    label: 'Pool heater',
    keywords: ['pool heater', 'pool heat pump', 'raypak', 'aquacal', 'heater for pool'],
    preventive: [
      pm({
        key: 'asset_pool_heater_service',
        name: 'Pool Heater Service (asset)',
        description: 'Coils, condensate, ignition, error codes.',
        category: 'Pool',
        trade: 'pool',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 60,
        priority: 'Medium',
        items: [check('coils', 'Coils cleaned'), check('codes', 'No error codes')],
      }),
    ],
    corrective: { callsPerYear: 2, trade: 'pool', minutes: 60 },
  },
  {
    assetClass: 'garage_door',
    label: 'Garage door',
    keywords: ['garage door', 'garage opener', 'liftmaster', 'chamberlain', 'genie opener'],
    preventive: [
      pm({
        key: 'asset_garage_door_service',
        name: 'Garage Door Service (asset)',
        description: 'Springs, rollers, sensors, lubrication, auto-reverse test.',
        category: 'Exterior',
        trade: 'handyman',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 30,
        priority: 'Medium',
        items: [check('reverse', 'Auto-reverse tested'), check('lube', 'Rollers and hinges lubricated')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'handyman', minutes: 90 },
  },
  {
    assetClass: 'smart_lock',
    label: 'Smart lock',
    keywords: ['smart lock', 'schlage', 'yale', 'august lock', 'kwikset halo', 'keypad lock', 'deadbolt'],
    preventive: [
      pm({
        key: 'asset_smart_lock_battery',
        name: 'Smart Lock Battery (asset)',
        description: 'Battery swap, firmware, strike alignment.',
        category: 'Access',
        trade: 'handyman',
        cadenceValue: 60,
        cadenceUnit: 'days',
        minutes: 15,
        priority: 'Medium',
        items: [check('battery', 'Batteries replaced'), check('strike', 'Strike aligned')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'locksmith', minutes: 60 },
  },
  {
    assetClass: 'washer_dryer',
    label: 'Washer and dryer',
    keywords: ['washer', 'dryer', 'laundry center', 'washing machine'],
    preventive: [
      pm({
        key: 'asset_dryer_vent_clean',
        name: 'Dryer Vent Clean (asset)',
        description: 'Full vent run cleaned; washer hoses inspected.',
        category: 'Appliances',
        trade: 'handyman',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 60,
        priority: 'High',
        items: [check('vent', 'Vent run cleaned'), check('hoses', 'Hoses inspected')],
      }),
    ],
    corrective: { callsPerYear: 2, trade: 'appliance', minutes: 60 },
  },
  {
    assetClass: 'refrigerator',
    label: 'Refrigerator',
    keywords: ['refrigerator', 'fridge', 'ice maker'],
    preventive: [
      pm({
        key: 'asset_fridge_service',
        name: 'Refrigerator Coil and Ice Maker (asset)',
        description: 'Coils vacuumed, water filter, ice maker, door seals.',
        category: 'Appliances',
        trade: 'handyman',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 30,
        priority: 'Medium',
        items: [check('coils', 'Coils vacuumed'), check('filter', 'Water filter replaced')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'appliance', minutes: 60 },
  },
  {
    assetClass: 'dishwasher',
    label: 'Dishwasher',
    keywords: ['dishwasher'],
    preventive: [
      pm({
        key: 'asset_dishwasher_service',
        name: 'Dishwasher Filter and Seal (asset)',
        description: 'Filter, spray arms, door seal, drain hose.',
        category: 'Appliances',
        trade: 'handyman',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 20,
        priority: 'Low',
        items: [check('filter', 'Filter cleaned'), check('seal', 'Door seal OK')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'appliance', minutes: 60 },
  },
  {
    assetClass: 'irrigation',
    label: 'Irrigation',
    keywords: ['irrigation', 'sprinkler', 'rain bird', 'rainbird', 'hunter controller'],
    preventive: [
      pm({
        key: 'asset_irrigation_check',
        name: 'Irrigation Zone Check (asset)',
        description: 'Run every zone, heads, controller schedule, rain sensor.',
        category: 'Exterior',
        trade: 'landscaping',
        cadenceValue: 3,
        cadenceUnit: 'months',
        minutes: 30,
        priority: 'Low',
        items: [check('zones', 'All zones run'), check('schedule', 'Schedule matches season')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'landscaping', minutes: 60 },
  },
  {
    assetClass: 'septic',
    label: 'Septic',
    keywords: ['septic', 'drain field', 'drainfield'],
    preventive: [
      pm({
        key: 'asset_septic_pump',
        name: 'Septic Pump Out (asset)',
        description: 'Tank pumped and inspected; heavy guest load shortens the interval.',
        category: 'Plumbing',
        trade: 'plumbing',
        cadenceValue: 24,
        cadenceUnit: 'months',
        minutes: 90,
        priority: 'Medium',
        items: [check('pumped', 'Pumped'), check('baffles', 'Baffles inspected')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'plumbing', minutes: 120 },
  },
];

export const ASSET_SPEC_BY_CLASS: ReadonlyMap<MaintenanceAssetClass, AssetMaintenanceSpec> = new Map(
  ASSET_MAINTENANCE_CATALOG.map((spec) => [spec.assetClass, spec] as const),
);

/**
 * Classify one asset by keyword over its name, brand, model and location.
 * First catalog entry whose keyword appears wins; specific classes (pool
 * heater) are listed before general ones they could collide with (pool pump
 * matches "pool filter", never "pool heater").
 */
export function classifyAsset(asset: PropertyAsset): MaintenanceAssetClass | null {
  const haystack = [asset.name, asset.brand, asset.model, asset.location]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(' ')
    .toLowerCase();
  if (!haystack) return null;
  // Pool heater before pool pump: "Pentair pool heater" mentions a pump brand.
  const ordered: readonly MaintenanceAssetClass[] = [
    'pool_heater',
    'pool_pump',
    'water_heater',
    'hvac_unit',
    'garage_door',
    'smart_lock',
    'washer_dryer',
    'refrigerator',
    'dishwasher',
    'irrigation',
    'septic',
  ];
  for (const cls of ordered) {
    const spec = ASSET_SPEC_BY_CLASS.get(cls);
    if (spec && spec.keywords.some((k) => haystack.includes(k))) return cls;
  }
  return null;
}
