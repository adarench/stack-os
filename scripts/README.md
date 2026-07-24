# scripts/

Operational + build tooling. Run with `pnpm` (product scripts) or `tsx`
(diagnostics). **Never print secrets. Never mutate production without an explicit
opt-in** — see `_prod-guard.ts`.

## Supported, committed scripts
| Command | Script | Purpose | Prod-write? |
|---|---|---|---|
| `pnpm db:generate` | (drizzle-kit) | generate migrations from schema | no |
| `pnpm db:migrate` | `db-migrate.ts` | apply migrations + RLS policies to `DATABASE_URL` | schema/policy only |
| `pnpm db:rls:apply` | `db-rls-apply.ts` | (re)apply `rls-policies.sql` | policy only |
| `pnpm db:rls:test` | (vitest) | RLS integration test | no |
| `pnpm db:seed` | `db-seed.ts` | seed a **dev/demo** org (wipes + reseeds that org) | writes seed data |
| `tsx scripts/audit-workorders.ts --org <id>` | `audit-workorders.ts` | **read-only** work-order inventory for an org (requires explicit `--org`/`STACK_ORG_ID`; no default) | no |
| `tsx scripts/p2-smoke.ts` | `p2-smoke.ts` | read-only HTTP smoke of a deployed URL | no |
| `tsx scripts/db-verify.mjs` | `db-verify.mjs` | read-only DB verification | no |

`db-migrate.ts` / `db-rls-apply.ts` / `db-seed.ts` read `DATABASE_URL(_UNPOOLED)`
from `web/.env.local`. Point them at a dev/preview branch — not production —
unless you mean it.

## Production-write guard (`_prod-guard.ts`, committed)
Any script that can change a **live** database must call
`assertProdWriteAllowed("<name>")` first. It exits unless
`STACK_ALLOW_PROD_WRITES=1` is set:

```
STACK_ALLOW_PROD_WRITES=1 npx tsx scripts/<name>.ts
```

## Disposable / client-specific one-offs (git-ignored — NOT committed)
These hard-code a live org id, client emails, or specific record ids, and most
**mutate production**. They are intentionally kept out of the repo (`.gitignore`)
and live only on the operator's machine. Local copies carry
`assertProdWriteAllowed(...)` as defense-in-depth, **but that guard is local-only
and is NOT part of the committed M0 protection.** Treat them as disposable.

| One-off (local only) | What it did | Supported replacement |
|---|---|---|
| `cancel-all-wos.ts` | cancel every WO in an org (demo reset) | `pnpm db:seed <org>` (wipes + reseeds a dev/demo org) |
| `cancel-test-wos.ts` | cancel 6 specific rehearsal WO numbers | `db:seed`, or cancel via the operator UI |
| `invite-demo-tenants.ts` | mint magic links for specific Lucid emails, directly to prod | operator invite UI (`/admin/compliance/tenants`) |
| `restore-fallback-wo.ts` | raw-SQL restore of one specific WO (FSM bypass) | change status via the app (respects the state machine) |
| `verify-lucid-tenants.ts` | read-only check of specific Lucid emails | `audit-workorders.ts` / operator UI |

Committed protection consists of `_prod-guard.ts`, the CI committed-env-file
guard (`.github/workflows/ci.yml`), and the `.gitignore` quarantine above. Do not
commit client data (emails, org ids), credentials, or production-targeting
one-offs.
