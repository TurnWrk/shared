/**
 * Deterministic emergency detection for inbox items (TURNWRK-738). Pure: no
 * Firestore, no model, no credit. Cortex runs it on every intake item and asks
 * a model only when the result is `ambiguous`.
 *
 * Keyword/regex over normalized text (lowercase, accents stripped, so Spanish
 * matches with or without them), clause by clause, with three guards:
 *
 *  - negation: a negator just before the issue ("no leaks") cancels it; the
 *    patterns that ARE a negation ("no power", "no heat") start at the negator,
 *    so they are not cancelled by it.
 *  - resolved / past tense: a message that says the issue was fixed, or places
 *    it in the past ("last week"), is not an emergency — unless it also says the
 *    problem is back or still happening ("again", "still").
 *  - season: an A/C failure is an emergency only in the cooling season, a heat
 *    failure only in the heating season, for the property's region and the
 *    org-local month.
 *
 * A strong pattern is a page; a weak one ("there's a leak") or a strong one in
 * a message with a joke cue is `ambiguous` and goes to the model. The golden
 * set in tests/intake/fixtures/emergency-golden.json is the eval for every
 * change here.
 */
import type { IntakeEmergencyClass } from '../types/woIntake';
import { todayYmdInTz } from '../clean/orgTime';

/**
 * `triagedBy` on an inbox item the detector routed down the emergency path
 * without a human; beside `AUTO_ACCEPT_TRIAGED_BY` for rule auto-accepts.
 */
export const EMERGENCY_TRIAGED_BY = 'system:emergency';

/** Most to least severe; a message that hits several is filed under the first. */
export const EMERGENCY_CLASSES: readonly IntakeEmergencyClass[] = ['gas', 'water', 'power', 'lockout', 'hvac'];

export interface EmergencyDetectionContext {
  /** Epoch ms or Date; the org-local month comes from this. Defaults to now. */
  now?: number | Date;
  /** IANA zone the month is read in (the org's). */
  timeZone?: string;
  /** 1-12; overrides `now` / `timeZone`. */
  month?: number;
  /** US state (code or name) of the property — selects the HVAC season. */
  state?: string;
  /** Defaults to north. */
  hemisphere?: 'north' | 'south';
}

export interface EmergencyDetection {
  /** The deterministic verdict. When `ambiguous`, a model should confirm. */
  isEmergency: boolean;
  class?: IntakeEmergencyClass;
  /** 0..1. */
  confidence: number;
  ambiguous: boolean;
}

type Strength = 'strong' | 'weak';
type HvacMode = 'cooling' | 'heating';

interface Pattern {
  re: RegExp;
  strength: Strength;
  hvac?: HvacMode;
}

// Shared fragments. Text is normalized first: lowercase, no accents, straight
// apostrophes.
const NOT = String.raw`(?:is ?n'?t|is not|not|does ?n'?t|does not|wo ?n'?t|will not|did ?n'?t|stopped|quit)`;
const ROOM = String.raw`^\s*(?:in|en)\s+(?:the |one |el |la |un |una )?(?:bath ?room|bedroom|kitchen|garage|living room|room|outlet|closet|bano|cocina|cuarto|habitacion|recamara)`;

const PATTERNS: Record<IntakeEmergencyClass, Pattern[]> = {
  gas: [
    { re: /\bsmell(?:s|ing)?\b[^.]{0,25}?\b(?:gas\b(?!\s+station)|propane\b)/, strength: 'strong' },
    { re: /\bgas\s+(?:smell|odou?r|leak)/, strength: 'strong' },
    { re: /\b(?:rotten eggs?|sulfur smell|sulphur smell)\b/, strength: 'strong' },
    { re: /\bcarbon monoxide\b|\bco (?:alarm|detector|monitor)\b/, strength: 'strong' },
    { re: /\b(?:huele|olor) a gas\b|\bfuga de gas\b|\bmonoxido\b/, strength: 'strong' },
  ],
  water: [
    { re: /\bflood(?:ing|ed|s)?\b(?!\s*lights?)/, strength: 'strong' },
    {
      re: /\b(?:water|it)(?:'s| is| was)?(?:\s+keeps?)?\s+(?:pouring|gushing|spraying|streaming|coming|dripping|leaking|pooling|rushing)\s+(?:in|out|through|from|down|into|onto|everywhere|all over)\b/,
      strength: 'strong',
    },
    { re: /\b(?:pouring|gushing|spraying)\s+(?:water|everywhere|from the ceiling)/, strength: 'strong' },
    { re: /\b(?:burst|broken|busted|cracked|split)\s+(?:water\s+)?(?:pipe|line|hose)\b|\bpipe\s+(?:burst|broke|is broken|exploded)/, strength: 'strong' },
    { re: /\b(?:hose|pipe|supply line|water line)\s+(?:\w+\s+)?(?:popped|burst|blew|came off|broke|split)\b/, strength: 'strong' },
    { re: /\b(?:is|are|got) (?:all )?under ?water\b/, strength: 'strong' },
    { re: /\b(?:water heater|heater|tank|pipe|line|hose)\s+(?:just\s+)?(?:burst|exploded|blew|ruptured)\b/, strength: 'strong' },
    {
      re: /\b(?:closet|floor|carpet|room|ceiling|bed|couch|rug|wall|hallway|kitchen|bathroom)s?\s+(?:is\s+|are\s+|got\s+)?(?:all\s+)?(?:soaked|soaking wet|drenched)\b/,
      strength: 'strong',
    },
    { re: /\bwaterfall\b|\bwater (?:wo ?n'?t|will not|does ?n'?t) (?:shut|turn|stop)\b|\bcan'?t (?:shut|turn) (?:the |off the )?water\b/, strength: 'strong' },
    { re: /\bceiling\s+(?:just\s+)?(?:collapsed|caved in|fell|is falling|came down)\b/, strength: 'strong' },
    { re: /\b(?:saliendo|saliendose|se sale)\s+(?:el\s+|la\s+)?agua\b|\bse (?:esta )?mojando todo\b/, strength: 'strong' },
    { re: /\bleak(?:ing|s|ed)?\b[^.]{0,30}?\b(?:ceiling|roof|light fixture|onto|all over|everywhere)\b/, strength: 'strong' },
    { re: /\b(?:ceiling|roof)\s+(?:is\s+)?(?:leaking|dripping|caving|collapsing)\b/, strength: 'strong' },
    { re: /\bwater\s+(?:coming\s+|dripping\s+|leaking\s+)?(?:through|from|out of)\s+(?:the\s+)?(?:ceiling|light|wall|roof|fixture)/, strength: 'strong' },
    { re: /\bwater (?:is )?everywhere\b|\bwater all over\b|\bstanding water\b|\binch(?:es)? of water\b/, strength: 'strong' },
    {
      re: /\b(?:toilet|sink|tub|bathtub|dishwasher|washer|washing machine|water heater)\b[^.]{0,20}?\boverflow(?:ing|ed)?\b/,
      strength: 'strong',
    },
    { re: /\bsew(?:age|er)\b[^.]{0,20}?\b(?:back(?:ing|ed)? up|backup|coming up|overflow)/, strength: 'strong' },
    { re: /\binundad[oa]s?\b|\binundacion\b|\bse (?:esta )?inunda/, strength: 'strong' },
    { re: /\b(?:sale|cae|entra)\s+(?:mucha\s+)?agua\b|\bagua por todas partes\b/, strength: 'strong' },
    { re: /\b(?:agua|mojad[oa]s?)\b[^.]{0,40}?\bpor todas partes\b|\bfuga (?:de agua )?(?:grande|enorme|fuerte)\b/, strength: 'strong' },
    { re: /\b(?:tubo|tuberia|cano)\s+(?:roto|rota|reventad[oa])\b|\bse reviento\b/, strength: 'strong' },
    { re: /\bleak(?:s|ing|ed)?\b/, strength: 'weak' },
    { re: /\bwater on the floor\b|\bpuddle\b/, strength: 'weak' },
    { re: /\bfuga\b(?!\s+de\s+gas)|\bgotera\b/, strength: 'weak' },
  ],
  power: [
    { re: /\b(?:no|has no|have no|without|sin) (?:power|electricity)\b/, strength: 'strong' },
    { re: /\bnothing (?:has|is getting) (?:power|electricity)\b|\b(?:all (?:the )?)?outlets (?:are )?(?:all )?dead\b/, strength: 'strong' },
    {
      re: /\b(?:power|electricity)\s+(?:just\s+|completely\s+|all\s+)?(?:is\s+|went\s+|has\s+gone\s+|'s\s+|got\s+cut\s+|cut\s+)?(?:out|off|down)\b/,
      strength: 'strong',
    },
    {
      re: /\blights (?:just )?(?:went|go|are going) (?:out|off)\b|\b(?:whole|entire) (?:house|unit|condo|place) is dark\b/,
      strength: 'strong',
    },
    { re: /\b(?:breaker|power)\b[^.]{0,20}?\b(?:wo ?n'?t|will not|does ?n'?t|can'?t)\s+(?:reset|come back|turn back on)/, strength: 'strong' },
    { re: /\bpower outage\b|\bblackout\b|\blost (?:all )?(?:power|electricity)\b/, strength: 'strong' },
    {
      re: /\b(?:outlet|plug|panel|breaker|wire|wiring|switch)\b[^.]{0,25}?\b(?:sparking|sparks|smok(?:e|ing)|burning|melted|on fire)\b/,
      strength: 'strong',
    },
    { re: /\b(?:sparks?|smoke|smoking)\b[^.]{0,25}?\b(?:outlet|plug|panel|wire|breaker|switch)/, strength: 'strong' },
    { re: /\bse (?:fue|corto) la (?:luz|electricidad|corriente)\b|\bapagon\b/, strength: 'strong' },
    { re: /\b(?:no hay|sin) (?:luz|electricidad|corriente)\b/, strength: 'strong' },
    { re: /\bbreaker (?:keeps )?trip(?:ping|s|ped)?\b/, strength: 'weak' },
  ],
  lockout: [
    {
      re: /\blocked out\b(?!\s+of\s+(?:my|our|the|his|her)\s+(?:\w+\s+)?(?:account|wifi|wi-fi|netflix|app|email|phone|tv|profile|computer|laptop))/,
      strength: 'strong',
    },
    { re: /\b(?:can'?t|cannot|can not|unable to|could ?n'?t)\s+(?:get|go)\s+in(?:to|side)?\b/, strength: 'strong' },
    { re: /\b(?:can'?t|cannot|can not|unable to|could ?n'?t)\s+(?:open|unlock)\s+(?:the\s+)?(?:front\s+|back\s+|main\s+)?door/, strength: 'strong' },
    { re: /\b(?:can'?t|cannot|can not|unable to|could ?n'?t)\s+get\s+(?:the\s+)?(?:front\s+|back\s+|main\s+)?door\s+(?:to\s+)?(?:open|unlock)/, strength: 'strong' },
    {
      re: new RegExp(String.raw`\b(?:door |lock ?box |keypad |entry |access |gate )?code\b[^.]{0,15}?\b${NOT}\s+(?:work|working|open)`),
      strength: 'strong',
    },
    {
      re: /\b(?:keypad|smart lock|lock ?box|door lock|lock)\s+(?:is\s+)?(?:dead|not working|is ?n'?t working|wo ?n'?t open|broken|jammed|stuck)\b/,
      strength: 'strong',
    },
    { re: /\bkey\b[^.]{0,25}?\b(?:wo ?n'?t|does ?n'?t|will not|does not|did ?n'?t)\s+(?:open|work|turn|fit)\b/, strength: 'strong' },
    { re: /\bdoor\s+(?:\w+\s+)?(?:wo ?n'?t|does ?n'?t|will not|is ?n'?t|did ?n'?t)\s+(?:unlock|open)/, strength: 'strong' },
    {
      re: /\b(?:keypad|smart lock|lock ?box|door lock|lock)\b[^.]{0,15}?\b(?:wo ?n'?t|does ?n'?t|is ?n'?t|will not)\s+(?:accept|take|read|recogni[sz]e)/,
      strength: 'strong',
    },
    { re: /\block ?box\b[^.]{0,20}?\bempty\b|\bno keys? (?:in|inside)\b/, strength: 'strong' },
    { re: /\b(?:lock|keypad|lock ?box)\b[^.]{0,20}?\bbatter(?:y|ies)\s+(?:is\s+|are\s+)?(?:dead|died)\b/, strength: 'strong' },
    { re: /\b(?:stuck|locked|waiting|standing) outside\b|\bcan'?t get inside\b/, strength: 'strong' },
    { re: /\bno (?:se puede|podemos|puedo|pueden|podiamos) (?:entrar|abrir)\b|\bnos quedamos (?:afuera|fuera)\b/, strength: 'strong' },
    { re: /\b(?:codigo|cerradura|llave|candado)\b[^.]{0,25}?\bno (?:funciona|sirve|abre)\b/, strength: 'strong' },
  ],
  hvac: [
    {
      re: new RegExp(
        String.raw`\b(?:ac|a/c|a c|air ?conditioner|air conditioning|air|hvac|central air|cooling)\b[^.]{0,20}?\b${NOT}\s+(?:\w+\s+)?(?:working|work|cooling|cool|turning on|turn on|coming on|come on|kicking on|kick on|running|blowing cold)`,
      ),
      strength: 'strong',
      hvac: 'cooling',
    },
    {
      re: /\b(?:ac|a\/c|air ?conditioner|air conditioning|hvac)\s+(?:unit\s+)?(?:is\s+)?(?:dead|broken|out|down)\b/,
      strength: 'strong',
      hvac: 'cooling',
    },
    { re: /\bno (?:ac|a\/c|air ?conditioning|cold air|cooling)\b/, strength: 'strong', hvac: 'cooling' },
    {
      re: /\b(?:ac|a\/c|air ?conditioner|air conditioning|hvac)\s+(?:unit\s+|system\s+)?(?:just\s+|has\s+|is\s+)?(?:quit|died|broke|went out|gave out|stopped)\b/,
      strength: 'strong',
      hvac: 'cooling',
    },
    {
      re: /\b(?:8[5-9]|9\d|1[01]\d)\s*(?:degrees|deg|°)?\s*(?:f\s+)?(?:inside|in here|in the (?:house|unit|condo|room))/,
      strength: 'strong',
      hvac: 'cooling',
    },
    { re: /\bblowing (?:hot|warm) air\b/, strength: 'strong', hvac: 'cooling' },
    { re: /\baire(?: acondicionado)?\b[^.]{0,15}?\bno (?:funciona|enfria|sirve|prende)\b|\b(?:no|sin) (?:hay |tenemos )?aire\b|\bno enfria\b/, strength: 'strong', hvac: 'cooling' },
    {
      re: /\b(?:house|unit|condo|apartment|place|it)(?:'s| is)\s+(?:really |so |very |super |extremely )?(?:hot|sweltering|boiling)\b/,
      strength: 'weak',
      hvac: 'cooling',
    },
    { re: /\bno heat(?:ing)?\b/, strength: 'strong', hvac: 'heating' },
    {
      re: new RegExp(
        String.raw`\b(?:heat|heater|heating|furnace|boiler|heat pump)\b[^.]{0,20}?\b${NOT}\s+(?:\w+\s+)?(?:working|work|turning on|turn on|coming on|come on|kicking on|kick on|heating|heat|running)`,
      ),
      strength: 'strong',
      hvac: 'heating',
    },
    {
      re: /\b(?:furnace|heater|boiler|heat|heating|heat pump)\s+(?:system\s+)?(?:is\s+|just\s+|has\s+)?(?:out|dead|broken|broke|down|died|quit|went out|gave out)\b/,
      strength: 'strong',
      hvac: 'heating',
    },
    { re: /\bno hay calefaccion\b|\bcalefaccion\b[^.]{0,15}?\bno (?:funciona|sirve|prende)\b/, strength: 'strong', hvac: 'heating' },
    { re: /\bfreezing (?:in here|inside)\b|\b(?:house|unit|condo|place|it)(?:'s| is) freezing\b/, strength: 'weak', hvac: 'heating' },
  ],
};

/** A negator in the few words before a match cancels it. */
const NEGATED_BEFORE = /\b(?:no|not|never|without|nothing|any|is ?n'?t|are ?n'?t|was ?n'?t|do ?n'?t|does ?n'?t|did ?n'?t|sin|ningun[ao]?|nunca)\s+(?:\S+\s+){0,2}$/;
/** The message says it is over. */
const RESOLVED = /\b(?:fixed|resolved|repaired|sorted out|working again|works now|back on|came back|all good|(?:it'?s|its|is|power'?s|everything'?s) back(?: on| now| up)?|cleaned (?:it )?up|never ?mind|nvm|false alarm|disregard|figured (?:it |out|the)|we'?re in now|got in|no longer|anymore|ya se (?:arreglo|resolvio|soluciono)|ya (?:funciona|esta bien|entramos)|volvio)\b/;
/** The issue is placed in the past. */
const PAST = /\b(?:last (?:week|month|year|time|stay|visit)|used to|(?:a few |two |three |\d+ )?(?:days|weeks|months) ago|la semana pasada|el mes pasado)\b/;
/** ...but it is happening now. Overrides both of the above. */
const ONGOING = /\b(?:still|again|right now|currently|keeps?|todavia|sigue|otra vez|de nuevo)\b/;
/** A strong hit with one of these is a question for the model, not a page. */
const JOKE = /\b(?:lol|lmao|rofl|haha+|hehe+|jk|just kidding|kidding|jaja+)\b|😂|🤣|😅/u;
/** A lock or code for an amenity (pool gate, gym) is not a lockout from the unit. */
const AMENITY = /\b(?:pool|gym|mailbox|amenit\w*|laundry room|storage|fob|bike)\b/;

/**
 * Recall net for phrasings no pattern covers (TURNWRK-738). Any live (not
 * resolved, not past, in-season) message that names a class's subject is
 * `ambiguous`, so the pinned model decides. Deliberately wide: trouble-word
 * lists kept missing real phrasings on the held-out set ("water spraying",
 * "code gets rejected", "blows warm air"), and a false positive here costs one
 * small yes/no model call while a false negative is an unpaged emergency.
 * Stems, not words, so texted typos ("electricty") and Spanish still land.
 */
const DOMAIN: Record<IntakeEmergencyClass, RegExp> = {
  gas: /\b(?:gas|propane|carbon monoxide|monoxid\w*|rotten eggs?|sulfur|reek\w*)\b/,
  water: /\b(?:water|agua|leak\w*|flood\w*|drip\w*|soak\w*|wet|mojad\w*|ceiling|techo|pipes?|tuber\w*|cano|toilet|inodoro|overflow\w*|fuga|gote\w*|sewage|sewer)\b/,
  power: /\b(?:power|electri\w*|elec|breakers?|outlets?|fuses?|luz|luces|corriente|lights|dark)\b/,
  lockout: /\b(?:lock\w*|keys?|keypad|code|codigo|door|puerta|entrar|get in|cerradura|llave)\b/,
  hvac: /\b(?:ac|a\/c|air|aire|hvac|heat\w*|furnace|boiler|calefac\w*|thermostat)\b/,
};
const HVAC_HEAT_WORD = /\b(?:heat|heater|heating|furnace|boiler|calefac\w*)\b/;
/** Downgrades a weak water hit to nothing: a drip is not a flood. */
const MINOR = /\b(?:small|slight|tiny|minor|little|drip(?:s|ping)?|a bit|slow|pequena|poquito)\b/;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .toLowerCase()
    // Texted contractions drop the apostrophe: "wont", "cant", "isnt".
    .replace(/\b(is|was|are|do|does|did|wo|could|would|should|has|have)nt\b/g, "$1n't")
    .replace(/\bcant\b/g, "can't");
}

function clauses(text: string): string[] {
  return text
    .split(/[.!?;\n]+|\s(?:but|pero|although|aunque)\s/)
    .map((c) => c.trim())
    .filter(Boolean);
}

interface Hit {
  cls: IntakeEmergencyClass;
  strength: Strength;
  hvac?: HvacMode;
}

function clauseHits(clause: string): Hit[] {
  const hits: Hit[] = [];
  for (const cls of EMERGENCY_CLASSES) {
    for (const p of PATTERNS[cls]) {
      const m = p.re.exec(clause);
      if (!m) continue;
      if (NEGATED_BEFORE.test(clause.slice(0, m.index))) continue;
      let strength = p.strength;
      // "no power in the bathroom" is a breaker or a bulb, not an outage.
      if (cls === 'power' && new RegExp(ROOM).test(clause.slice(m.index + m[0].length))) strength = 'weak';
      if (cls === 'lockout' && AMENITY.test(clause)) strength = 'weak';
      if (strength === 'weak' && cls === 'water' && MINOR.test(clause)) continue;
      hits.push({ cls, strength, ...(p.hvac ? { hvac: p.hvac } : {}) });
    }
  }
  return hits;
}

const HOT_STATES = new Set(['FL', 'TX', 'AZ', 'LA', 'NV', 'GA', 'AL', 'MS', 'SC', 'HI']);

/**
 * Whether an HVAC failure is an emergency in `month` (1-12). Hot states
 * (Florida, the Gulf, the desert): A/C May–Oct, heat Dec–Feb. Elsewhere: A/C
 * Jun–Sep, heat Nov–Mar. The southern hemisphere is shifted six months.
 */
export function hvacEmergencySeason(
  month: number,
  region: { state?: string; hemisphere?: 'north' | 'south' } = {},
): { cooling: boolean; heating: boolean } {
  const m = region.hemisphere === 'south' ? ((month + 5) % 12) + 1 : month;
  const state = normalizeState(region.state);
  if (state && HOT_STATES.has(state)) {
    return { cooling: m >= 5 && m <= 10, heating: m === 12 || m <= 2 };
  }
  return { cooling: m >= 6 && m <= 9, heating: m >= 11 || m <= 3 };
}

function contextMonth(ctx: EmergencyDetectionContext): number {
  if (ctx.month && ctx.month >= 1 && ctx.month <= 12) return Math.floor(ctx.month);
  const now = ctx.now instanceof Date ? ctx.now : new Date(ctx.now ?? Date.now());
  return Number(todayYmdInTz(ctx.timeZone, now).slice(5, 7));
}

/** Detect whether an inbox message is an emergency. Pure and free. */
export function detectEmergency(text: string, ctx: EmergencyDetectionContext = {}): EmergencyDetection {
  const norm = normalize(text || '');
  if (!norm.trim()) return { isEmergency: false, confidence: 0, ambiguous: false };

  const ongoing = ONGOING.test(norm);
  const resolvedMessage = RESOLVED.test(norm) && !ongoing;
  const season = hvacEmergencySeason(contextMonth(ctx), ctx);

  const hits: Hit[] = [];
  let outOfSeason = false;
  const live = resolvedMessage ? [] : clauses(norm).filter((c) => ongoing || !PAST.test(c));
  for (const clause of live) {
    for (const hit of clauseHits(clause)) {
      if (hit.hvac && !season[hit.hvac]) {
        outOfSeason = true;
        continue;
      }
      hits.push(hit);
    }
  }
  if (!hits.some((h) => h.strength === 'strong')) {
    // Subject and trouble may sit in different clauses ("the AC. it's 90 in here").
    const message = live.join(' . ');
    for (const clause of [message]) {
      for (const cls of EMERGENCY_CLASSES) {
        if (!DOMAIN[cls].test(clause)) continue;
        if (cls === 'hvac' && (outOfSeason || !season[HVAC_HEAT_WORD.test(clause) ? 'heating' : 'cooling'])) continue;
        if (cls === 'lockout' && AMENITY.test(clause)) continue;
        hits.push({ cls, strength: 'weak' });
      }
    }
  }
  if (hits.length === 0) return { isEmergency: false, confidence: 0, ambiguous: false };

  const bySeverity = (s: Strength) =>
    EMERGENCY_CLASSES.find((cls) => hits.some((h) => h.cls === cls && h.strength === s));
  const strong = bySeverity('strong');
  if (strong) {
    if (JOKE.test(text.toLowerCase())) return { isEmergency: false, class: strong, confidence: 0.5, ambiguous: true };
    return { isEmergency: true, class: strong, confidence: 0.95, ambiguous: false };
  }
  return { isEmergency: false, class: bySeverity('weak'), confidence: 0.5, ambiguous: true };
}

const STATE_NAMES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
  illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
  'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};
const STATE_CODES = new Set(Object.values(STATE_NAMES));

function normalizeState(state?: string): string | undefined {
  if (!state) return undefined;
  const s = state.trim();
  if (STATE_CODES.has(s.toUpperCase())) return s.toUpperCase();
  return STATE_NAMES[s.toLowerCase()];
}

/** The US state of a free-text address ("..., Tampa, FL 33602"), or undefined. */
export function stateFromAddress(address?: string): string | undefined {
  if (!address) return undefined;
  const tail = address.replace(/,?\s*(?:usa|us|united states)\.?\s*$/i, '').trim();
  const m = /,\s*([A-Za-z][A-Za-z ]*?)\.?\s*(?:\d{5}(?:-\d{4})?)?\s*$/.exec(tail);
  return m ? normalizeState(m[1]) : undefined;
}
