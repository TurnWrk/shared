# Security Policy

`@turnwrk/shared` is the dependency root of the turnwrk app suite: its types,
roles, collection paths, money model and Firestore rules are vendored into every
consumer app. A flaw here — a broadened rule, a mis-modelled permission, a leaked
credential — reaches production in `dispatch`, `restock`, `clean` and
`turnwrk-cortex` at once. Please treat vulnerabilities accordingly.

## Reporting a vulnerability

**Do not open a public issue for a security report.** A public issue tips off an
attacker before a fix ships. Use a private channel instead:

- **Preferred:** GitHub's private vulnerability reporting — the
  [**Report a vulnerability**](https://github.com/TurnWrk/shared/security/advisories/new)
  button on the repository's *Security* tab. This opens a private advisory only
  the maintainers can see.
- **Email:** [security@practical.works](mailto:security@practical.works) if you
  cannot use GitHub advisories.

Please include: the affected file or export, a description of the impact, and the
smallest reproduction you can share. If a credential or token appears to be
exposed, say so first — those are handled ahead of the queue.

## What to expect

- **Acknowledgement** within 3 business days.
- **An assessment** of severity and affected consumers within 7 business days —
  because a fix here fans out through `bot/sync-shared` PRs to every app, the
  advisory will note which apps need to re-deploy.
- **Coordinated disclosure:** we will agree a disclosure date with you and credit
  you in the advisory unless you prefer to remain anonymous.

## Supported versions

The suite consumes this package by vendoring the current `main`; there are no
published release tags. Only `main` is supported — fixes land there and fan out to
consumers.

## Scope

In scope: anything exported from `@turnwrk/shared` / `@turnwrk/email`, and the
Firestore/Storage rules and indexes in `firebase/`. Vulnerabilities in a specific
consumer app's own code belong in that app's tracker, though a report sent here
will be routed rather than dropped.
