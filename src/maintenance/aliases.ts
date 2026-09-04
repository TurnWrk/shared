/**
 * Free-text amenity labels to catalog classes (TURNWRK-630).
 *
 * An Airbnb amenity list, a Vrbo feature list, or an operator's notes never
 * arrive as `PropertyAmenity` values. This is the one table that turns them
 * into classes, shared by every caller (dispatch, str-manager's scrape
 * handoff, Hermes) so they cannot disagree about what "Private BBQ grill" is.
 *
 * Three outcomes, and the caller must keep all three:
 *   matched  → a class the catalog can plan
 *   ignored  → a real label with no maintenance load (supply, service,
 *              marketing copy); restock owns consumables, not this plan
 *   unmapped → we do not recognise it; surface it, never drop it
 *
 * Adding a label is a one-line change here. Adding a CLASS means a catalog
 * entry too, or the plan will match it and then plan nothing for it.
 */
import type { PropertyAmenity } from '../types/property';

export type AmenityNormalization =
  | { kind: 'matched'; amenity: PropertyAmenity; input: string }
  | { kind: 'ignored'; input: string }
  | { kind: 'unmapped'; input: string };

/** Lower-cased, punctuation-collapsed label → class. Exact match after `keyOf`. */
const ALIASES: Readonly<Record<string, PropertyAmenity>> = {
  // water
  pool: 'pool',
  'private pool': 'pool',
  'shared pool': 'pool',
  'outdoor pool': 'pool',
  'swimming pool': 'pool',
  'heated pool': 'heated-pool',
  'pool heater': 'heated-pool',
  'hot tub': 'hot-tub',
  'private hot tub': 'hot-tub',
  spa: 'hot-tub',
  jacuzzi: 'hot-tub',
  'screened lanai': 'screened-lanai',
  'screened porch': 'screened-lanai',
  'screened pool': 'screened-lanai',
  'pool cage': 'screened-lanai',
  lanai: 'screened-lanai',
  sauna: 'sauna',
  'cold plunge': 'cold-plunge',
  'boat dock': 'boat-dock',
  dock: 'boat-dock',
  'boat slip': 'boat-dock',
  kayak: 'watercraft',
  kayaks: 'watercraft',
  paddleboard: 'watercraft',
  paddleboards: 'watercraft',
  'paddle boards': 'watercraft',
  canoe: 'watercraft',
  // play
  'pickleball court': 'pickleball-court',
  pickleball: 'pickleball-court',
  'tennis court': 'sport-court',
  'sport court': 'sport-court',
  'sports court': 'sport-court',
  'basketball court': 'sport-court',
  'basketball hoop': 'basketball-hoop',
  basketball: 'basketball-hoop',
  'putting green': 'putting-green',
  'mini golf': 'putting-green',
  'game room': 'game-room',
  'ping pong table': 'game-room',
  'ping pong': 'game-room',
  'pool table': 'game-room',
  'billiards table': 'game-room',
  foosball: 'game-room',
  'foosball table': 'game-room',
  'air hockey': 'game-room',
  'air hockey table': 'game-room',
  'shuffleboard table': 'game-room',
  darts: 'game-room',
  'arcade games': 'arcade',
  'arcade game': 'arcade',
  arcade: 'arcade',
  'arcade machine': 'arcade',
  'life size games': 'yard-games',
  'lawn games': 'yard-games',
  'yard games': 'yard-games',
  cornhole: 'yard-games',
  'outdoor playground': 'playground',
  playground: 'playground',
  'swing set': 'playground',
  trampoline: 'trampoline',
  bikes: 'bikes',
  bicycles: 'bikes',
  'golf cart': 'golf-cart',
  // outdoor living
  'outdoor bar': 'outdoor-bar',
  'tiki bar': 'outdoor-bar',
  speakeasy: 'outdoor-bar',
  'wet bar': 'outdoor-bar',
  'fire pit': 'fire-pit',
  firepit: 'fire-pit',
  'bbq grill': 'outdoor-grill',
  'private bbq grill': 'outdoor-grill',
  'shared bbq grill': 'outdoor-grill',
  grill: 'outdoor-grill',
  'gas grill': 'outdoor-grill',
  'outdoor kitchen': 'outdoor-grill',
  'outdoor furniture': 'outdoor-furniture',
  'outdoor dining area': 'outdoor-furniture',
  'outdoor dining': 'outdoor-furniture',
  'patio or balcony': 'outdoor-furniture',
  'patio': 'outdoor-furniture',
  'lounge chairs': 'outdoor-furniture',
  hammock: 'outdoor-furniture',
  'beach essentials': 'beach-gear',
  'beach chairs': 'beach-gear',
  'beach items': 'beach-gear',
  backyard: 'yard',
  'private backyard': 'yard',
  'fenced yard': 'yard',
  garden: 'yard',
  // systems
  'air conditioning': 'hvac',
  'central air conditioning': 'hvac',
  ac: 'hvac',
  heating: 'hvac',
  'central heating': 'hvac',
  'ceiling fan': 'ceiling-fan',
  'ceiling fans': 'ceiling-fan',
  'hot water': 'water-heater',
  'water heater': 'water-heater',
  'ev charger': 'ev-charger',
  'electric vehicle charger': 'ev-charger',
  generator: 'generator',
  'backup generator': 'generator',
  elevator: 'elevator',
  'smart lock': 'access-hardware',
  'keypad': 'access-hardware',
  lockbox: 'access-hardware',
  'self check in': 'access-hardware',
  'exterior security cameras on property': 'security-camera',
  'security cameras': 'security-camera',
  'security camera': 'security-camera',
  'ring doorbell': 'security-camera',
  'noise decibel monitors on property': 'noise-monitor',
  'noise monitor': 'noise-monitor',
  'smoke alarm': 'safety-equipment',
  'smoke detector': 'safety-equipment',
  'carbon monoxide alarm': 'safety-equipment',
  'carbon monoxide detector': 'safety-equipment',
  'fire extinguisher': 'safety-equipment',
  'first aid kit': 'safety-equipment',
  'pool alarm': 'safety-equipment',
  // interior
  kitchen: 'kitchen',
  'full kitchen': 'kitchen',
  refrigerator: 'kitchen',
  fridge: 'kitchen',
  freezer: 'kitchen',
  microwave: 'kitchen',
  dishwasher: 'kitchen',
  stove: 'kitchen',
  oven: 'kitchen',
  'coffee maker': 'kitchen',
  toaster: 'kitchen',
  'garbage disposal': 'kitchen',
  blender: 'kitchen',
  washer: 'laundry',
  dryer: 'laundry',
  'washer and dryer': 'laundry',
  'free washer in unit': 'laundry',
  'free dryer in unit': 'laundry',
  'laundry': 'laundry',
  fireplace: 'fireplace',
  'indoor fireplace': 'fireplace',
  gym: 'gym',
  'exercise equipment': 'gym',
  'home gym': 'gym',
  bathtub: 'bathtub',
  'bath tub': 'bathtub',
  'soaking tub': 'bathtub',
  tv: 'tv',
  'smart tv': 'tv',
  hdtv: 'tv',
  television: 'tv',
  wifi: 'wifi',
  'wi fi': 'wifi',
  internet: 'wifi',
  'fast wifi': 'wifi',
  'dedicated workspace': 'dedicated-workspace',
  workspace: 'dedicated-workspace',
  'pack n play travel crib': 'family-kit',
  'pack n play': 'family-kit',
  'travel crib': 'family-kit',
  crib: 'family-kit',
  'high chair': 'family-kit',
  'children s books and toys': 'family-kit',
  'baby bath': 'family-kit',
  'baby monitor': 'family-kit',
  'changing table': 'family-kit',
};

/**
 * Labels we recognise and deliberately do not plan for: consumables and
 * linens (restock's domain), Airbnb marketing or policy flags, and structural
 * facts with no recurring work. Kept explicit so "unmapped" stays meaningful.
 */
const IGNORED: ReadonlySet<string> = new Set([
  // bathroom consumables
  'hair dryer',
  'cleaning products',
  'shampoo',
  'conditioner',
  'body soap',
  'shower gel',
  'bidet',
  'essentials',
  // bedroom and laundry supply
  'hangers',
  'bed linens',
  'extra pillows and blankets',
  'iron',
  'clothing storage',
  'room darkening shades',
  'safe',
  'drying rack for clothing',
  // entertainment and family soft goods
  'books and reading material',
  'board games',
  'children s dinnerware',
  'babysitter recommendations',
  'sound system',
  'bluetooth sound system',
  'record player',
  'piano',
  // kitchen supply
  'cooking basics',
  'dishes and silverware',
  'wine glasses',
  'dining table',
  'baking sheet',
  'barbecue utensils',
  'hot water kettle',
  'rice maker',
  'mini fridge',
  // location, parking, services, policy
  'free parking on premises',
  'free street parking',
  'paid parking off premises',
  'paid parking on premises',
  'long term stays allowed',
  'luggage dropoff allowed',
  'private entrance',
  'private living room',
  'beach access',
  'beachfront',
  'waterfront',
  'lake access',
  'resort access',
  'ski in ski out',
  'single level home',
  'host greets you',
  'building staff',
  'cleaning available during stay',
  'breakfast',
  'pets allowed',
  'smoking allowed',
  'ethernet connection',
  // views
  'bay view',
  'beach view',
  'canal view',
  'city skyline view',
  'courtyard view',
  'garden view',
  'golf course view',
  'harbor view',
  'lake view',
  'marina view',
  'mountain view',
  'ocean view',
  'park view',
  'pool view',
  'resort view',
  'river view',
  'sea view',
  'valley view',
  'water view',
  'mobile hotspot',
  'window ac unit',
  'portable fans',
  'window guards',
  'outlet covers',
  'stair gates',
  'table corner guards',
  'fireplace guards',
]);

/** Lower-case, drop the Airbnb "Unavailable:" prefix, collapse punctuation to spaces. */
export function amenityKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/^unavailable:\s*/, '')
    .replace(/[’'"`]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** True for Airbnb's struck-through "Unavailable: X" rows; they describe an absence. */
export function isUnavailableLabel(label: string): boolean {
  return /^\s*unavailable:/i.test(label);
}

/** The full class list, for validation and pickers. Derived from the alias table plus the original seven. */
export const KNOWN_AMENITY_CLASSES: ReadonlySet<string> = new Set<string>([
  'kitchen',
  'laundry',
  'pool',
  'hot-tub',
  'outdoor-grill',
  'fireplace',
  'gym',
  ...Object.values(ALIASES),
]);

export function isPropertyAmenity(value: string): value is PropertyAmenity {
  return KNOWN_AMENITY_CLASSES.has(value);
}

/**
 * Normalize one label. A value that is already a class passes through. An
 * "Unavailable:" row is ignored (it says the home lacks the thing).
 */
export function normalizeAmenity(label: string): AmenityNormalization {
  const input = label;
  const trimmed = label.trim();
  if (!trimmed) return { kind: 'ignored', input };
  if (isPropertyAmenity(trimmed)) return { kind: 'matched', amenity: trimmed, input };
  if (isUnavailableLabel(trimmed)) return { kind: 'ignored', input };
  const key = amenityKey(trimmed);
  const hit = ALIASES[key];
  if (hit) return { kind: 'matched', amenity: hit, input };
  if (IGNORED.has(key)) return { kind: 'ignored', input };
  return { kind: 'unmapped', input };
}

export interface NormalizedAmenities {
  /** Deduplicated, in first-seen order. */
  matched: PropertyAmenity[];
  ignored: string[];
  unmapped: string[];
}

export function normalizeAmenities(labels: readonly string[]): NormalizedAmenities {
  const matched: PropertyAmenity[] = [];
  const seen = new Set<PropertyAmenity>();
  const ignored: string[] = [];
  const unmapped: string[] = [];
  for (const label of labels) {
    const n = normalizeAmenity(label);
    if (n.kind === 'matched') {
      if (!seen.has(n.amenity)) {
        seen.add(n.amenity);
        matched.push(n.amenity);
      }
    } else if (n.kind === 'ignored') {
      ignored.push(n.input);
    } else {
      unmapped.push(n.input);
    }
  }
  return { matched, ignored, unmapped };
}
