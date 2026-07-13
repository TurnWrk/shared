/**
 * Seeded default bounty spot list (Change Order 2, doc 09 §6). Unlike
 * notification defaults, these are COPIED into the org's program doc when the
 * program is first created — draws reference stable per-org spot ids (last-N
 * exclusion, CleanBounty.spotId), so a pure defaults-resolution registry
 * can't work here. `seedKey` survives the copy for "restore defaults" and
 * analytics without id churn.
 *
 * Supply-relevant spots are deliberate: supply areas double as visual stock
 * evidence for restock prediction (doc §1.3 — the Resupply moat).
 */
import type { CleanBountySpot, CleanBountySpotCategory } from '../types/clean';

export interface BountySpotSeed {
  seedKey: string;
  label: string;
  instructionText: string;
  category: CleanBountySpotCategory;
  requiresParameter?: string;
  supplyRelevant?: boolean;
}

export const DEFAULT_BOUNTY_SPOT_SEEDS: BountySpotSeed[] = [
  {
    seedKey: 'under_kitchen_sink',
    label: 'Under the kitchen sink',
    instructionText: 'Open the cabinet under the kitchen sink and photograph the full interior.',
    category: 'kitchen',
    supplyRelevant: true,
  },
  {
    seedKey: 'inside_oven',
    label: 'Inside the oven',
    instructionText: 'Open the oven door and photograph the interior, racks included.',
    category: 'kitchen',
  },
  {
    seedKey: 'behind_toilet',
    label: 'Behind the toilet',
    instructionText: 'Photograph the floor and wall behind the toilet base.',
    category: 'bath',
    requiresParameter: 'bath',
  },
  {
    seedKey: 'inside_microwave',
    label: 'Inside the microwave',
    instructionText: 'Open the microwave and photograph the interior, ceiling plate included.',
    category: 'kitchen',
  },
  {
    seedKey: 'under_bed',
    label: 'Under the bed',
    instructionText: 'Photograph the floor under the bed (use your flash).',
    category: 'bedroom',
    requiresParameter: 'bedroom',
  },
  {
    seedKey: 'fridge_door_shelves',
    label: 'Inside the fridge door shelves',
    instructionText: 'Open the refrigerator and photograph the door shelves.',
    category: 'kitchen',
  },
  {
    seedKey: 'supply_closet',
    label: 'The supply closet / caddy',
    instructionText: 'Photograph the supply closet shelf or caddy showing current stock.',
    category: 'supply',
    supplyRelevant: true,
  },
  {
    seedKey: 'dishwasher_filter',
    label: 'Inside the dishwasher filter',
    instructionText: 'Remove the bottom rack and photograph the dishwasher filter area.',
    category: 'kitchen',
  },
  {
    seedKey: 'living_window_sill',
    label: 'Window sill in the living room',
    instructionText: 'Photograph the main living-room window sill up close.',
    category: 'living',
  },
  {
    seedKey: 'behind_tv',
    label: 'Behind the TV / console',
    instructionText: 'Photograph behind the TV or media console, cables and dust visible.',
    category: 'living',
  },
  {
    seedKey: 'washer_seal',
    label: 'Inside the washing machine seal',
    instructionText: 'Pull back the washer door gasket and photograph inside the seal.',
    category: 'utility',
  },
  {
    seedKey: 'top_of_fridge',
    label: 'The top of the refrigerator',
    instructionText: 'Photograph the top surface of the refrigerator.',
    category: 'kitchen',
  },
  {
    seedKey: 'bins_relined',
    label: 'Inside the trash/recycling bins after relining',
    instructionText: 'Photograph the inside of the kitchen trash and recycling bins with fresh liners.',
    category: 'kitchen',
    supplyRelevant: true,
  },
  {
    seedKey: 'entry_threshold',
    label: 'Entry-door threshold',
    instructionText: 'Photograph the entry-door threshold and the floor just inside.',
    category: 'other',
  },
  {
    seedKey: 'balcony_corner',
    label: 'Balcony / patio corner',
    instructionText: 'Photograph the far corner of the balcony or patio.',
    category: 'exterior',
    requiresParameter: 'balcony',
  },
];

/** Copy the seeds into concrete per-org spots with generated stable ids. */
export function materializeSeedSpots(idFactory: () => string): CleanBountySpot[] {
  return DEFAULT_BOUNTY_SPOT_SEEDS.map((seed) => ({
    id: idFactory(),
    label: seed.label,
    instructionText: seed.instructionText,
    category: seed.category,
    ...(seed.requiresParameter ? { requiresParameter: seed.requiresParameter } : {}),
    ...(seed.supplyRelevant ? { supplyRelevant: true } : {}),
    active: true,
    seedKey: seed.seedKey,
  }));
}
