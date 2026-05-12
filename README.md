# @turnwrk/shared

Canonical types and constants shared across the turnwrk app suite
(`hostfix-cmms`, `restock`, `dispatch-assistant-api`, browser extensions).

## Consumption

Add as a file dependency in the consumer's `package.json`:

```json
"dependencies": {
  "@turnwrk/shared": "file:../turnwrk-shared"
}
```

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
