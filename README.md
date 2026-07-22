# @turnwrk/shared

Canonical types and constants shared across the turnwrk app suite
(`hostfix-cmms`, `restock`, `clean`, `turnwrk-cortex`, browser extensions).
This repo also carries `email/` (`@turnwrk/email` templates, TURNWRK-221) and
`firebase/` (canonical Firestore rules/indexes + Storage rules for the shared
`turnwrk` project, TURNWRK-220).

## Consumption (vendoring)

Deployable apps do **not** install this package from git or a registry —
Firebase App Hosting and the cortex Docker build only see the app directory,
so each consumer carries a committed vendored copy:

- `<app>/packages/shared` ← this repo (`"@turnwrk/shared": "file:./packages/shared"`)
- `<app>/packages/email`  ← `email/` (`"@turnwrk/email": "file:./packages/email"`)

Vendored copies for App Hosting apps (`clean`, `hostfix-cmms`, `restock`) get
a **generated** `package.json` whose exports point at `./src/*.ts`
(`scripts/gen-vendored-package-json.mjs`) — Next transpiles the raw TS via
`transpilePackages`; `dist/` is gitignored and must never be referenced.
`turnwrk-cortex` vendors the full tree including the canonical `package.json`
and compiles `dist/` inside Docker.

## Shipping (how consumers get new versions)

1. Merge to `main` here.
2. `.github/workflows/sync-consumers.yml` re-syncs each consumer and opens or
   updates a PR on its `bot/sync-shared` branch (clean → `trunk`; hostfix-cmms,
   restock, turnwrk-cortex → `main`). Each sync stamps
   `packages/shared/.vendor-manifest.json` with the source SHA.
3. Merging the app PR is the deploy gate (App Hosting / Coolify deploy from the
   deploy branch). Consumer CI verifies the vendored tree against the manifest
   SHA via `scripts/check-vendored-integrity.sh` (this repo is public — no
   token needed).
4. Firestore/Storage rules and indexes deploy separately and only from here:
   `.github/workflows/deploy-firebase.yml` (owner-triggered workflow_dispatch).

Local suite sync (pre-deploy testing, one-time migrations):
`scripts/sync-consumer.sh <app-root> <apphosting|full>` and
`scripts/sync-email-consumer.sh <app-root> [--strip-js]` — the
`vendor-shared-package` skill wrappers in the workspace call these.
`npm run check:vendored` is the fail-closed parity gate across the suite tree.

Import canonical types:

```ts
import type { Property, User, Role } from '@turnwrk/shared/types';
import { hasRole, ROLE_RANK } from '@turnwrk/shared/roles';
import { COLLECTIONS } from '@turnwrk/shared/collections';
```

## What lives here

- **Types** (`src/types/`) — Canonical `Property`, `User`, `Org`, `Membership`,
  `Role`, `ResupplyRequest`. Module-specific profiles (e.g. `TechnicianProfile`,
  `Cleaner`) stay in their respective apps.
- **Roles** (`src/roles.ts`) — Unified role enum and hierarchy helpers.
- **Collections** (`src/collections.ts`) — Firestore collection path constants so
  all apps agree on names.
- **Firebase rules assets** (`firebase/`) — `firestore.rules`,
  `firestore.indexes.json`, `storage.rules` for the shared `turnwrk` project.
  One monolithic ruleset covers cmms_* + restock_* + clean_* + shared
  collections; vendored into every app so emulators load real rules, deployed
  only from this repo (TURNWRK-220 — moved here from hostfix-cmms).
- **Email templates** (`email/`) — `@turnwrk/email`, a second package vendored
  to `<app>/packages/email` (not part of the `@turnwrk/shared` export map).

## What does NOT live here

- Firebase SDK imports or runtime Firestore logic (keep this package tree-shakable
  and framework-free).
- App-specific UI types, React components, hooks.
- Domain-specific profiles (Technician, Cleaner) — these stay in the owning app.
