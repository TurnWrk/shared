# @turnwrk/email

Transactional email for the turnwrk app suite (`hostfix-cmms`, `restock`).
Wraps the Resend SDK and ships React Email templates so every app sends
identical-looking mail.

## Consumption

Add as a file dependency in the consumer's `package.json`:

```json
"dependencies": {
  "@turnwrk/email": "file:./packages/email"
}
```

Vendor a copy of this package into the consumer's `packages/email/` (mirrors
the `@turnwrk/shared` pattern). The canonical source lives at
`/home/alan/turnwrk.com/email/`.

## Sending

```ts
import { sendEmail } from '@turnwrk/email';

await sendEmail({
  to: 'user@example.com',
  template: 'invite',
  data: {
    code: 'ABC123',
    orgName: 'Sunset Inn',
    inviterName: 'Alan',
    acceptUrl: 'https://cmms.turnwrk.com/invite/ABC123',
  },
  idempotencyKey: `invite:${inviteId}`,
});

// Magic-link sign-in (delivered via Admin SDK + Resend, not Firebase mailer)
await sendEmail({
  to: 'user@example.com',
  template: 'magic-link',
  data: {
    signInUrl: 'https://cmms.turnwrk.com/login?...',
    appName: 'Hostfix',
    expiresInMinutes: 60,
  },
  idempotencyKey: `magiclink:${email}:${minuteBucket}`,
});
```

If `RESEND_API_KEY` is unset, `sendEmail` logs to the console and returns a
fake message id — local dev works without secrets.

## Required env vars

| Var               | Purpose                                          |
|-------------------|--------------------------------------------------|
| `RESEND_API_KEY`  | API key from resend.com (one per app)            |
| `EMAIL_FROM`      | Default `From:` address (e.g. `noreply@turnwrk.com`) |
| `EMAIL_REPLY_TO`  | Optional `Reply-To:` (e.g. `support@turnwrk.com`)    |

## Templates

Templates live in `src/templates/` as React Email components. Preview them
locally:

```sh
npm run preview
```

| Template | Purpose |
|----------|---------|
| `invite` | Org invite with accept link + manual code |
| `password-reset` | Branded password reset (Admin SDK link + Resend) |
| `magic-link` | Branded email-link sign-in (Admin SDK link + Resend) |
| `estimate` | Work-order estimate to property owner |
| `clean-notification` | Customer booking/invoice/hold emails |

To add a template:

1. Create `src/templates/<name>.tsx` — default-export a React component, also
   export a `subject(data)` function.
2. Register it in `src/templates/index.ts` and add the data shape to the
   `Templates` map in `src/types.ts`.

## What does NOT live here

- App-specific business logic (work-order email triggers, etc.) — those live
  in the calling API route.
- Audit logging (Firestore writes) — `sendEmail` returns the Resend response;
  callers log if they want.
- Webhook handlers — bounce/complaint webhooks live in the consuming app.
