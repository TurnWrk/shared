<!--
This package is vendored into dispatch, restock, clean and turnwrk-cortex. A change
here fans out to all four via bot/sync-shared PRs, so the invariants below are not
box-ticking — a broken one ships to every app at once.
-->

## What & why

<!-- One or two sentences: what this changes and the reason. Link the TURNWRK-N card. -->

## Which safety invariants does this change touch?

Tick every one this PR affects, and say how you kept it (or why the change is
deliberate) below:

- [ ] **Framework-free** — no Firebase SDK import or runtime Firestore logic added
      to the package (it must stay tree-shakable and framework-free).
- [ ] **No `undefined` in Firestore payloads** — writes omit keys rather than set
      them to `undefined`.
- [ ] **Money model** — quote/invoice/payment/payout stay integer minor units, UTC
      storage, and auditable state transitions.
- [ ] **Firestore rules / indexes** (`firebase/`) — a rules change is a live
      authorization change; an index change is called out and does not silently drop
      an existing index. Deploy is separate and owner-triggered.
- [ ] **Type / role / collection contracts** — a change to `types`, `roles.ts` or
      `collections.ts` is a suite-wide contract change; breaking consumers were
      updated or a deprecating re-export keeps them compiling for one release.
- [ ] **No suite-wide `strict: true` and no zod retrofit** introduced here.
- [ ] None of the above — this is docs / tooling / repo hygiene only.

### Notes on the invariants ticked above

<!-- For each box ticked, one line on how it was preserved. -->

## Validation

- [ ] `npm run typecheck && npm run test:run && npm run build`
- [ ] `cd email && npm run typecheck`
- [ ] Consumers that must re-sync after merge are noted (or none).
