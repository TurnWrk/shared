import { defineConfig } from 'vitest/config';
import path from 'path';

const rulesDeps = path.resolve(__dirname, 'rules-test-deps/node_modules');
const firebasePkg = path.join(rulesDeps, 'firebase');
const rulesTesting = path.join(rulesDeps, '@firebase/rules-unit-testing');

/**
 * Emulator-backed Firestore rules tests against canonical firebase/firestore.rules.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.{test,spec}.ts'],
    globals: true,
    reporters: ['verbose'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    server: {
      deps: {
        inline: [/@firebase\/rules-unit-testing/, /firebase/],
      },
    },
  },
  resolve: {
    dedupe: ['firebase', '@firebase/firestore', '@firebase/app'],
    alias: [
      {
        find: /^@firebase\/rules-unit-testing$/,
        replacement: rulesTesting,
      },
      {
        find: /^firebase$/,
        replacement: firebasePkg,
      },
      {
        find: /^firebase\/(.*)/,
        replacement: `${firebasePkg}/$1`,
      },
    ],
  },
});
