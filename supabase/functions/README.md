# Plaid Edge Functions

Server side of bank sync. These run on Supabase Edge Functions (Deno) because
they need two things the browser must never hold: the Plaid API secret, and
the `service_role` key that can read `plaid_item_secrets`.

> **Status: written but never executed.** The environment these were authored
> in has no network route to `plaid.com`, `deno.land`, or the Supabase project,
> so the code is syntax-checked only. The API shape follows Plaid's documented
> endpoints but has not been run against Sandbox. Treat the first Sandbox run
> as the real test.

## Secrets

Set these on the Supabase project (Dashboard → Edge Functions → Secrets, or
`supabase secrets set`). They are read at runtime and never reach the client.

| Secret | Notes |
| --- | --- |
| `PLAID_CLIENT_ID` | From the Plaid dashboard |
| `PLAID_SECRET` | Use the Sandbox secret first |
| `PLAID_ENV` | `sandbox` or `production`. Defaults to `sandbox` |
| `PLAID_WEBHOOK_URL` | Optional, for later |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
injected by the platform.

Do **not** put the Plaid secret in `.env` — everything prefixed `VITE_` there
is compiled into the browser bundle.

## Deploy

```sh
supabase functions deploy plaid-link-token
supabase functions deploy plaid-exchange
supabase functions deploy plaid-sync
```

Leave JWT verification on (the default). Each function additionally resolves
the caller itself and fails closed if there is no session.

## The functions

| Function | Does |
| --- | --- |
| `plaid-link-token` | Creates a short-lived `link_token` for Plaid Link. Pass `{ item_id }` for update mode, which repairs a connection stuck in `ITEM_LOGIN_REQUIRED` without re-adding it. |
| `plaid-exchange` | Swaps the one-time `public_token` for an `access_token`, stores it server-side, and records the accounts found. The access token is never returned to the browser. |
| `plaid-sync` | Pulls changes via `/transactions/sync` and files them for review. |

## Two things worth knowing before testing

**Sync never writes to your books.** Transactions land in
`statement_imports` / `import_items` — the same review queue statement uploads
use. Nothing reaches `transactions` or changes a balance until confirmed on
the review screen. That is deliberate: automatic arrival is not a reason to
skip confirmation.

**Plaid's amount sign is the opposite of this app's.** Plaid uses positive for
money leaving an account; `quick-add` stores outflows negative. `toAppAmount()`
does the conversion. If synced amounts ever appear inverted, that helper is the
first place to look — an inversion here would silently corrupt every total,
the same way a sign bug previously disabled every over-budget warning.

## Testing in Sandbox

1. Set the secrets with Sandbox credentials, deploy the three functions.
2. Connect from the app. In Sandbox use `user_good` / `pass_good`.
3. Map at least one Plaid account to a local account or debt — **unmapped
   accounts are skipped**, since an unmapped account has nowhere to post to.
4. Run a sync and open the review queue. Check the signs: a purchase should
   show as money out, a deposit as money in.
5. Sync again. The second run should import 0 and report the rest as skipped —
   dedup keys on Plaid's `transaction_id`, stored in `import_items.raw`.

## Not built yet

- **Webhook receiver.** Plaid signs webhooks with a JWT that has to be verified
  against `/webhook_verification_key/get`; accepting them without that check
  would let anyone forge a sync. Left out rather than done unverified.
- **Scheduled sync.** Needs a service-role caller rather than a user session,
  so it wants its own entry point.
- **`removed` handling.** `/transactions/sync` reports deletions; today they
  are counted and reported but not applied, because a removal should not
  silently delete a transaction already confirmed onto the books.
