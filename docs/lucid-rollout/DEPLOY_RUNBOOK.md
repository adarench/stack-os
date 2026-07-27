# Lucid Rollout — Coordinated Deploy Runbook

**Owner:** Stack OS · **Status:** ready to execute · **Last updated:** 2026-07-27.

Executable, ordered steps to take the Lucid rollout from *code-complete* to *live +
in pilot*. Pairs with [`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md) (the sign-off
checklist) — this is the **operational sequence**. Every substantive step is a human
action; nothing here has been executed.

> Convention: `⛔ GATE` = do not proceed past this until it's satisfied.

---

## 0. Facts (verified 2026-07-27)

| Thing | Value |
|---|---|
| Vercel project | `stack-os` · `prj_AXxRMGMH0qYv35dYXRyBgPgMZw5z` · team `team_x3ZpSDVBjfeTq9TrIzgPXrUg` · Node 24.x |
| Production domain | `https://stack-os-six.vercel.app` |
| **Production branch** | **`redesign/operator-shell`** (every prod deploy builds from this ref) |
| Current LIVE prod deploy | `dpl_iZWj6h8wMgMPqseNEkJLmwEqfmBj` = **M0** (`1de22f22`) — a rollback candidate |
| Prod-branch HEAD (not yet live) | `dc076e4` — **M1 + M2 already merged here but never deployed** |
| Stack tip | `feat/lucid-m9-vendor` — **fast-forwards** onto the prod branch; **10 commits** = M3→M10 |
| DB migrations | **0014–0017 already applied** to shared `neondb` (additive) — **nothing to run at deploy** |
| Tests | **261/261** green on `stack_os_ci`; PR chain #5→#11 green on both CI jobs |

**Two consequences to internalize before you start:**
1. **Deploying ships M1 + M2 too.** They're merged to the prod branch but the live
   deploy is still M0. This deploy moves prod from **M0 → M10** in one jump.
2. **Auto-deploy is not currently firing** (prod branch is ahead of the live deploy
   with no matching deployment). So you must **explicitly trigger/confirm** the
   production deploy after merging — don't assume a push alone ships it. Confirm the
   Vercel Git "Production Branch" + auto-deploy setting as step 1.

---

## 1. Pre-flight ⛔ GATE

- [ ] All 7 PRs (#5 M3 → #11 M9/M10) green on both CI jobs. (They are as of writing.)
- [ ] Confirm Vercel → Project → Settings → **Git**: Production Branch = `redesign/operator-shell`
      and note whether "Auto-deploy" is on. (Determines whether step 4 is automatic or manual.)
- [ ] Decide the **auth cutover** timing (step 5): deploy with `CREDENTIAL_AUTH` **off**
      first (Google-only, zero behavior change), flip it on **after** provisioning accounts.
      Recommended.
- [ ] Announce a short maintenance window to the pilot cohort (optional; the change is
      additive/backward-compatible, so downtime isn't expected).

---

## 2. Environment variables (set in Vercel → Settings → Environment Variables → **Production**) ⛔ GATE

Set these **before** the deploy so the built code has them. Never commit secrets; never
paste them into this file or a PR.

### Already set at the M0 baseline (verify present, don't change)
`DATABASE_URL` · `DATABASE_URL_UNPOOLED` · `S3_ACCESS_KEY_ID` · `S3_SECRET_ACCESS_KEY` ·
`S3_BUCKET` · `S3_ENDPOINT` · `S3_REGION` · `AUTH_GOOGLE_ID` · `AUTH_GOOGLE_SECRET` ·
`STACK_ORG_ID` · `ALLOWED_OPERATOR_EMAILS` · `NEXT_PUBLIC_NEW_SHELL=1` ·
`INNGEST_EVENT_KEY` · `VENDOR_MAGIC_LINK_SECRET`.

### New for this rollout
| Var | For | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | M6 email deep links, invite links | Set to `https://stack-os-six.vercel.app` (or the custom domain). Without it, links fall back to `localhost`. |
| `RESEND_API_KEY` | M6 real email send | From Resend, **after domain verification**. Absent → email stubs to logs (safe). |
| `RESEND_FROM_EMAIL` | M6 sender | e.g. `ops@<verified-domain>`. Must be on the verified domain. |
| `VAPID_PUBLIC_KEY` | M7 web push (server) | Generate a pair: `npx web-push generate-vapid-keys`. |
| `VAPID_PRIVATE_KEY` | M7 web push (server) | Server-only. Pair with the public key above. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | M7 web push (client) | **Must exactly equal** `VAPID_PUBLIC_KEY`. |
| `VAPID_SUBJECT` | M7 web push | `mailto:ops@<domain>` (optional; has a default). |
| `CREDENTIAL_AUTH` | M1 auth cutover | Leave **unset/off** for the initial deploy; set `=1` in step 5. |

### Must NOT be set in production
`E2E_BYPASS_AUTH` (test-only auth bypass). Confirm it is absent.

- [ ] All "already set" vars confirmed present.
- [ ] `NEXT_PUBLIC_APP_URL` set.
- [ ] Email vars set **iff** Resend domain is verified (else accept email-stub for now).
- [ ] VAPID quad set **iff** doing push validation this window (else defer M7 push; PWA install still works).

---

## 3. Merge the PR chain

The stack is linear and **fast-forwards** onto the prod branch, so there are no
conflicts. Two options — pick one.

### Option A — merge PRs bottom-up on GitHub (preserves per-PR audit trail) — recommended
Merge in this exact order; GitHub auto-retargets each next PR's base as the prior lands:

```
#5  feat/lucid-m3-commercial     → redesign/operator-shell
#6  feat/lucid-m4-technician
#7  feat/lucid-m5-completion
#8  feat/lucid-m6-email
#9  feat/lucid-m7-pwa
#10 feat/lucid-m8-acceptance
#11 feat/lucid-m9-vendor
```

- Use **"Merge"** (not squash) to keep the milestone commits distinct, or squash if you
  prefer one commit per milestone.
- If Auto-deploy is ON, each merge deploys an additive superset (safe). If you'd rather
  ship once, keep Auto-deploy OFF and do a single deploy in step 4 after #11.

### Option B — one fast-forward, single deploy (fastest; PRs auto-close as merged)
```bash
git fetch origin
git checkout redesign/operator-shell
git merge --ff-only origin/feat/lucid-m9-vendor   # fast-forward: M3→M10 in one move
git push origin redesign/operator-shell
```
GitHub marks #5–#11 merged (their commits are now on the base). Loses per-PR merge
commits but is the cleanest single-deploy path.

- [ ] Prod branch now at the stack tip (`git log -1 origin/redesign/operator-shell` shows
      the M9/M10 commit `73a9363` or your merge commit).

---

## 4. Trigger + verify the production deploy ⛔ GATE

Because the prod branch was ahead of the live deploy (see §0), **confirm a production
deployment actually starts** for the new HEAD:

- If Auto-deploy is ON: watch Vercel → Deployments for a new `target: production` build
  on `redesign/operator-shell`.
- If OFF or nothing starts within a minute: trigger it — Vercel dashboard → Deployments →
  **Redeploy** the latest `redesign/operator-shell` commit to Production, or from a clean
  checkout run `vercel --prod` (CLI, authenticated).

- [ ] New production deployment reaches **READY**.
- [ ] `curl -fsS https://stack-os-six.vercel.app/api/health/ready` returns healthy (DB reachable).
- [ ] Note the new deployment id (for the rollback step).

---

## 5. Auth cutover (M1) — controlled, after accounts exist

M1 ships **flag-off**, so the deploy in step 4 changes no auth behavior (still Google +
allowlist). To turn on username/password:

1. Provision credentialed accounts (operators, technicians Oscar/Fernando, Lucid tenants)
   via the credential helpers (`provisionStaffAccount` / `setStaffPassword` in
   `web/src/lib/server/credentials.ts`). **Secrets handled out-of-band** (password
   manager / Vercel env) — never committed, never in logs/URLs.
2. Set `CREDENTIAL_AUTH=1` in Production env → redeploy (or it applies on next deploy).
3. Verify a password login works for one operator + one tenant on mobile; confirm a wrong
   password returns a **generic** error and trips lockout after 5 tries.
- Keep Google sign-in available during the cutover window (dual-provider) — roll back by
  unsetting `CREDENTIAL_AUTH`.

---

## 6. Post-deploy smoke tests ⛔ GATE (this is the pilot go/no-go)

Run against `https://stack-os-six.vercel.app`:

- [ ] `/api/health/ready` healthy.
- [ ] Operator signs in (Google; + credential if step 5 done) and sees the console.
- [ ] **Canonical loop on real devices:** a Lucid tenant submits on a phone → WO
      **auto-assigns** the covering tech (status `assigned`) → tech opens `/tech`,
      acknowledges/starts/replies/completes → tenant sees the **completion** (date +
      technician), reopen works. (This is AT-CANONICAL, on prod.)
- [ ] Tenant thread shows the tech's **reply** but **no internal note** (leak check).
- [ ] Email: if Resend live, the status/assignment emails arrive with a working deep
      link; if stubbed, confirm the notification rows record as sent.
- [ ] Push (if VAPID set): install the PWA on a real iPhone **and** Android (Add to Home
      Screen), subscribe, and confirm an assignment push is delivered + deep-links.
- [ ] Vendor (if used): a vendor_user sees only their assigned WO and can message.

---

## 7. Rollback

The migrations are additive, so **rolling back code is safe** — old code ignores the new
columns/tables; no schema revert needed.

- **Instant:** Vercel → Deployments → the M0 deploy `dpl_iZWj6h8wMgMPqseNEkJLmwEqfmBj`
  (`1de22f22`) → **Promote to Production** / Instant Rollback. (Note: this also reverts
  M1/M2 UI, which were never live anyway.)
- **Flag-only (auth):** unset `CREDENTIAL_AUTH` to drop back to Google-only without a
  code rollback.
- **Feature-level:** unset `RESEND_API_KEY` (email → stub) or the VAPID quad (push off)
  to disable a single surface without rolling back.

---

## 8. Acceptance & pilot (hand-off to RELEASE_CHECKLIST)

- [ ] AT-CANONICAL passes on **production** with real credentialed accounts (§6).
- [ ] Security/RLS review sign-off; backups confirmed; rollback rehearsed.
- [ ] Pilot cohort + support owner named.
- [ ] **Stakeholder acceptance sign-off** → move accepted requirements to **Accepted** in
      [`REQUIREMENTS_TRACKER.md`](./REQUIREMENTS_TRACKER.md) and update
      [`STATUS.md`](./STATUS.md).

---

## Quick reference — client inputs still needed
Send the request block in [`CLIENT_INPUTS.md`](./CLIENT_INPUTS.md): users/roles,
buildings/floors/suites/companies, routing owners + fallback, categories, notification
recipients, and the pilot cohort. These populate real data for §5–§6.
