# Stack OS — Open questions

**Owners:** any agent files; human resolves · **Update freq:** as questions arise

Resolved questions move to `DECISIONS.md` (if architectural) or are simply
removed (if operational). Anything older than 48h escalates in the daily sync.

Format:
```
## Q-NNN — Question
**Asked:** YYYY-MM-DD · **Phase:** Px · **Blocking:** yes/no · **Owner:** <name>

Body: ...
```

---

## Q-001 — Vercel project + auth
**Asked:** 2026-05-05 · **Phase:** P0 · **Blocking:** no (placeholder OK) · **Owner:** human

Need a Vercel project linked to this repo so the preview-deploy gate in P0 can
close. Requires human `vercel login` and `vercel link`. Until then, the repo
scaffolds locally; CI and previews are deferred to Day 1.

## Q-002 — Neon project + DATABASE_URL
**Asked:** 2026-05-05 · **Phase:** P0 · **Blocking:** yes for migration · **Owner:** human

Without a real Neon connection string, `pnpm db:migrate` cannot run and the
RLS smoke test cannot pass. Need: (1) Neon project created, (2) connection
string in `.env.local`, (3) ideally a "dev" branch.

## Q-003 — Clerk publishable + secret keys
**Asked:** 2026-05-05 · **Phase:** P0 · **Blocking:** yes for sign-in · **Owner:** human

Sign-in/sign-up routes will 500 without Clerk keys. App scaffolds without
them; auth is exercised once keys land.

## Q-004 — Twilio A2P 10DLC registration
**Asked:** 2026-05-05 · **Phase:** P0 · **Blocking:** for production SMS only · **Owner:** human

Twilio A2P 10DLC takes 2–4 weeks of regulatory review. **File this on Day 1
even before SMS code exists** so the lead time is in flight while we build.
Confirm: (1) Twilio account exists, (2) brand + campaign filing started.

## Q-005 — Resend domain + DNS
**Asked:** 2026-05-05 · **Phase:** P0 · **Blocking:** for outbound email · **Owner:** human

Vendor magic links go via Resend. Need a verified sending domain (DKIM/SPF in
DNS). Until verified, magic links can't go to real vendors.

## Q-006 — R2 (or S3) bucket + access keys
**Asked:** 2026-05-05 · **Phase:** P0 · **Blocking:** for photo capture · **Owner:** human

Photo capture (P1 day 1) needs working signed-PUT URLs. R2 is the planned
choice; bucket + access keys required.

## Q-007 — AppFolio API access
**Asked:** 2026-05-05 · **Phase:** P0 · **Blocking:** no for P0; yes for P7 · **Owner:** human

A read-only credential probe in P0 confirms feasibility. Full sync (P7) is a
multi-week effort by itself. Need: AppFolio sandbox access OR documented "no
API access — manual CSV import" stance.

## Q-008 — Production domain
**Asked:** 2026-05-05 · **Phase:** P0 · **Blocking:** for production launch · **Owner:** human

Until then, `*.vercel.app` is the deploy URL.

## Q-009 — Photo retention policy
**Asked:** 2026-05-05 · **Phase:** P1 · **Blocking:** soft · **Owner:** human (legal/ops)

Need a default retention period for before/after photos and signed docs. Some
states have habitability/eviction record-keeping requirements. Defaulting to
indefinite is safe but expensive at scale.

## Q-010 — Tenant insurance enforcement
**Asked:** 2026-05-05 · **Phase:** P5 · **Blocking:** for P5 design · **Owner:** human (compliance/ops)

Should expired tenant insurance ever block lease actions, or is it always
advisory? This shapes the P5 UX.

## Q-011 — Initial seed data
**Asked:** 2026-05-05 · **Phase:** P1 · **Blocking:** for Day-3 validation · **Owner:** human

Need: 5-property / 20-unit CSV (or AppFolio export) and a 3-vendor list to
seed for the Day-3 end-to-end validation.
