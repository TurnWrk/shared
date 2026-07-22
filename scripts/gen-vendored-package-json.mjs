#!/usr/bin/env node
// Generates the vendored (App Hosting) package.json for @turnwrk/shared from
// the canonical one: every export subpath is rewritten from dist/*.js to the
// matching src/*.ts source, because consumers transpile raw TS via Next
// `transpilePackages` and dist/ is gitignored — a dist-pointing vendored
// package.json breaks App Hosting cloud builds ("Can't resolve
// '@turnwrk/shared'"; exactly this broke deploys 2026-07-05).
//
// Usage: gen-vendored-package-json.mjs [path/to/canonical/package.json]
// Writes the generated JSON to stdout. Fails if a rewritten export path does
// not exist on disk next to the canonical package.json (fail-closed: a new
// subpath must have a real src/ source).
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const canonicalPath = resolve(
  process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json')
);
const root = dirname(canonicalPath);
const canonical = JSON.parse(readFileSync(canonicalPath, 'utf8'));

function toSrc(subpath, value) {
  const target = typeof value === 'string' ? value : value?.default;
  if (typeof target !== 'string') {
    throw new Error(`export ${subpath}: no string/default target in canonical exports`);
  }
  const src = target.replace(/^\.\/dist\//, './src/').replace(/\.js$/, '.ts');
  if (!src.startsWith('./src/')) {
    throw new Error(`export ${subpath}: ${target} does not rewrite into ./src/`);
  }
  if (!existsSync(join(root, src))) {
    throw new Error(`export ${subpath}: rewritten path ${src} does not exist in ${root}`);
  }
  return src;
}

const exportsMap = {};
for (const [key, value] of Object.entries(canonical.exports ?? {})) {
  exportsMap[key] = toSrc(key, value);
}

const vendored = {
  name: canonical.name,
  version: canonical.version,
  private: true,
  type: 'module',
  main: './src/index.ts',
  types: './src/index.ts',
  exports: exportsMap,
  files: ['src'],
  scripts: { typecheck: 'tsc --noEmit' },
  devDependencies: {
    '@types/node': canonical.devDependencies['@types/node'],
    typescript: canonical.devDependencies.typescript,
  },
};

process.stdout.write(JSON.stringify(vendored, null, 2) + '\n');
