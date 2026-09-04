/**
 * Palmshine Hideaway, Seminole FL (Airbnb listing 1576951617298022984), read
 * from the live amenities modal on 2026-09-04. The first field partner
 * prospect the catalog was built against (TURNWRK-630): 4BR/3BA, sleeps 10,
 * about five turns a month at eight months of hosting and 41 reviews.
 *
 * `PALMSHINE_AIRBNB_AMENITIES` is the modal verbatim, section by section, as
 * Airbnb renders it (60 of the "65" rows carried a readable label; the modal
 * counts a few sub-rows the accessibility tree does not expose). The listing
 * DESCRIPTION names outdoor features the modal does not have a row for; those
 * are `PALMSHINE_DESCRIPTION_AMENITIES` and a scraper that reads the
 * description will add them.
 */
export const PALMSHINE_AIRBNB_AMENITIES: readonly string[] = [
  // Bathroom
  'Bathtub',
  'Hair dryer',
  'Cleaning products',
  'Shampoo',
  'Conditioner',
  'Body soap',
  'Hot water',
  'Shower gel',
  // Bedroom and laundry
  'Washer',
  'Dryer',
  'Hangers',
  'Bed linens',
  'Extra pillows and blankets',
  'Iron',
  'Clothing storage',
  // Entertainment
  'TV',
  'Ping pong table',
  'Arcade games',
  'Books and reading material',
  'Life size games',
  'Mini golf',
  // Family
  "Pack 'n play/Travel crib",
  "Children's books and toys",
  'High chair',
  'Board games',
  // Heating and cooling
  'Air conditioning',
  'Ceiling fan',
  'Heating',
  // Home safety
  'Noise decibel monitors on property',
  'Exterior security cameras on property',
  'Smoke alarm',
  'Carbon monoxide alarm',
  'Fire extinguisher',
  'First aid kit',
  // Internet and office
  'Wifi',
  'Dedicated workspace',
  // Kitchen and dining
  'Kitchen',
  'Refrigerator',
  'Microwave',
  'Cooking basics',
  'Dishes and silverware',
  'Freezer',
  'Dishwasher',
  'Stove',
  'Oven',
  'Coffee maker',
  'Wine glasses',
  'Toaster',
  // Outdoor
  'Backyard',
  'Fire pit',
  'Outdoor furniture',
  'Outdoor dining area',
  'Private BBQ grill',
  'Beach essentials',
  // Parking and facilities
  'Free parking on premises',
  'Free street parking',
  'Pool',
  'Hot tub',
  // Services
  'Long term stays allowed',
  'Self check-in',
  // Not included
  'Unavailable: Essentials',
  'Unavailable: Private entrance',
];

/** From the listing description: "Massive heated pool", "Pickleball/Basketball court", "Putting green", "Tiki Bar". */
export const PALMSHINE_DESCRIPTION_AMENITIES: readonly string[] = [
  'Heated pool',
  'Pickleball court',
  'Basketball hoop',
  'Putting green',
  'Tiki bar',
  'Game room',
];

export const PALMSHINE_ALL_AMENITIES: readonly string[] = [
  ...PALMSHINE_AIRBNB_AMENITIES,
  ...PALMSHINE_DESCRIPTION_AMENITIES,
];

/** Eight months hosting, 41 reviews, so roughly five stays a month. */
export const PALMSHINE_TURNS_PER_MONTH = 5;
