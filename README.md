# @turnwrk/shared

Canonical types and constants shared across the turnwrk app suite
(`hostfix-cmms`, `restock`, `dispatch-assistant-api`, browser extensions).

## Consumption

Install from the canonical git repo
([TurnWrk/shared](https://github.com/TurnWrk/shared)) in the consumer's
`package.json`:

```json
"dependencies": {
  "@turnwrk/shared": "git+https://github.com/TurnWrk/shared.git#main"
}
```

Then `npm install` — npm will clone the repo and resolve the package. To pin
to a specific commit instead of tracking `main`, replace `#main` with the
commit SHA (e.g. `#48d4a76`).

> HTTPS (not SSH) is the canonical transport: Firebase App Hosting and other
> CI containers don't ship `ssh`, so `git+ssh://` URLs fail in builds.

Next.js consumers also need `@turnwrk/shared` in `transpilePackages` (this
package ships raw `.ts`, not pre-built JS).

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

## What does NOT live here

- Firebase SDK imports or runtime Firestore logic (keep this package tree-shakable
  and framework-free).
- App-specific UI types, React components, hooks.
- Domain-specific profiles (Technician, Cleaner) — these stay in the owning app.
