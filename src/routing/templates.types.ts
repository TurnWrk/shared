/**
 * Recurring route template contracts (Verticals C7 — TURNWRK-326).
 *
 * Extracted from dispatch/types.ts so the booking app can materialise routes
 * too. Pure data — the Google Routes API call stays in Dispatch, which owns the
 * Maps credentials.
 */
import type { VerticalKey } from '../verticals';

/** Cadence unit shared with PM schedules. */
export type PMCadenceUnit = 'days' | 'weeks' | 'months';

/** Cadence for a recurring route (mirrors PM cadence: days/weeks/months). */
export interface RouteTemplateCadence {
  value: number;
  unit: PMCadenceUnit;
}

export interface RouteTemplate {
  id: string;
  orgId?: string;
  name: string;
  /**
   * Which trade this route runs. Reads the suite-wide `VerticalKey`
   * (TURNWRK-326 criterion 2) rather than the ad-hoc `'pool' | 'landscaping'`
   * hint the dispatch-local copy carried.
   */
  vertical?: VerticalKey;
  isActive: boolean;
  /** Ordered property membership — the source of truth for what the route visits. */
  propertyIds: string[];
  /** How many crews/techs the stops distribute across (each gets its own sequence). */
  crewCount: number;
  /** Stable crew identifiers; falls back to `crew-1`..`crew-N` when absent. */
  crewIds?: string[];
  /** Regeneration cadence (default: every 1 week). */
  cadence: RouteTemplateCadence;
  /** ISO date (YYYY-MM-DD) the first cycle runs — the cadence anchor. */
  startDate: string;
  /** Informational weekday the route runs (0=Sun..6=Sat); due dates derive from startDate+cadence. */
  anchorDayOfWeek?: number;
  /** Last ISO date a cycle was materialised — guards re-materialising a past/today's route. */
  lastMaterializedDate?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CrewRoutePlan {
  crewId: string;
  /** Ordered property ids the crew visits — a seed the route optimizer refines. */
  propertyIds: string[];
}

export interface MaterializedRoute {
  templateId: string;
  date: string;
  crews: CrewRoutePlan[];
}
