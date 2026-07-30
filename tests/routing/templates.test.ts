import { describe, it, expect } from 'vitest';
import {
    addCadence,
    isTemplateDueOn,
    nextMaterializationDate,
    shouldMaterialize,
    assignPropertiesToCrews,
    orderStopsGreedy,
    materializeRouteTemplate,
    applyMembershipChange,
    insertOneOff,
    type TemplateProperty,
} from '../../src/routing/templates';
import type { RouteTemplate } from '../../src/routing/templates.types';
import type { GeoPoint } from '../../src/routing/clustering';

function template(overrides: Partial<RouteTemplate> = {}): RouteTemplate {
    return {
        id: 't1',
        name: 'Weekly pools — north',
        isActive: true,
        propertyIds: [],
        crewCount: 1,
        cadence: { value: 1, unit: 'weeks' },
        startDate: '2026-07-06', // a Monday
        createdAt: 0,
        updatedAt: 0,
        ...overrides,
    };
}

/** Build a grid of properties spread over a wider lng than lat range. */
function grid(cols: number, rows: number): TemplateProperty[] {
    const props: TemplateProperty[] = [];
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
            props.push({ id: `p-${c}-${r}`, geo: { lat: 30 + r * 0.01, lng: -95 + c * 0.05 } });
        }
    }
    return props;
}

describe('addCadence', () => {
    it('adds days, weeks, and months', () => {
        expect(addCadence('2026-07-06', 3, 'days')).toBe('2026-07-09');
        expect(addCadence('2026-07-06', 1, 'weeks')).toBe('2026-07-13');
        expect(addCadence('2026-01-31', 1, 'months')).toBe('2026-03-03'); // JS month overflow, mirrors PM behaviour
    });
});

describe('isTemplateDueOn', () => {
    it('is due on the start date and every cadence step after', () => {
        const t = template({ cadence: { value: 1, unit: 'weeks' } });
        expect(isTemplateDueOn(t, '2026-07-06')).toBe(true);
        expect(isTemplateDueOn(t, '2026-07-13')).toBe(true);
        expect(isTemplateDueOn(t, '2026-07-20')).toBe(true);
    });

    it('is not due between cadence steps or before the start', () => {
        const t = template({ cadence: { value: 1, unit: 'weeks' } });
        expect(isTemplateDueOn(t, '2026-07-10')).toBe(false); // mid-week
        expect(isTemplateDueOn(t, '2026-06-29')).toBe(false); // before start
    });

    it('honours a multi-week cadence', () => {
        const t = template({ cadence: { value: 2, unit: 'weeks' } });
        expect(isTemplateDueOn(t, '2026-07-13')).toBe(false);
        expect(isTemplateDueOn(t, '2026-07-20')).toBe(true);
    });

    it('is never due when inactive or cadence is non-positive', () => {
        expect(isTemplateDueOn(template({ isActive: false }), '2026-07-06')).toBe(false);
        expect(isTemplateDueOn(template({ cadence: { value: 0, unit: 'weeks' } }), '2026-07-06')).toBe(false);
    });
});

describe('nextMaterializationDate', () => {
    it('returns the first occurrence strictly after the given date', () => {
        const t = template({ cadence: { value: 1, unit: 'weeks' } });
        expect(nextMaterializationDate(t, '2026-07-06')).toBe('2026-07-13');
        expect(nextMaterializationDate(t, '2026-07-09')).toBe('2026-07-13');
    });

    it('returns the start date when asked before it begins', () => {
        const t = template({ cadence: { value: 1, unit: 'weeks' } });
        expect(nextMaterializationDate(t, '2026-07-01')).toBe('2026-07-06');
    });
});

describe('shouldMaterialize — future-only editing contract', () => {
    it('materialises a due future cycle that has not been materialised', () => {
        const t = template({ lastMaterializedDate: '2026-07-06' });
        expect(shouldMaterialize(t, '2026-07-13', '2026-07-08')).toBe(true);
    });

    it('refuses to re-materialise today when today is already materialised', () => {
        // Editing membership then re-running must not disturb today's route.
        const t = template({ lastMaterializedDate: '2026-07-13' });
        expect(shouldMaterialize(t, '2026-07-13', '2026-07-13')).toBe(false);
    });

    it('refuses any date in the past', () => {
        const t = template();
        expect(shouldMaterialize(t, '2026-07-06', '2026-07-13')).toBe(false);
    });

    it('refuses a date that is not a cadence occurrence', () => {
        const t = template();
        expect(shouldMaterialize(t, '2026-07-10', '2026-07-08')).toBe(false);
    });
});

describe('assignPropertiesToCrews — multi-crew distribution', () => {
    it('gives every property to one crew when crewCount is 1', () => {
        const props = grid(3, 3);
        const plans = assignPropertiesToCrews(props, 1);
        expect(plans).toHaveLength(1);
        expect(plans[0].propertyIds).toHaveLength(9);
    });

    it('splits 60 properties across 2 crews into balanced halves', () => {
        const props = grid(6, 10); // 60 properties
        const plans = assignPropertiesToCrews(props, 2);
        expect(plans).toHaveLength(2);
        expect(plans[0].propertyIds).toHaveLength(30);
        expect(plans[1].propertyIds).toHaveLength(30);
        // No property appears twice; all 60 accounted for.
        const all = plans.flatMap(p => p.propertyIds);
        expect(new Set(all).size).toBe(60);
    });

    it('distributes the remainder to the earliest crews for a non-even split', () => {
        const props = grid(1, 7); // 7 properties
        const plans = assignPropertiesToCrews(props, 3);
        expect(plans.map(p => p.propertyIds.length)).toEqual([3, 2, 2]);
    });

    it('assigns each crew a geographically-contiguous territory', () => {
        // Two well-separated clusters, 3 each; 2 crews should split them cleanly.
        const west = Array.from({ length: 3 }, (_, i) => ({ id: `w${i}`, geo: { lat: 30, lng: -96 + i * 0.01 } }));
        const east = Array.from({ length: 3 }, (_, i) => ({ id: `e${i}`, geo: { lat: 30, lng: -94 + i * 0.01 } }));
        const plans = assignPropertiesToCrews([...west, ...east], 2);
        const crewSets = plans.map(p => new Set(p.propertyIds));
        const westAllTogether = crewSets.some(s => west.every(w => s.has(w.id)));
        const eastAllTogether = crewSets.some(s => east.every(e => s.has(e.id)));
        expect(westAllTogether).toBe(true);
        expect(eastAllTogether).toBe(true);
    });

    it('uses provided crew ids, else falls back to crew-N', () => {
        const props = grid(2, 1);
        expect(assignPropertiesToCrews(props, 2).map(p => p.crewId)).toEqual(['crew-1', 'crew-2']);
        expect(assignPropertiesToCrews(props, 2, ['alpha', 'bravo']).map(p => p.crewId)).toEqual(['alpha', 'bravo']);
    });

    it('returns empty crews when there are no properties', () => {
        const plans = assignPropertiesToCrews([], 2);
        expect(plans).toHaveLength(2);
        expect(plans.every(p => p.propertyIds.length === 0)).toBe(true);
    });

    it('is deterministic across runs', () => {
        const props = grid(4, 5);
        const a = assignPropertiesToCrews(props, 3);
        const b = assignPropertiesToCrews(props, 3);
        expect(a).toEqual(b);
    });
});

describe('orderStopsGreedy', () => {
    it('produces a nearest-neighbour chain from a stable corner', () => {
        const props: TemplateProperty[] = [
            { id: 'far', geo: { lat: 30.3, lng: -95 } },
            { id: 'near', geo: { lat: 30.1, lng: -95 } },
            { id: 'sw', geo: { lat: 30.0, lng: -95 } },
        ];
        const ordered = orderStopsGreedy(props).map(p => p.id);
        expect(ordered).toEqual(['sw', 'near', 'far']);
    });

    it('preserves ≤2 element inputs unchanged', () => {
        const props = [{ id: 'a', geo: { lat: 1, lng: 1 } }, { id: 'b', geo: { lat: 2, lng: 2 } }];
        expect(orderStopsGreedy(props)).toEqual(props);
    });
});

describe('materializeRouteTemplate', () => {
    const geos = new Map<string, GeoPoint>([
        ['p1', { lat: 30.0, lng: -95.0 }],
        ['p2', { lat: 30.1, lng: -95.0 }],
        ['p3', { lat: 30.2, lng: -95.0 }],
        ['p4', { lat: 30.3, lng: -95.0 }],
    ]);

    it('materialises a due cycle across crews', () => {
        const t = template({ propertyIds: ['p1', 'p2', 'p3', 'p4'], crewCount: 2 });
        const mat = materializeRouteTemplate(t, '2026-07-13', geos);
        expect(mat).not.toBeNull();
        expect(mat!.date).toBe('2026-07-13');
        expect(mat!.crews).toHaveLength(2);
        expect(mat!.crews.flatMap(c => c.propertyIds).sort()).toEqual(['p1', 'p2', 'p3', 'p4']);
    });

    it('returns null when the template is not due', () => {
        const t = template({ propertyIds: ['p1'] });
        expect(materializeRouteTemplate(t, '2026-07-10', geos)).toBeNull();
    });

    it('skips members without a resolved geocode', () => {
        const t = template({ propertyIds: ['p1', 'missing', 'p2'], crewCount: 1 });
        const mat = materializeRouteTemplate(t, '2026-07-06', geos);
        expect(mat!.crews[0].propertyIds.sort()).toEqual(['p1', 'p2']);
    });

    it('honours the future-only guard when today is supplied', () => {
        const t = template({ propertyIds: ['p1'], lastMaterializedDate: '2026-07-13' });
        expect(materializeRouteTemplate(t, '2026-07-13', geos, { today: '2026-07-13' })).toBeNull();
        expect(materializeRouteTemplate(t, '2026-07-20', geos, { today: '2026-07-13' })).not.toBeNull();
    });

    it('reflects a membership edit on the next cycle only', () => {
        // Today (07-13) already materialised with p1..p4. Remove p4, add p5 for next week.
        const geos5 = new Map(geos).set('p5', { lat: 30.4, lng: -95.0 });
        const base = template({ propertyIds: ['p1', 'p2', 'p3', 'p4'], crewCount: 2, lastMaterializedDate: '2026-07-13' });
        const nextIds = applyMembershipChange(base.propertyIds, { remove: ['p4'], add: ['p5'] });
        const edited = { ...base, propertyIds: nextIds };

        // Today's cycle is untouched (guarded).
        expect(materializeRouteTemplate(edited, '2026-07-13', geos5, { today: '2026-07-13' })).toBeNull();
        // Next week reflects the new membership.
        const nextWeek = materializeRouteTemplate(edited, '2026-07-20', geos5, { today: '2026-07-13' });
        const members = nextWeek!.crews.flatMap(c => c.propertyIds).sort();
        expect(members).toEqual(['p1', 'p2', 'p3', 'p5']);
    });
});

describe('applyMembershipChange', () => {
    it('appends additions and drops removals, order preserved', () => {
        expect(applyMembershipChange(['a', 'b', 'c'], { add: ['d'], remove: ['b'] })).toEqual(['a', 'c', 'd']);
    });

    it('collapses duplicates and ignores add-of-removed', () => {
        expect(applyMembershipChange(['a', 'a', 'b'], { add: ['b', 'c'], remove: ['c'] })).toEqual(['a', 'b']);
    });

    it('is a no-op with no changes', () => {
        expect(applyMembershipChange(['a', 'b'], {})).toEqual(['a', 'b']);
    });
});

describe('insertOneOff — slotting a one-off without breaking the sequence', () => {
    const geoOf = new Map<string, GeoPoint>([
        ['a', { lat: 30.0, lng: -95.0 }],
        ['b', { lat: 30.1, lng: -95.0 }],
        ['c', { lat: 30.2, lng: -95.0 }],
    ]);

    it('inserts at the minimum-detour position within a crew', () => {
        const plans = [{ crewId: 'crew-1', propertyIds: ['a', 'b', 'c'] }];
        const oneOff: TemplateProperty = { id: 'x', geo: { lat: 30.05, lng: -95.0 } }; // between a and b
        const placed = insertOneOff(plans, oneOff, geoOf);
        expect(placed.crewId).toBe('crew-1');
        expect(placed.plans[0].propertyIds).toEqual(['a', 'x', 'b', 'c']);
        // Recurring order otherwise intact.
        expect(placed.plans[0].propertyIds.filter(id => id !== 'x')).toEqual(['a', 'b', 'c']);
    });

    it('picks the nearest crew when several exist', () => {
        const map = new Map(geoOf);
        map.set('d', { lat: 40.0, lng: -80.0 });
        const plans = [
            { crewId: 'west', propertyIds: ['a', 'b'] },
            { crewId: 'east', propertyIds: ['d'] },
        ];
        const oneOff: TemplateProperty = { id: 'x', geo: { lat: 40.01, lng: -80.0 } };
        const placed = insertOneOff(plans, oneOff, map);
        expect(placed.crewId).toBe('east');
        expect(placed.plans.find(p => p.crewId === 'east')!.propertyIds).toContain('x');
        expect(placed.plans.find(p => p.crewId === 'west')!.propertyIds).toEqual(['a', 'b']);
    });

    it('appends into an empty crew at zero cost', () => {
        const plans = [
            { crewId: 'busy', propertyIds: ['a', 'b', 'c'] },
            { crewId: 'idle', propertyIds: [] },
        ];
        const oneOff: TemplateProperty = { id: 'x', geo: { lat: 35, lng: -90 } };
        const placed = insertOneOff(plans, oneOff, geoOf);
        expect(placed.crewId).toBe('idle');
        expect(placed.plans.find(p => p.crewId === 'idle')!.propertyIds).toEqual(['x']);
    });

    it('handles no crews gracefully', () => {
        const placed = insertOneOff([], { id: 'x', geo: { lat: 30, lng: -95 } }, geoOf);
        expect(placed.atIndex).toBe(-1);
        expect(placed.plans).toEqual([]);
    });
});
