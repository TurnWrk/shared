/**
 * Recurring route templates + multi-crew assignment — the domain core for the
 * Route & Recurring Verticals module (pool service / landscaping).
 *
 * Pure math only — no Firestore, no Google API. The route optimizer already
 * exists (lib/route-server.ts on Google Routes v2 computeRoutes, plus
 * route-heuristics + geo-clustering); this module does NOT re-route. It only:
 *   1. decides when a template is due (cadence from a start-date anchor),
 *   2. distributes a template's properties across N crews as balanced,
 *      geographically-contiguous clusters, and
 *   3. seeds each crew a nearest-neighbour order that the existing
 *      computeRoutes path then prices and tightens.
 *
 * Membership lives on the template (`propertyIds`); editing it changes future
 * materialisations only — `shouldMaterialize` refuses any date already
 * materialised, so today's route is never disturbed. One-off jobs slot into a
 * crew's day at the minimum-detour position, leaving the recurring sequence
 * otherwise intact.
 */

import type { GeoPoint } from './clustering';
import { distanceMiles } from './clustering';
import type {
    RouteTemplate,
    RouteTemplateCadence,
    CrewRoutePlan,
    MaterializedRoute,
    PMCadenceUnit,
} from './templates.types';

/** A property with a resolved geocode — the materialiser's input unit. */
export interface TemplateProperty {
    id: string;
    geo: GeoPoint;
}

// ---------------------------------------------------------------------------
// Cadence / due-date math
// ---------------------------------------------------------------------------

/**
 * Add a cadence step to an ISO date (YYYY-MM-DD). Mirrors
 * pmGenerator.computeNextDueDate exactly, inlined so this module stays free of
 * the Firebase-admin side effects that pmGenerator pulls in.
 */
export function addCadence(fromDate: string, value: number, unit: PMCadenceUnit): string {
    const d = new Date(fromDate + 'T00:00:00');
    if (unit === 'days') d.setDate(d.getDate() + value);
    else if (unit === 'weeks') d.setDate(d.getDate() + value * 7);
    else if (unit === 'months') d.setMonth(d.getMonth() + value);
    return d.toISOString().split('T')[0];
}

/** Max occurrences we walk forward before giving up (guards a bad cadence). */
const MAX_OCCURRENCE_WALK = 5000;

/**
 * Whether a template runs on `date`. Occurrences are startDate, startDate+cadence,
 * startDate+2·cadence, … — we walk forward from the anchor and check for an exact
 * hit, which handles month stepping (variable day counts) correctly.
 */
export function isTemplateDueOn(template: RouteTemplate, date: string): boolean {
    if (!template.isActive) return false;
    if (date < template.startDate) return false;
    const { value, unit } = template.cadence;
    if (value <= 0) return false;

    let cur = template.startDate;
    for (let i = 0; i < MAX_OCCURRENCE_WALK && cur <= date; i++) {
        if (cur === date) return true;
        cur = addCadence(cur, value, unit);
    }
    return false;
}

/** The first occurrence strictly after `afterDate` (inclusive lower bound = startDate). */
export function nextMaterializationDate(template: RouteTemplate, afterDate: string): string {
    const { value, unit } = template.cadence;
    let cur = template.startDate;
    // Walk to the first occurrence > afterDate.
    for (let i = 0; i < MAX_OCCURRENCE_WALK; i++) {
        if (cur > afterDate) return cur;
        cur = addCadence(cur, value, unit);
    }
    return cur;
}

/**
 * Whether the template should be materialised for `date` given `today`.
 *
 * Guards the "add/remove a customer updates future materialisations without
 * disturbing today's route" contract: we never (re)materialise a date in the
 * past, and never re-materialise a date at or before `lastMaterializedDate`.
 * A membership edit therefore only ever lands on the next un-materialised cycle.
 */
export function shouldMaterialize(template: RouteTemplate, date: string, today: string): boolean {
    if (date < today) return false;
    if (template.lastMaterializedDate && date <= template.lastMaterializedDate) return false;
    return isTemplateDueOn(template, date);
}

// ---------------------------------------------------------------------------
// Multi-crew geographic assignment
// ---------------------------------------------------------------------------

/** Stable crew id for index `i`, using the template's ids when provided. */
function crewIdAt(template: Pick<RouteTemplate, 'crewIds'>, i: number): string {
    return template.crewIds?.[i] ?? `crew-${i + 1}`;
}

/**
 * Longitude scale factor at a latitude so lat/lng spread is comparable in the
 * same (approx-planar) units. cos(lat) shrinks a degree of longitude toward
 * the poles.
 */
function lngScale(points: GeoPoint[]): number {
    if (points.length === 0) return 1;
    const meanLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    return Math.cos(meanLat * (Math.PI / 180));
}

/**
 * Split properties into `crewCount` balanced, geographically-contiguous groups.
 *
 * Heuristic: project every point onto the dominant spread axis (whichever of
 * lat / scaled-lng has the larger range), sort along it, then cut into
 * `crewCount` contiguous chunks with near-equal counts (the first `n % k` crews
 * take one extra). Contiguous-along-the-axis keeps each crew's territory tight;
 * equal counts keep the daily load balanced. The optimizer tightens the order
 * within each crew afterwards.
 */
export function assignPropertiesToCrews(
    properties: TemplateProperty[],
    crewCount: number,
    crewIds?: string[],
): CrewRoutePlan[] {
    const k = Math.max(1, Math.floor(crewCount));
    const template = { crewIds };

    if (properties.length === 0) {
        return Array.from({ length: k }, (_, i) => ({ crewId: crewIdAt(template, i), propertyIds: [] }));
    }

    if (k === 1) {
        return [{ crewId: crewIdAt(template, 0), propertyIds: orderStopsGreedy(properties).map(p => p.id) }];
    }

    // Choose the dominant spread axis.
    const cos = lngScale(properties.map(p => p.geo));
    const lats = properties.map(p => p.geo.lat);
    const lngs = properties.map(p => p.geo.lng * cos);
    const latRange = Math.max(...lats) - Math.min(...lats);
    const lngRange = Math.max(...lngs) - Math.min(...lngs);
    const axis: (p: TemplateProperty) => number =
        lngRange >= latRange ? p => p.geo.lng * cos : p => p.geo.lat;

    // Sort along the axis; ties broken by the other coordinate for determinism.
    const sorted = [...properties].sort((a, b) => {
        const d = axis(a) - axis(b);
        if (d !== 0) return d;
        const other = lngRange >= latRange ? a.geo.lat - b.geo.lat : a.geo.lng - b.geo.lng;
        if (other !== 0) return other;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    // Balanced contiguous chunk sizes: first (n % k) chunks get one extra.
    const base = Math.floor(sorted.length / k);
    const remainder = sorted.length % k;

    const plans: CrewRoutePlan[] = [];
    let cursor = 0;
    for (let i = 0; i < k; i++) {
        const size = base + (i < remainder ? 1 : 0);
        const chunk = sorted.slice(cursor, cursor + size);
        cursor += size;
        plans.push({ crewId: crewIdAt(template, i), propertyIds: orderStopsGreedy(chunk).map(p => p.id) });
    }
    return plans;
}

/**
 * Greedy nearest-neighbour ordering — a cheap seed for the optimizer, not the
 * final route. Starts at the point with the smallest lat+lng (a stable corner)
 * and repeatedly hops to the nearest unvisited point.
 */
export function orderStopsGreedy(properties: TemplateProperty[], start?: GeoPoint): TemplateProperty[] {
    if (properties.length <= 2) return [...properties];

    const remaining = [...properties];
    const ordered: TemplateProperty[] = [];

    // Deterministic start: caller-provided anchor, else the SW-most point.
    let seedIdx = 0;
    if (start) {
        seedIdx = nearestIndex(remaining, start);
    } else {
        for (let i = 1; i < remaining.length; i++) {
            const p = remaining[i].geo;
            const best = remaining[seedIdx].geo;
            if (p.lat + p.lng < best.lat + best.lng) seedIdx = i;
        }
    }

    let current = remaining.splice(seedIdx, 1)[0];
    ordered.push(current);
    while (remaining.length > 0) {
        const nextIdx = nearestIndex(remaining, current.geo);
        current = remaining.splice(nextIdx, 1)[0];
        ordered.push(current);
    }
    return ordered;
}

function nearestIndex(properties: TemplateProperty[], to: GeoPoint): number {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < properties.length; i++) {
        const d = distanceMiles(to, properties[i].geo);
        if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
        }
    }
    return bestIdx;
}

// ---------------------------------------------------------------------------
// Materialisation
// ---------------------------------------------------------------------------

/**
 * Materialise one cycle of a template for `date`: distribute its current
 * membership across crews, each with a seeded order. Returns `null` when the
 * template is not due on `date` (or, when `today` is given, when the date is
 * already materialised / in the past — see `shouldMaterialize`).
 *
 * `propertiesById` supplies geocodes; members without a geo are skipped (they
 * cannot be routed) — callers should surface those separately.
 */
export function materializeRouteTemplate(
    template: RouteTemplate,
    date: string,
    propertiesById: Map<string, GeoPoint>,
    opts: { today?: string } = {},
): MaterializedRoute | null {
    const due = opts.today
        ? shouldMaterialize(template, date, opts.today)
        : isTemplateDueOn(template, date);
    if (!due) return null;

    // Preserve template membership order for stable, geo-resolved inputs.
    const properties: TemplateProperty[] = [];
    for (const id of template.propertyIds) {
        const geo = propertiesById.get(id);
        if (geo) properties.push({ id, geo });
    }

    const crews = assignPropertiesToCrews(properties, template.crewCount, template.crewIds);
    return { templateId: template.id, date, crews };
}

// ---------------------------------------------------------------------------
// Membership edits (future-only by construction)
// ---------------------------------------------------------------------------

/**
 * Apply add/remove membership changes, returning the next `propertyIds` (order
 * preserved, additions appended, duplicates collapsed). The template stays the
 * source of truth, so the change only takes effect on the next materialisation.
 */
export function applyMembershipChange(
    propertyIds: string[],
    change: { add?: string[]; remove?: string[] },
): string[] {
    const removed = new Set(change.remove ?? []);
    const next: string[] = [];
    const seen = new Set<string>();
    for (const id of propertyIds) {
        if (removed.has(id) || seen.has(id)) continue;
        seen.add(id);
        next.push(id);
    }
    for (const id of change.add ?? []) {
        if (removed.has(id) || seen.has(id)) continue;
        seen.add(id);
        next.push(id);
    }
    return next;
}

// ---------------------------------------------------------------------------
// One-off insertion
// ---------------------------------------------------------------------------

/** Where a one-off job landed in a materialised route. */
export interface OneOffPlacement {
    crewId: string;
    /** Index in that crew's sequence where the one-off was inserted. */
    atIndex: number;
    plans: CrewRoutePlan[];
}

/**
 * Slot a one-off property into whichever crew/position adds the least driving,
 * leaving the recurring sequence otherwise intact. Detour cost of inserting `x`
 * between consecutive stops a→b is d(a,x)+d(x,b)−d(a,b); appending at either end
 * costs the single new leg. Empty crews cost 0 (a dedicated trip).
 */
export function insertOneOff(
    plans: CrewRoutePlan[],
    oneOff: TemplateProperty,
    geoOf: Map<string, GeoPoint>,
): OneOffPlacement {
    let best: { crew: number; index: number; cost: number } | null = null;

    plans.forEach((plan, crewIdx) => {
        const geos = plan.propertyIds.map(id => geoOf.get(id)).filter((g): g is GeoPoint => !!g);

        if (geos.length === 0) {
            consider(crewIdx, 0, 0);
            return;
        }

        // Insert before the first stop.
        consider(crewIdx, 0, distanceMiles(oneOff.geo, geos[0]));
        // Insert between each consecutive pair.
        for (let i = 0; i < geos.length - 1; i++) {
            const detour = distanceMiles(geos[i], oneOff.geo)
                + distanceMiles(oneOff.geo, geos[i + 1])
                - distanceMiles(geos[i], geos[i + 1]);
            consider(crewIdx, i + 1, detour);
        }
        // Append after the last stop.
        consider(crewIdx, geos.length, distanceMiles(geos[geos.length - 1], oneOff.geo));
    });

    function consider(crew: number, index: number, cost: number) {
        if (!best || cost < best.cost) best = { crew, index, cost };
    }

    // No crews at all: nothing to insert into.
    if (!best) {
        return { crewId: '', atIndex: -1, plans };
    }

    // `best` is only ever assigned inside `consider`, so strict-mode control flow
    // cannot see the write and narrows it to `never` past the guard above — which
    // is why the original carried `best!` assertions. Binding it once keeps the
    // type honest and drops the assertions rather than silencing the checker.
    const chosen: { crew: number; index: number; cost: number } = best;

    const nextPlans = plans.map((plan, crewIdx) => {
        if (crewIdx !== chosen.crew) return plan;
        const ids = [...plan.propertyIds];
        ids.splice(chosen.index, 0, oneOff.id);
        return { ...plan, propertyIds: ids };
    });

    return { crewId: plans[chosen.crew].crewId, atIndex: chosen.index, plans: nextPlans };
}
