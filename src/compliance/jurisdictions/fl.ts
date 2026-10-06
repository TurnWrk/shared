/**
 * Florida short-term rental obligations (TURNWRK-718), as data.
 *
 * Statute and code citations below are an engineering reading and need
 * counsel review before any of this is shown to an owner as legal advice.
 * Cadences and lead times are operating defaults the operator can change on
 * the item, not statutory deadlines, except where a comment says otherwise.
 */
import type { CompliancePropertyFacts, ComplianceRule } from '../rules';

const always = () => true;

function hasPool(facts: CompliancePropertyFacts): boolean {
  const amenities = facts.supply?.amenities ?? [];
  return amenities.includes('pool') || amenities.includes('heated-pool');
}

export const FL_COMPLIANCE_RULES: readonly ComplianceRule[] = [
  {
    key: 'fl.dbpr_vr_license',
    kind: 'license',
    label: 'DBPR vacation rental license',
    level: 'state',
    entry: 'seed',
    cadence: { value: 12, unit: 'months' },
    leadDays: 60,
    ownerVisible: true,
    citation: 'Fla. Stat. 509.241, 509.242(1)(c)',
    applies: always,
  },
  {
    key: 'fl.fdor_sales_tax_registration',
    kind: 'registration',
    label: 'FDOR sales and use tax registration',
    level: 'state',
    entry: 'seed',
    leadDays: 0,
    ownerVisible: true,
    citation: 'Fla. Stat. 212.18(3)',
    applies: always,
  },
  {
    // Returns are due on the 1st and late after the 20th of the following
    // month (statutory). The due date is the 20th; leadDays 19 turns the item
    // due_soon on the 1st, so status reads "due" from the 1st and "overdue"
    // from the 21st.
    key: 'fl.fdor_sales_tax_filing',
    kind: 'tax_filing',
    label: 'FDOR sales tax return (monthly)',
    level: 'state',
    entry: 'seed',
    cadence: { value: 1, unit: 'months' },
    dueDayOfMonth: 20,
    leadDays: 19,
    ownerVisible: false,
    citation: 'Fla. Stat. 212.11(1), 212.15(1)',
    applies: always,
  },
  {
    key: 'fl.smoke_alarms',
    kind: 'life_safety',
    label: 'Smoke alarms in every sleeping room (monthly test)',
    level: 'state',
    entry: 'seed',
    cadence: { value: 1, unit: 'months' },
    leadDays: 7,
    ownerVisible: true,
    citation: 'Fla. Stat. 509.215; Florida Fire Prevention Code (NFPA 72)',
    applies: always,
  },
  {
    key: 'fl.fire_extinguisher_visual',
    kind: 'life_safety',
    label: 'Fire extinguisher visual check (monthly)',
    level: 'state',
    entry: 'seed',
    cadence: { value: 1, unit: 'months' },
    leadDays: 7,
    ownerVisible: true,
    citation: 'Fla. Stat. 509.215; Florida Fire Prevention Code (NFPA 10)',
    applies: always,
  },
  {
    key: 'fl.fire_extinguisher_service',
    kind: 'inspection',
    label: 'Fire extinguisher annual service tag',
    level: 'state',
    entry: 'seed',
    cadence: { value: 12, unit: 'months' },
    leadDays: 30,
    ownerVisible: true,
    citation: 'Fla. Stat. 509.215; Florida Fire Prevention Code (NFPA 10)',
    applies: always,
  },
  {
    key: 'fl.co_alarm',
    kind: 'life_safety',
    label: 'Carbon monoxide alarm (monthly test)',
    level: 'state',
    entry: 'seed',
    cadence: { value: 1, unit: 'months' },
    leadDays: 7,
    ownerVisible: true,
    citation: 'Fla. Stat. 509.211(4)',
    applies: (facts) => facts.compliance?.fuelBurningAppliance === true,
  },
  {
    key: 'fl.pool_barrier',
    kind: 'life_safety',
    label: 'Pool barrier, gate and alarms (monthly check)',
    level: 'state',
    entry: 'seed',
    cadence: { value: 1, unit: 'months' },
    leadDays: 7,
    ownerVisible: true,
    citation: 'Fla. Stat. ch. 515',
    applies: hasPool,
  },
  {
    // Statutory: buildings of three or more stories, inspected every three
    // years by a licensed engineer, architect or building inspector.
    key: 'fl.balcony_certification',
    kind: 'inspection',
    label: 'Balcony and railing certification (every 3 years)',
    level: 'state',
    entry: 'seed',
    cadence: { value: 36, unit: 'months' },
    leadDays: 90,
    ownerVisible: true,
    citation: 'Fla. Stat. 509.2112',
    applies: (facts) => (facts.compliance?.stories ?? 0) >= 3,
  },
  {
    key: 'fl.county_tdt_registration',
    kind: 'registration',
    label: 'County tourist development tax registration',
    level: 'county',
    entry: 'operator',
    leadDays: 0,
    ownerVisible: true,
    citation: 'Fla. Stat. 125.0104',
    applies: always,
  },
  {
    // Filing frequency and due day vary by county; the operator sets cadence.
    key: 'fl.county_tdt_filing',
    kind: 'tax_filing',
    label: 'County tourist development tax return',
    level: 'county',
    entry: 'operator',
    leadDays: 7,
    ownerVisible: false,
    citation: 'Fla. Stat. 125.0104',
    applies: always,
  },
  {
    key: 'fl.city_str_permit',
    kind: 'permit',
    label: 'City short-term rental permit',
    level: 'city',
    entry: 'operator',
    leadDays: 30,
    ownerVisible: true,
    applies: always,
  },
  {
    key: 'fl.hoa_approval',
    kind: 'hoa_approval',
    label: 'HOA or condo association rental approval',
    level: 'hoa',
    entry: 'operator',
    leadDays: 30,
    ownerVisible: true,
    applies: (facts) => !!facts.compliance?.hoaName,
  },
];
