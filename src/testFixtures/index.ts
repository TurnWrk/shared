/**
 * @turnwrk/shared/testFixtures — admin-free test data for the whole suite.
 *
 * Import from unit tests and from each app's guarded /api/test/seed route:
 *   import { resolveScenario, TEST_DATA } from '@turnwrk/shared/testFixtures';
 *
 * A scenario yields `{ auth, firestore }`; the seed route creates the auth users
 * and writes the docs via the Admin SDK (which lives in the app, never here).
 */
export * from './types';
export * from './builders';
export * from './scenarios';
