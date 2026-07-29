import { describe, it, expect } from 'vitest';
import { generateGoogleMapsUrls, generateCurrentLocationUrls } from '../../src/routing/mapsUrl';

type Stop = { lat: number; lng: number; formattedAddress?: string; address?: string };

const makeStops = (n: number): Stop[] =>
    Array.from({ length: n }, (_, i) => ({ lat: i + 1, lng: i + 1 }));

const params = (url: string) => new URL(url).searchParams;

describe('generateCurrentLocationUrls', () => {
    it('omits origin, ends at the last stop, lists the rest as waypoints', () => {
        const urls = generateCurrentLocationUrls(makeStops(3));
        expect(urls).toHaveLength(1);
        const p = params(urls[0]);
        expect(p.has('origin')).toBe(false);
        expect(p.get('destination')).toBe('3,3'); // last stop
        expect(p.get('waypoints')).toBe('1,1|2,2'); // all but the last
        expect(p.get('travelmode')).toBe('driving');
    });

    it('handles a single stop: one URL, no origin, no waypoints', () => {
        const urls = generateCurrentLocationUrls(makeStops(1));
        expect(urls).toHaveLength(1);
        const p = params(urls[0]);
        expect(p.has('origin')).toBe(false);
        expect(p.has('waypoints')).toBe(false);
        expect(p.get('destination')).toBe('1,1');
    });

    it('returns [] when there are no stops', () => {
        expect(generateCurrentLocationUrls([])).toEqual([]);
    });

    it('prefers formattedAddress over raw address and lat/lng', () => {
        const urls = generateCurrentLocationUrls([
            { lat: 1, lng: 1, formattedAddress: '1 Main St', address: 'raw' },
            { lat: 2, lng: 2 },
        ]);
        const p = params(urls[0]);
        // origin omitted (current location); first stop is the waypoint, last is the destination
        expect(p.has('origin')).toBe(false);
        expect(p.get('waypoints')).toBe('1 Main St'); // formattedAddress, URL-encoded in the raw string
        expect(urls[0]).toContain('1%20Main%20St');
        expect(p.get('destination')).toBe('2,2');
    });

    it('splits >9 stops into legs and only leg 1 omits origin', () => {
        // 12 stops => chain of 13 points [currentLoc, s1..s12]; legs of <=11 points each
        const urls = generateCurrentLocationUrls(makeStops(12));
        expect(urls.length).toBeGreaterThan(1);
        expect(params(urls[0]).has('origin')).toBe(false);
        for (let i = 1; i < urls.length; i++) {
            expect(params(urls[i]).has('origin')).toBe(true); // later legs start from a real stop
        }
    });
});

describe('generateGoogleMapsUrls (regression: home base loop)', () => {
    const home = { lat: 0, lng: 0 };

    it('emits origin and destination with waypoints between', () => {
        const urls = generateGoogleMapsUrls(home, home, makeStops(2));
        expect(urls).toHaveLength(1);
        const p = params(urls[0]);
        expect(p.get('origin')).toBe('0,0');
        expect(p.get('destination')).toBe('0,0');
        expect(p.get('waypoints')).toBe('1,1|2,2');
    });

    it('splits routes with more than 9 waypoints into chained legs', () => {
        const urls = generateGoogleMapsUrls(home, home, makeStops(10));
        expect(urls.length).toBeGreaterThan(1);
        // every leg has both an origin and a destination
        for (const url of urls) {
            const p = params(url);
            expect(p.has('origin')).toBe(true);
            expect(p.has('destination')).toBe(true);
        }
    });
});
