/**
 * Shared test-fixture contracts for the turnwrk suite.
 *
 * IMPORTANT: nothing under src/testFixtures/ may import `firebase-admin` (or any
 * runtime SDK). Fixtures are pure data + builders so they can be used from:
 *   - node/jsdom unit tests (no emulator), and
 *   - each app's guarded /api/test/seed route (which owns the Admin-SDK writes).
 *
 * A scenario returns a `ScenarioResult`: the auth users to create and a
 * collection -> docId -> document map to write. The writer (in each app's seed
 * route) stays app-agnostic — it just iterates this shape.
 *
 * All values are JSON-serializable (numbers for timestamps, never Date objects)
 * because scenario `overrides` cross the seed-route HTTP boundary as JSON.
 */

export type FirestoreDoc = Record<string, unknown>;

/** An auth user to create in the Firebase Auth emulator. */
export interface AuthUser {
  uid: string;
  email: string;
  /** Emulator-only password; real auth uses magic-link/Google, never this. */
  password: string;
  displayName?: string;
  emailVerified?: boolean;
}

/** The complete, app-agnostic output of a scenario. */
export interface ScenarioResult {
  auth: AuthUser[];
  /** collectionName -> docId -> document */
  firestore: Record<string, Record<string, FirestoreDoc>>;
}

export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

/** A named scenario: pure fn from optional overrides to a ScenarioResult. */
export type Scenario = (overrides?: DeepPartial<ScenarioResult>) => ScenarioResult;
