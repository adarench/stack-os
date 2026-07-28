# Stack OS — Lucid Rollout: Build Report

**Audience:** the team · **Status:** code-complete (M0–M10), deployed to production, pre-pilot · **Date:** 2026-07-27

---

## In one line

We took the loop from the Lucid demo and shipped the whole operating loop to production: a Lucid
employee reports an issue from their phone → it **auto-routes to the covering technician** → the tech
works it on mobile and marks it done **once, authoritatively** → the resident gets a clean,
plain-language completion, and STACK gets a full audit trail. Everything landed **additively and
behind flags**, so nothing disrupted the current app.

## By the numbers

| 11 | 261 | 4 | 0 |
|---|---|---|---|
| milestones shipped (M0–M10) | automated tests, all green | DB migrations — all additive | disruption to current users |

Deployed to production at **stack-os-six.vercel.app** (`6fc639e`, health OK, `env=production`).

---

## The operating loop we shipped

1. **Report** — a Lucid employee files a request from their phone: identity, category, location, photo.
2. **Route** — it auto-assigns the covering technician for that building, with an org-level fallback. Never left unassigned.
3. **Notify** — email + push go out with a deep link straight to the job.
4. **Work** — the technician's mobile app: acknowledge, message the requester, add notes and photos.
5. **Complete** — one authoritative "complete" captures a structured record (who / where / what / photos / when).
6. **Confirm** — the resident sees a plain-language summary and can confirm or reopen; STACK sees the whole trail.

---

## What shipped, milestone by milestone

**Status key:** ✅ **Live** (active in production now) · 🔵 **Flag-off** (shipped, we switch it on) · 🟣 **Needs setup** (one infra step to go) · 📄 **Decision** (a recommendation).

| | Milestone | What changed | Status |
|---|---|---|---|
| **M0** | Foundations | Continuous-integration pipeline, health checks, structured logging, safety guards on production scripts. | ✅ Live |
| **M1** | Sign in with an account | Individual username & password for every person, with roles — including a new **Technician** role. Turns on at cutover. | 🔵 Flag-off |
| **M2** | Two demo bugs, fixed | Resident requests now auto-assign a technician, and an operator's reply actually reaches the resident. | ✅ Live |
| **M3** | Buildings & dispatch | Buildings, floors, suites and tenant companies — plus configurable routing with a fallback so nothing slips through. | ✅ Live |
| **M4** | Technician mobile app | A phone-first workspace for the field: my queue → do the work → complete, all from a jobsite. | ✅ Live |
| **M5** | Completion records | Every finished job captures a structured summary — and the resident only ever sees the resident-safe version. | ✅ Live |
| **M6** | Email that works | Branded, tappable notifications with deep links — and we fixed the status emails that were never being sent. | 🟣 Needs setup |
| **M7** | Installable app | Add to Home Screen on iPhone & Android, works offline, and web push. The pilot launch gate. | 🟣 Needs setup |
| **M8** | Acceptance test | The entire loop, proven end-to-end automatically — including the privacy boundary that keeps internal notes internal. | ✅ Live |
| **M9** | Vendor portal | Outside vendors can open the jobs assigned to them and message on them — scoped so they see nothing else. | ✅ Live |
| **M10** | Native app question | A recommendation memo: ship the installable web app for the pilot, revisit a native build with real field data. | 📄 Decision |

---

## Where it stands

### Live in production (working today, additively)
- **The full operating loop** — report → route → work → complete → confirm.
- **Auto-assignment & building routing** — nothing left unassigned.
- **Technician mobile app + completion records.**
- **Vendor portal** — and the installable app's foundation.
- **Security model & design system** — preserved, untouched.

### To go live for the pilot (gates — setup, not building)
- **Test install & push** on a real iPhone and Android.
- **Verify the email sender** so notifications deliver.
- **Create the pilot accounts** and switch password sign-in on.
- **Load Lucid's buildings & people.**
- **Stakeholder sign-off** on the live loop.

---

## Why this was low-risk

- **Additive** — four database changes, all new columns/tables; no rewrites, no data loss.
- **Reversible** — one-click rollback to the pre-rollout baseline; features toggle off independently.
- **Private by design** — internal notes never reach residents; every org's data stays isolated — proven in the acceptance test.

---

## Two honest caveats (so nobody over-promises)

- **Email** and **push** are marked *Needs setup*, not done. Email needs a verified sender address; push needs a real-device test. The code is deployed — these are config/validation steps.
- **"Live"** means the code is deployed and additive. The **technician app** and **password sign-in** only become usable once we create accounts and flip the auth cutover (that's the *Flag-off* on M1).

---

*Detail lives in this folder (`docs/lucid-rollout/`): the roadmap, requirement tracker, deploy runbook,
and the acceptance test. Production facts: `6fc639e` on `redesign/operator-shell`; rollback = promote the
M0 baseline deployment.*
