/**
 * The maintenance plan catalog (TURNWRK-630): what each amenity class costs
 * to keep running in a rented home, as data.
 *
 * Three questions per amenity:
 *   1. per turn      — what the tech checks on every guest-experience walk
 *   2. preventive    — what recurs, how often, which trade, how long
 *   3. corrective    — how often it breaks and who answers
 *
 * Every number is an order-of-magnitude default for a Florida STR, written
 * from the Tampa PM board (scripts/seed-pm-templates-tampa.ts in dispatch),
 * the pool and handyman packs, and Breezy Keys' field practice. They are
 * tunable constants, not measurements; an org overrides them in its own
 * templates once it has history. Keep them integers (minutes) and keep the
 * cadences expressible as a dispatch `PMSchedule`.
 */
import type { PropertyAmenity } from '../types/property';
import type { ChecklistTemplateItem, ChecklistTemplateSection } from '../types/checklist';
import type { AmenityMaintenanceSpec, PreventiveTaskSpec } from './types';

// ── small builders so the table below stays readable ────────────────────────

function check(id: string, label: string, extra: Partial<ChecklistTemplateItem> = {}): ChecklistTemplateItem {
  return { id, label, inputType: 'checkbox', ...extra };
}

function photo(id: string, label: string): ChecklistTemplateItem {
  return { id, label, inputType: 'photo-required', photoRequired: true };
}

function reading(
  id: string,
  label: string,
  suffix: string,
  range?: { min: number; max: number },
): ChecklistTemplateItem {
  return {
    id,
    label,
    inputType: 'number',
    suffix,
    ...(range ? { minValue: range.min, maxValue: range.max } : {}),
  };
}

function section(id: string, title: string, items: ChecklistTemplateItem[]): ChecklistTemplateSection {
  return { id, title, items };
}

/**
 * Preventive task with the checklist as one section titled after the task.
 * `key` doubles as the section id so a consumer can trace a WO item back here.
 */
function pm(
  spec: Omit<PreventiveTaskSpec, 'sections'> & { items: ChecklistTemplateItem[] },
): PreventiveTaskSpec {
  const { items, ...rest } = spec;
  return { ...rest, sections: [section(rest.key, rest.name, items)] };
}

// ── the catalog ─────────────────────────────────────────────────────────────

/**
 * Ordered by how much a class usually costs to keep, water first. Order is
 * the order schedules and inspection sections come out in, so a tech's walk
 * starts at the pool and ends at the router.
 */
export const AMENITY_MAINTENANCE_CATALOG: readonly AmenityMaintenanceSpec[] = [
  // ── water ────────────────────────────────────────────────────────────────
  {
    amenity: 'pool',
    label: 'Pool',
    perTurn: {
      minutes: 10,
      items: [
        check('pool.water_level', 'Water level at mid-skimmer'),
        check('pool.baskets', 'Skimmer and pump baskets emptied'),
        check('pool.equipment', 'Pump running, no leaks at equipment pad'),
        check('pool.surface', 'Surface and floor free of debris and algae'),
        reading('pool.chlorine', 'Free chlorine', 'ppm', { min: 1, max: 4 }),
        reading('pool.ph', 'pH', '', { min: 7.2, max: 7.8 }),
        check('pool.safety', 'Gate, alarms, and safety equipment in place'),
      ],
    },
    preventive: [
      pm({
        key: 'pool_service_verification',
        name: 'Pool Service Verification',
        description: 'Confirm the pool company came this week and the water is in range.',
        category: 'Pool',
        trade: 'pool',
        cadenceValue: 7,
        cadenceUnit: 'days',
        minutes: 15,
        priority: 'Medium',
        verifiesVendorService: true,
        items: [
          check('service_done', 'Pool service completed this week'),
          check('chemistry', 'Chemistry log within range'),
          check('equipment', 'Equipment pad dry, timer set'),
        ],
      }),
      pm({
        key: 'pool_equipment_inspection',
        name: 'Pool Equipment Inspection',
        description: 'Pump, filter pressure, valves, timer, and lights; catch a failing pump before a guest does.',
        category: 'Pool',
        trade: 'handyman',
        cadenceValue: 1,
        cadenceUnit: 'months',
        minutes: 20,
        priority: 'Medium',
        items: [
          reading('filter_psi', 'Filter pressure', 'psi'),
          check('pump_noise', 'Pump quiet, no cavitation'),
          check('lights', 'Pool lights working'),
          photo('pad_photo', 'Photo of equipment pad'),
        ],
      }),
      pm({
        key: 'pool_filter_clean',
        name: 'Pool Filter Deep Clean',
        description: 'Cartridge or DE filter elements cleaned.',
        category: 'Pool',
        trade: 'pool',
        cadenceValue: 3,
        cadenceUnit: 'months',
        minutes: 60,
        priority: 'Medium',
        items: [check('cleaned', 'Filter elements cleaned'), reading('psi_after', 'Pressure after clean', 'psi')],
      }),
    ],
    corrective: { callsPerYear: 6, trade: 'pool', minutes: 60 },
  },
  {
    amenity: 'heated-pool',
    label: 'Pool heater',
    perTurn: {
      minutes: 3,
      items: [
        check('heated_pool.heater_mode', 'Heater set per this booking (on or off)'),
        reading('heated_pool.temp', 'Water temperature', '°F'),
      ],
    },
    preventive: [
      pm({
        key: 'pool_heater_service',
        name: 'Pool Heater Service',
        description: 'Heat pump or gas heater: coils, condensate, ignition, error codes.',
        category: 'Pool',
        trade: 'pool',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 60,
        priority: 'Medium',
        items: [check('coils', 'Coils cleaned'), check('codes', 'No error codes'), check('flow', 'Flow switch OK')],
      }),
    ],
    corrective: { callsPerYear: 3, trade: 'pool', minutes: 60 },
  },
  {
    amenity: 'hot-tub',
    label: 'Hot tub',
    perTurn: {
      minutes: 10,
      items: [
        check('hot_tub.cover', 'Cover intact, latches working'),
        check('hot_tub.level', 'Water level above jets'),
        reading('hot_tub.temp', 'Temperature', '°F', { min: 98, max: 104 }),
        reading('hot_tub.sanitizer', 'Sanitizer', 'ppm', { min: 2, max: 5 }),
        check('hot_tub.jets', 'Jets and lights working'),
        check('hot_tub.clarity', 'Water clear, no foam or odor'),
      ],
    },
    preventive: [
      pm({
        key: 'hot_tub_filter_rinse',
        name: 'Hot Tub Filter Rinse',
        description: 'Rinse cartridge, top up sanitizer, wipe waterline.',
        category: 'Pool',
        trade: 'handyman',
        cadenceValue: 2,
        cadenceUnit: 'weeks',
        minutes: 20,
        priority: 'Medium',
        items: [check('rinsed', 'Cartridge rinsed'), check('waterline', 'Waterline wiped')],
      }),
      pm({
        key: 'hot_tub_drain_refill',
        name: 'Hot Tub Drain and Refill',
        description: 'Full drain, shell clean, refill and balance.',
        category: 'Pool',
        trade: 'handyman',
        cadenceValue: 3,
        cadenceUnit: 'months',
        minutes: 120,
        priority: 'Medium',
        items: [check('drained', 'Drained and shell cleaned'), check('balanced', 'Refilled and balanced')],
      }),
    ],
    corrective: { callsPerYear: 4, trade: 'pool', minutes: 60 },
  },
  {
    amenity: 'screened-lanai',
    label: 'Screened lanai',
    perTurn: {
      minutes: 2,
      items: [check('lanai.screens', 'Screens intact, doors latch and self-close')],
    },
    preventive: [
      pm({
        key: 'lanai_screen_inspection',
        name: 'Lanai Screen and Door Inspection',
        description: 'Panels, spline, door closers, and cage hardware.',
        category: 'Exterior',
        trade: 'handyman',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 30,
        priority: 'Low',
        items: [check('panels', 'All panels intact'), check('closers', 'Door closers adjusted')],
      }),
    ],
    corrective: { callsPerYear: 2, trade: 'handyman', minutes: 90 },
  },
  {
    amenity: 'sauna',
    label: 'Sauna',
    perTurn: { minutes: 3, items: [check('sauna.heater', 'Heater reaches temperature, timer works')] },
    preventive: [
      pm({
        key: 'sauna_inspection',
        name: 'Sauna Inspection',
        description: 'Heater elements, stones, bench wood, door seal.',
        category: 'Wellness',
        trade: 'electrical',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 45,
        priority: 'Low',
        items: [check('elements', 'Elements OK'), check('wood', 'Bench wood sound')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'electrical', minutes: 90 },
  },
  {
    amenity: 'cold-plunge',
    label: 'Cold plunge',
    perTurn: { minutes: 3, items: [check('plunge.chiller', 'Chiller running, water clear')] },
    preventive: [
      pm({
        key: 'cold_plunge_service',
        name: 'Cold Plunge Filter and Sanitize',
        description: 'Filter change, sanitize, chiller coil clean.',
        category: 'Wellness',
        trade: 'handyman',
        cadenceValue: 1,
        cadenceUnit: 'months',
        minutes: 30,
        priority: 'Low',
        items: [check('filter', 'Filter changed'), check('sanitized', 'Sanitized')],
      }),
    ],
    corrective: { callsPerYear: 2, trade: 'appliance', minutes: 60 },
  },
  {
    amenity: 'boat-dock',
    label: 'Boat dock',
    perTurn: { minutes: 3, items: [check('dock.boards', 'Boards and cleats secure, lights working')] },
    preventive: [
      pm({
        key: 'dock_inspection',
        name: 'Dock Inspection',
        description: 'Decking, pilings, ladder, lift and lighting.',
        category: 'Exterior',
        trade: 'handyman',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 45,
        priority: 'Medium',
        items: [check('decking', 'Decking sound'), check('ladder', 'Ladder secure'), photo('dock_photo', 'Photo of dock')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'handyman', minutes: 120 },
  },
  {
    amenity: 'watercraft',
    label: 'Kayaks and paddleboards',
    perTurn: { minutes: 3, items: [check('craft.count', 'Craft, paddles, and vests counted and undamaged')] },
    preventive: [],
    corrective: { callsPerYear: 2, trade: 'handyman', minutes: 30 },
  },

  // ── play ─────────────────────────────────────────────────────────────────
  {
    amenity: 'pickleball-court',
    label: 'Pickleball court',
    perTurn: {
      minutes: 5,
      items: [
        check('pickleball.surface', 'Surface swept, no standing water'),
        check('pickleball.net', 'Net at height, straps tight'),
        check('pickleball.gear', 'Paddles and balls counted'),
      ],
    },
    preventive: [
      pm({
        key: 'court_surface_wash',
        name: 'Court Surface Wash',
        description: 'Soft wash, blow off, check drainage and lines.',
        category: 'Exterior',
        trade: 'handyman',
        cadenceValue: 1,
        cadenceUnit: 'months',
        minutes: 45,
        priority: 'Low',
        items: [check('washed', 'Surface washed'), check('lines', 'Lines legible')],
      }),
      pm({
        key: 'court_surface_inspection',
        name: 'Court Surface Inspection',
        description: 'Cracks, low spots, coating wear; refer to a court contractor early.',
        category: 'Exterior',
        trade: 'court_surface',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 30,
        priority: 'Low',
        items: [check('cracks', 'No open cracks'), photo('court_photo', 'Photo of surface')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'court_surface', minutes: 120 },
  },
  {
    amenity: 'sport-court',
    label: 'Sport court',
    perTurn: { minutes: 4, items: [check('court.surface', 'Surface clear, equipment present')] },
    preventive: [
      pm({
        key: 'sport_court_wash',
        name: 'Sport Court Wash',
        description: 'Soft wash and drainage check.',
        category: 'Exterior',
        trade: 'handyman',
        cadenceValue: 1,
        cadenceUnit: 'months',
        minutes: 45,
        priority: 'Low',
        items: [check('washed', 'Surface washed')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'court_surface', minutes: 120 },
  },
  {
    amenity: 'basketball-hoop',
    label: 'Basketball hoop',
    perTurn: { minutes: 2, items: [check('hoop.rim', 'Rim level, net intact, base stable')] },
    preventive: [
      pm({
        key: 'hoop_hardware_check',
        name: 'Hoop Hardware Check',
        description: 'Backboard bolts, pole anchors, net.',
        category: 'Exterior',
        trade: 'handyman',
        cadenceValue: 3,
        cadenceUnit: 'months',
        minutes: 15,
        priority: 'Low',
        items: [check('bolts', 'Bolts tight'), check('net', 'Net replaced if frayed')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'handyman', minutes: 60 },
  },
  {
    amenity: 'putting-green',
    label: 'Putting green',
    perTurn: { minutes: 3, items: [check('green.turf', 'Turf clear of debris, cups and flags in place, putters counted')] },
    preventive: [
      pm({
        key: 'turf_brush_and_infill',
        name: 'Turf Brush and Infill',
        description: 'Power brush, top up infill, check seams and edging.',
        category: 'Exterior',
        trade: 'handyman',
        cadenceValue: 3,
        cadenceUnit: 'months',
        minutes: 60,
        priority: 'Low',
        items: [check('brushed', 'Brushed'), check('seams', 'Seams and edges secure')],
      }),
      pm({
        key: 'turf_deep_clean',
        name: 'Turf Deep Clean',
        description: 'Sanitize and deep clean synthetic turf.',
        category: 'Exterior',
        trade: 'landscaping',
        cadenceValue: 12,
        cadenceUnit: 'months',
        minutes: 120,
        priority: 'Low',
        items: [check('cleaned', 'Deep cleaned')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'handyman', minutes: 60 },
  },
  {
    amenity: 'game-room',
    label: 'Game room tables',
    perTurn: {
      minutes: 5,
      items: [
        check('games.tables', 'Ping pong, foosball, air hockey working'),
        check('games.pieces', 'Balls, paddles, pucks, darts counted'),
      ],
    },
    preventive: [
      pm({
        key: 'game_table_service',
        name: 'Game Table Service',
        description: 'Air hockey blower and filter, foosball rods lubricated, net and legs tightened.',
        category: 'Interior',
        trade: 'handyman',
        cadenceValue: 3,
        cadenceUnit: 'months',
        minutes: 30,
        priority: 'Low',
        items: [check('blower', 'Air hockey blower clean'), check('rods', 'Foosball rods lubricated')],
      }),
    ],
    corrective: { callsPerYear: 3, trade: 'handyman', minutes: 45 },
  },
  {
    amenity: 'arcade',
    label: 'Arcade cabinets',
    perTurn: {
      minutes: 5,
      items: [
        check('arcade.power', 'Every cabinet powers on and reaches attract mode'),
        check('arcade.controls', 'Controls responsive on each cabinet'),
      ],
    },
    preventive: [
      pm({
        key: 'arcade_cabinet_service',
        name: 'Arcade Cabinet Service',
        description: 'Clean controls, check monitors and power supplies, vacuum cabinets.',
        category: 'Interior',
        trade: 'arcade',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 60,
        priority: 'Low',
        items: [check('controls', 'Controls cleaned and tested'), check('monitors', 'Monitors OK')],
      }),
    ],
    corrective: { callsPerYear: 3, trade: 'arcade', minutes: 90 },
  },
  {
    amenity: 'yard-games',
    label: 'Yard games',
    perTurn: { minutes: 2, items: [check('yard_games.count', 'Cornhole, Jenga, Connect Four complete and dry')] },
    preventive: [],
    corrective: { callsPerYear: 1, trade: 'handyman', minutes: 30 },
  },
  {
    amenity: 'playground',
    label: 'Playground',
    perTurn: { minutes: 3, items: [check('playground.hardware', 'No loose hardware, swings and chains intact')] },
    preventive: [
      pm({
        key: 'playground_inspection',
        name: 'Playground Inspection',
        description: 'Anchors, hardware, wood condition, fall surface.',
        category: 'Exterior',
        trade: 'handyman',
        cadenceValue: 3,
        cadenceUnit: 'months',
        minutes: 30,
        priority: 'Medium',
        items: [check('anchors', 'Anchors secure'), check('wood', 'No splinters or rot')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'handyman', minutes: 60 },
  },
  {
    amenity: 'trampoline',
    label: 'Trampoline',
    perTurn: { minutes: 2, items: [check('trampoline.net', 'Net, springs, and pad intact')] },
    preventive: [
      pm({
        key: 'trampoline_inspection',
        name: 'Trampoline Inspection',
        description: 'Springs, mat, net, and frame.',
        category: 'Exterior',
        trade: 'handyman',
        cadenceValue: 3,
        cadenceUnit: 'months',
        minutes: 20,
        priority: 'Medium',
        items: [check('springs', 'All springs present'), check('mat', 'Mat and net sound')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'handyman', minutes: 60 },
  },
  {
    amenity: 'bikes',
    label: 'Bikes',
    perTurn: { minutes: 3, items: [check('bikes.count', 'Bikes counted, tires inflated, helmets present')] },
    preventive: [
      pm({
        key: 'bike_tune',
        name: 'Bike Tune',
        description: 'Brakes, chain, tires, seat posts.',
        category: 'Interior',
        trade: 'handyman',
        cadenceValue: 3,
        cadenceUnit: 'months',
        minutes: 30,
        priority: 'Low',
        items: [check('brakes', 'Brakes OK'), check('chain', 'Chain lubricated')],
      }),
    ],
    corrective: { callsPerYear: 2, trade: 'handyman', minutes: 30 },
  },
  {
    amenity: 'golf-cart',
    label: 'Golf cart',
    perTurn: { minutes: 4, items: [check('cart.charge', 'Charged, lights working, no damage')] },
    preventive: [
      pm({
        key: 'golf_cart_service',
        name: 'Golf Cart Service',
        description: 'Batteries, tires, brakes, charger.',
        category: 'Exterior',
        trade: 'handyman',
        cadenceValue: 3,
        cadenceUnit: 'months',
        minutes: 45,
        priority: 'Medium',
        items: [check('batteries', 'Battery water and terminals'), check('brakes', 'Brakes OK')],
      }),
    ],
    corrective: { callsPerYear: 2, trade: 'handyman', minutes: 90 },
  },

  // ── outdoor living ───────────────────────────────────────────────────────
  {
    amenity: 'outdoor-bar',
    label: 'Outdoor bar',
    perTurn: {
      minutes: 5,
      items: [
        check('bar.fridge', 'Bar fridge cold, ice maker running'),
        check('bar.lights', 'Lighting and neon working'),
        check('bar.seating', 'Swings and stools secure'),
      ],
    },
    preventive: [
      pm({
        key: 'outdoor_bar_fixture_check',
        name: 'Outdoor Bar Fixture Check',
        description: 'Swing hardware, fridge coils, GFCI outlets, lighting.',
        category: 'Exterior',
        trade: 'handyman',
        cadenceValue: 3,
        cadenceUnit: 'months',
        minutes: 30,
        priority: 'Low',
        items: [check('swings', 'Swing hardware tight'), check('gfci', 'GFCI outlets test OK')],
      }),
    ],
    corrective: { callsPerYear: 2, trade: 'handyman', minutes: 45 },
  },
  {
    amenity: 'fire-pit',
    label: 'Fire pit',
    perTurn: {
      minutes: 5,
      items: [
        check('fire_pit.fuel', 'Propane level or ash cleared'),
        check('fire_pit.igniter', 'Igniter lights, no gas smell'),
        check('fire_pit.area', 'Seating clear, screen in place'),
      ],
    },
    preventive: [
      pm({
        key: 'fire_pit_gas_inspection',
        name: 'Fire Pit Gas Inspection',
        description: 'Hose, regulator, burner, leak test.',
        category: 'Exterior',
        trade: 'gas',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 30,
        priority: 'High',
        items: [check('leak_test', 'Soap leak test passed'), check('burner', 'Burner ports clear')],
      }),
    ],
    corrective: { callsPerYear: 2, trade: 'handyman', minutes: 45 },
  },
  {
    amenity: 'outdoor-grill',
    label: 'Grill',
    perTurn: {
      minutes: 5,
      items: [
        check('grill.grates', 'Grates scraped, grease tray emptied'),
        check('grill.propane', 'Propane above a quarter, spare present'),
        check('grill.igniter', 'Igniter works'),
      ],
    },
    preventive: [
      pm({
        key: 'grill_deep_clean',
        name: 'Grill Deep Clean',
        description: 'Burners, flavorizer bars, grease system, exterior.',
        category: 'Exterior',
        trade: 'handyman',
        cadenceValue: 2,
        cadenceUnit: 'months',
        minutes: 45,
        priority: 'Low',
        items: [check('burners', 'Burners clear'), check('grease', 'Grease system cleaned')],
      }),
    ],
    corrective: { callsPerYear: 2, trade: 'handyman', minutes: 45 },
  },
  {
    amenity: 'outdoor-furniture',
    label: 'Outdoor furniture',
    perTurn: { minutes: 3, items: [check('furniture.condition', 'Furniture clean, cushions dry, nothing broken')] },
    preventive: [
      pm({
        key: 'outdoor_furniture_service',
        name: 'Outdoor Furniture Wash and Tighten',
        description: 'Wash frames, tighten hardware, treat wood, rotate cushions.',
        category: 'Exterior',
        trade: 'handyman',
        cadenceValue: 3,
        cadenceUnit: 'months',
        minutes: 45,
        priority: 'Low',
        items: [check('washed', 'Washed'), check('hardware', 'Hardware tightened')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'handyman', minutes: 30 },
  },
  {
    amenity: 'beach-gear',
    label: 'Beach gear',
    perTurn: { minutes: 3, items: [check('beach.count', 'Chairs, umbrella, tent, toys counted and rinsed')] },
    preventive: [],
    corrective: { callsPerYear: 2, trade: 'handyman', minutes: 15 },
  },
  {
    amenity: 'yard',
    label: 'Yard',
    perTurn: { minutes: 2, items: [check('yard.condition', 'Lawn cut, beds tidy, sprinklers not running on guests')] },
    preventive: [
      pm({
        key: 'lawn_service_verification',
        name: 'Lawn Service Verification',
        description: 'Confirm the lawn crew is coming and the yard is guest-ready.',
        category: 'Exterior',
        trade: 'landscaping',
        cadenceValue: 14,
        cadenceUnit: 'days',
        minutes: 15,
        priority: 'High',
        verifiesVendorService: true,
        items: [check('cut', 'Lawn cut within SLA'), check('vendor', 'Vendor schedule confirmed')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'landscaping', minutes: 60 },
  },

  // ── systems ──────────────────────────────────────────────────────────────
  {
    amenity: 'hvac',
    label: 'Heating and cooling',
    perTurn: { minutes: 1, items: [check('hvac.thermostat', 'Thermostat at guest setpoint, air blowing cold')] },
    preventive: [
      pm({
        key: 'hvac_filter_replacement',
        name: 'HVAC Air Filter Replacement',
        description: 'Replace filters; photo of the installed filter.',
        category: 'HVAC',
        trade: 'handyman',
        cadenceValue: 3,
        cadenceUnit: 'months',
        minutes: 30,
        priority: 'High',
        items: [check('size', 'Filter size verified'), check('replaced', 'Filter replaced'), photo('filter_photo', 'Photo of installed filter')],
      }),
      pm({
        key: 'hvac_tune_up',
        name: 'HVAC Tune Up',
        description: 'Coil clean, refrigerant check, condensate line flush.',
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
    amenity: 'ceiling-fan',
    label: 'Ceiling fans',
    perTurn: { minutes: 1, items: [check('fans.run', 'Fans run without wobble')] },
    preventive: [
      pm({
        key: 'ceiling_fan_service',
        name: 'Ceiling Fan Tighten and Dust',
        description: 'Blades dusted, mounts tightened, remotes paired.',
        category: 'Interior',
        trade: 'handyman',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 20,
        priority: 'Low',
        items: [check('tightened', 'Mounts tightened')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'handyman', minutes: 45 },
  },
  {
    amenity: 'water-heater',
    label: 'Water heater',
    perTurn: { minutes: 1, items: [check('water_heater.hot', 'Hot water at the farthest tap')] },
    preventive: [
      pm({
        key: 'water_heater_flush',
        name: 'Water Heater Flush',
        description: 'Flush sediment, test relief valve, check anode.',
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
    amenity: 'ev-charger',
    label: 'EV charger',
    perTurn: { minutes: 1, items: [check('ev.status', 'Charger status light normal')] },
    preventive: [
      pm({
        key: 'ev_charger_inspection',
        name: 'EV Charger Inspection',
        description: 'Cable, connector, breaker, mounting.',
        category: 'Electrical',
        trade: 'electrical',
        cadenceValue: 12,
        cadenceUnit: 'months',
        minutes: 30,
        priority: 'Low',
        items: [check('cable', 'Cable and connector undamaged')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'electrical', minutes: 60 },
  },
  {
    amenity: 'generator',
    label: 'Generator',
    preventive: [
      pm({
        key: 'generator_exercise',
        name: 'Generator Exercise and Service',
        description: 'Run test, oil, battery, transfer switch.',
        category: 'Electrical',
        trade: 'electrical',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 60,
        priority: 'Medium',
        items: [check('run', 'Ran under load'), check('oil', 'Oil and battery OK')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'electrical', minutes: 120 },
  },
  {
    amenity: 'elevator',
    label: 'Elevator',
    perTurn: { minutes: 1, items: [check('elevator.run', 'Elevator runs, door sensors work')] },
    preventive: [
      pm({
        key: 'elevator_service_verification',
        name: 'Elevator Service Verification',
        description: 'Confirm the elevator contractor visit and certificate.',
        category: 'Interior',
        trade: 'handyman',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 15,
        priority: 'High',
        verifiesVendorService: true,
        items: [check('cert', 'Inspection certificate current')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'handyman', minutes: 60 },
  },
  {
    amenity: 'access-hardware',
    label: 'Smart lock and access',
    perTurn: { minutes: 1, items: [check('access.lock', 'Lock battery OK, keypad responsive, lockbox present')] },
    preventive: [
      pm({
        key: 'lock_battery_and_rekey',
        name: 'Lock Battery and Rekey Check',
        description: 'Smart lock batteries, guest code rotation, physical rekey schedule.',
        category: 'Access',
        trade: 'handyman',
        cadenceValue: 60,
        cadenceUnit: 'days',
        minutes: 30,
        priority: 'Medium',
        items: [check('battery', 'Lock battery level OK'), check('codes', 'Guest codes rotated'), check('rekey', 'Physical rekey not overdue')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'locksmith', minutes: 60 },
  },
  {
    amenity: 'security-camera',
    label: 'Exterior cameras',
    perTurn: { minutes: 1, items: [check('camera.online', 'Doorbell and cameras online')] },
    preventive: [
      pm({
        key: 'camera_service',
        name: 'Camera Lens and Battery',
        description: 'Clean lenses, check batteries and mounting.',
        category: 'Access',
        trade: 'handyman',
        cadenceValue: 3,
        cadenceUnit: 'months',
        minutes: 10,
        priority: 'Low',
        items: [check('lens', 'Lenses cleaned'), check('battery', 'Batteries OK')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'handyman', minutes: 30 },
  },
  {
    amenity: 'noise-monitor',
    label: 'Noise monitor',
    preventive: [
      pm({
        key: 'noise_monitor_check',
        name: 'Noise Monitor Check',
        description: 'Online, battery, placement.',
        category: 'Access',
        trade: 'handyman',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 10,
        priority: 'Low',
        items: [check('online', 'Device online')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'handyman', minutes: 30 },
  },
  {
    amenity: 'safety-equipment',
    label: 'Safety equipment',
    perTurn: { minutes: 1, items: [check('safety.present', 'Extinguisher and first aid kit present')] },
    preventive: [
      pm({
        key: 'safety_equipment_check',
        name: 'Safety Equipment Check',
        description: 'Smoke and CO alarms tested, extinguisher gauge, first aid restock, pool alarms.',
        category: 'Safety',
        trade: 'handyman',
        cadenceValue: 1,
        cadenceUnit: 'months',
        minutes: 15,
        priority: 'High',
        items: [
          check('smoke', 'Smoke alarms tested'),
          check('co', 'CO alarm tested'),
          check('extinguisher', 'Extinguisher in the green'),
          check('first_aid', 'First aid kit restocked'),
        ],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'handyman', minutes: 30 },
  },

  // ── interior ─────────────────────────────────────────────────────────────
  {
    amenity: 'kitchen',
    label: 'Kitchen',
    perTurn: {
      minutes: 3,
      items: [
        check('kitchen.appliances', 'Fridge cold, dishwasher, disposal, oven, microwave run'),
        check('kitchen.leaks', 'No leaks under sink or behind fridge'),
      ],
    },
    preventive: [
      pm({
        key: 'kitchen_appliance_service',
        name: 'Kitchen Appliance Service',
        description: 'Fridge coils and ice maker, range hood filter, disposal, dishwasher filter.',
        category: 'Appliances',
        trade: 'handyman',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 45,
        priority: 'Medium',
        items: [check('coils', 'Fridge coils cleaned'), check('hood', 'Hood filter cleaned'), check('dw_filter', 'Dishwasher filter cleaned')],
      }),
    ],
    corrective: { callsPerYear: 3, trade: 'appliance', minutes: 60 },
  },
  {
    amenity: 'laundry',
    label: 'Laundry',
    perTurn: { minutes: 2, items: [check('laundry.lint', 'Lint trap clear, no hose leaks')] },
    preventive: [
      pm({
        key: 'dryer_vent_clean',
        name: 'Dryer Vent Clean',
        description: 'Full vent run cleaned; fire prevention.',
        category: 'Appliances',
        trade: 'handyman',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 60,
        priority: 'High',
        items: [check('vent', 'Vent run cleaned'), check('hoses', 'Washer hoses inspected')],
      }),
    ],
    corrective: { callsPerYear: 2, trade: 'appliance', minutes: 60 },
  },
  {
    amenity: 'fireplace',
    label: 'Fireplace',
    perTurn: { minutes: 2, items: [check('fireplace.safe', 'Glass intact, igniter works, screen in place')] },
    preventive: [
      pm({
        key: 'fireplace_inspection',
        name: 'Fireplace Inspection',
        description: 'Gas log or chimney inspection and clean.',
        category: 'Interior',
        trade: 'gas',
        cadenceValue: 12,
        cadenceUnit: 'months',
        minutes: 60,
        priority: 'Medium',
        items: [check('inspected', 'Inspected and cleaned')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'gas', minutes: 60 },
  },
  {
    amenity: 'gym',
    label: 'Gym',
    perTurn: { minutes: 3, items: [check('gym.equipment', 'Equipment works, cables intact, wiped down')] },
    preventive: [
      pm({
        key: 'gym_equipment_service',
        name: 'Gym Equipment Service',
        description: 'Treadmill belt, cables, bolts, lubrication.',
        category: 'Interior',
        trade: 'handyman',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 45,
        priority: 'Low',
        items: [check('belt', 'Treadmill belt aligned'), check('bolts', 'Bolts tight')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'handyman', minutes: 60 },
  },
  {
    amenity: 'bathtub',
    label: 'Bathtub',
    perTurn: { minutes: 1, items: [check('tub.drain', 'Drains freely, caulk intact')] },
    preventive: [
      pm({
        key: 'tub_caulk_inspection',
        name: 'Tub and Shower Caulk Inspection',
        description: 'Caulk, grout, drain, stopper.',
        category: 'Plumbing',
        trade: 'handyman',
        cadenceValue: 6,
        cadenceUnit: 'months',
        minutes: 20,
        priority: 'Low',
        items: [check('caulk', 'Caulk sound'), check('drain', 'Drain clear')],
      }),
    ],
    corrective: { callsPerYear: 1, trade: 'plumbing', minutes: 60 },
  },
  {
    amenity: 'tv',
    label: 'TVs',
    perTurn: { minutes: 2, items: [check('tv.remotes', 'Every TV powers on, remotes present, guest accounts signed out')] },
    preventive: [],
    corrective: { callsPerYear: 2, trade: 'handyman', minutes: 30 },
  },
  {
    amenity: 'wifi',
    label: 'Wifi',
    perTurn: { minutes: 1, items: [check('wifi.speed', 'Wifi up, speed test acceptable')] },
    preventive: [],
    corrective: { callsPerYear: 2, trade: 'handyman', minutes: 30 },
  },
  {
    amenity: 'family-kit',
    label: 'Family kit',
    perTurn: { minutes: 2, items: [check('family.kit', 'Pack and play, high chair, toys complete and clean')] },
    preventive: [],
    corrective: { callsPerYear: 1, trade: 'handyman', minutes: 15 },
  },
  {
    amenity: 'dedicated-workspace',
    label: 'Workspace',
    preventive: [],
  },
];

/** Catalog lookup by amenity class. */
export const AMENITY_SPEC_BY_CLASS: ReadonlyMap<PropertyAmenity, AmenityMaintenanceSpec> = new Map(
  AMENITY_MAINTENANCE_CATALOG.map((spec) => [spec.amenity, spec] as const),
);

export function amenitySpec(amenity: PropertyAmenity): AmenityMaintenanceSpec | undefined {
  return AMENITY_SPEC_BY_CLASS.get(amenity);
}
