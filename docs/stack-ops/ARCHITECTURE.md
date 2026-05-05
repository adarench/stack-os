# Stack OS — Architecture

**Owners:** Schema & Backend Agent + Infra & DX Agent · **Update freq:** per phase or stack change

## Stack

| Layer | Choice |
|---|---|
| Frontend / server | Next.js 15 App Router · TypeScript strict · React 19 · RSC · server actions |
| DB | Neon Postgres (serverless) · Drizzle ORM · hand-written RLS |
| Auth (staff) | Clerk (orgs, roles) |
| Auth (vendor) | Magic link via Resend, `vendor_users` table |
| Storage | Cloudflare R2 (S3-compatible), signed URLs, resumable uploads |
| Background jobs | Inngest |
| Email | Resend |
| SMS | Twilio (A2P 10DLC required) |
| UI | shadcn/ui · Tailwind v4 · mobile-first |
| Hosting | Vercel (preview per PR) |

## Repo layout

```
/web                 Next.js app (App Router, RSC)
/db                  Drizzle schema, migrations, RLS, seed
/contracts           Shared TS types and state machines (no runtime deps)
/inngest             Background job functions
/scripts             Migrate / seed / ops scripts
/test/integration    Real-DB integration tests
/test/e2e            Playwright (P2+)
/docs/stack-ops      Source-of-truth docs (this file lives here)
```

`/web` is the only npm-published-style package; `/db`, `/contracts`,
`/inngest` are TypeScript directories imported via path aliases declared in
`/web/tsconfig.json`. Drizzle Kit reads `/db/schema/*` from `/web`'s context.

## Identity model

Two distinct identity systems:

1. **Staff users** — Clerk users inside a Clerk organization. The Clerk org id
   is the tenant boundary. Staff role lives on `users.role`. The `users` table
   mirrors Clerk via webhook (P1).
2. **Vendor users** — `vendor_users` row per (org, vendor, email). Vendors get
   magic-link auth, NOT Clerk. A human vendor serving multiple property
   managers gets multiple `vendor_users` rows. Magic-link tokens are stored as
   sha256 hashes with `magic_link_expires_at`.

## Tenant boundary & RLS

- Every entity table has `org_id`.
- `/db/rls-policies.sql` is hand-written and applied AFTER drizzle migrations
  by `/scripts/db-migrate.ts`.
- Every request runs inside a transaction that sets:
  - `app.org_id` (uuid)
  - `app.actor_type` (`user` | `vendor` | `system` | `inngest`)
  - `app.vendor_user_id` (when `actor_type = 'vendor'`)
- Trusted server code (system jobs, inngest, webhooks) connects via a role
  with `BYPASSRLS` so it can access cross-org data; the user-facing API does
  not.
- App-layer filtering is **not trusted**. Assume any agent might forget a
  `where org_id = ?` clause.

## Background jobs

Inngest is mounted at `/api/inngest`. `/inngest/index.ts` exports the function
list. P0 includes one no-op `healthPing` for wiring; P3 adds recurring task
spawning, COI expiry sweeps, notification dispatch.

## Storage

R2 bucket via the AWS S3 SDK. Uploads use signed PUT URLs, 15-minute expiry.
Mobile-offline strategy (P1): a local queue retries the signed URL request when
the original expires. Photos are kept on rollback.

## Deploy

- Vercel preview per PR.
- Neon: a dev branch per Vercel preview where feasible.
- Production: Vercel project + production Neon branch + DNS via the production
  domain (TBD — see `OPEN_QUESTIONS.md`).
- CI: GitHub Actions (typecheck, lint, vitest, RLS test). Filed for P0.

## Runbook (P0 stub)

P0 is local-first; runbook expands in P1.

| Operation | Command |
|---|---|
| Install | `pnpm install` |
| Generate migration | `pnpm db:generate` |
| Apply migrations + RLS | `pnpm db:migrate` |
| Apply RLS only | `pnpm db:rls:apply` |
| Run RLS tests | `pnpm db:rls:test` |
| Dev server | `pnpm dev` |
| Typecheck | `pnpm typecheck` |
| Build | `pnpm build` |

## Mobile / PWA notes

- Manifest at `/manifest.webmanifest` (P0 stub; icons added P1).
- Service worker added in P1.
- iOS push requires 16.4+ and Add-to-Home-Screen — unreliable; treat SMS as
  the primary push channel.
- Photo capture uses `<input type="file" capture="environment">` plus a
  resumable upload queue.
