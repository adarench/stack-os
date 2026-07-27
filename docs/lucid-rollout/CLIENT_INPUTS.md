# Lucid Rollout — Client-Input Checklist

**Owner:** STACK (orchestrator) + Lucid contact · **Update freq:** as inputs arrive · **Blocking analysis feeds** [`ROADMAP.md`](./ROADMAP.md) / [`STATUS.md`](./STATUS.md).

Inputs required from **Lucid** or **STACK** to unblock milestones. **Do not
hard-code any client-specific person, building, or routing rule** — everything
here becomes configuration/records, not code. Validation = confirmed usable
(format correct, mapped, imported).

> **Blocker status (M3):** the **technical** blocker is resolved — the system now
> holds the commercial model (property=building, `floor`/`suite` on units,
> first-class `tenant_companies`, `org_settings` fallback assignee) and routes
> resident WOs (building tech → org fallback → never silently unassigned), all
> tested (`m3-routing`). What remains is **data entry**: the real Lucid buildings/
> floors/suites/company mappings + routing owners still need to be provided
> (CI-04…12 below) and entered via admin/import. Send the copy/paste request at
> the bottom to unblock population.

| # | Item | From | Contact | Why needed | Blocks | Requested | Received | Validation | Notes |
|---|---|---|---|---|---|---|---|---|---|
| CI-01 | Approved user list (names + emails) | Lucid | TBD | Individual identities; invites | M1 | TBD | — | — | no shared login (IDN-003) |
| CI-02 | Initial usernames (if not email) | Lucid | TBD | Login id | M1 | TBD | — | — | email is default |
| CI-03 | Role assignment per user | Lucid/STACK | TBD | RBAC scope | M1 | TBD | — | — | tenant/tech/operator/admin |
| CI-04 | Oscar & Fernando account info (email/phone) | STACK | TBD | Technician accounts | M3 | TBD | — | — | internal users, not vendors |
| CI-05 | Buildings list | Lucid | TBD | Location model | M3 | TBD | — | — | LOC-001 |
| CI-06 | Floors per building | Lucid | TBD | Location model | M3 | TBD | — | — | LOC-002 |
| CI-07 | Suites per floor | Lucid | TBD | Location + tenant context | M3 | TBD | — | — | LOC-003 |
| CI-08 | Tenant company names + which users belong | Lucid | TBD | Company mapping | M3 | TBD | — | — | LOC-004/005 |
| CI-09 | Building→technician ownership rules | Lucid/STACK | TBD | Auto-routing | M3 | TBD | — | — | ASN-002 |
| CI-10 | Fallback assignee | STACK | TBD | Never-unassigned | M3 | TBD | — | — | ASN-003 |
| CI-11 | Technician absence/coverage rules | STACK | TBD | Escalation | M3 | TBD | — | — | ASN-005 |
| CI-12 | Confirmed category list | Lucid | TBD | Intake | M2 | TBD | — | — | reconcile w/ commercial set |
| CI-13 | Notification recipients per event/building | Lucid/STACK | TBD | Routing | M6 | TBD | — | — | no cross-tenant leak |
| CI-14 | Resend sending domain + DNS access | STACK | TBD | Real email | M6 | TBD | — | — | EML-012 |
| CI-15 | VAPID keys + test devices (iPhone/Android) | STACK | TBD | Push launch gate | M7 | TBD | — | — | PUSH-005 |
| CI-16 | Escalation thresholds (overdue) | Lucid/STACK | TBD | Escalation email | M6 | TBD | — | — | advisory first |
| CI-17 | External vendors + COI records (post-pilot) | Lucid/STACK | TBD | Vendor loop | M9 | TBD | — | — | not a pilot blocker |
| CI-18 | Photo retention policy | Lucid/STACK legal | TBD | Compliance | M8 | TBD | — | — | carries Q-009 |
| CI-19 | Production domain (optional) | STACK | TBD | Branding/links | M8 | TBD | — | — | `*.vercel.app` works |
| CI-20 | Pilot cohort (which users go live first) | Lucid | TBD | Staged rollout | M8 | TBD | — | — | acceptance |

**Security note:** none of these inputs should include passwords. Accounts are
provisioned via invite→set-password; STACK never receives or sets a user's
plaintext password. Secrets (Resend/VAPID keys) go into Vercel env, never into
this doc or the repo.

---

## Copy/paste request for Lucid (initial data)

> **Subject: STACK rollout — data we need to set up your accounts and buildings**
>
> Hi [Lucid contact],
>
> To configure STACK for your team, could you send the following? A spreadsheet is
> perfect. We'll create individual, password-protected logins — no shared
> accounts, and no passwords are ever sent to us (each person sets their own via a
> secure invite link).
>
> **1) People (one row per person)**
> - Full name
> - Email
> - Role: *requester* (submits maintenance requests) / *manager* (oversees) —
>   we'll map these to the right access level
> - Which building(s) and suite they're in
> - Tenant company name (e.g. Lucid)
>
> **2) Buildings & spaces**
> - Building name + address
> - Floors in each building
> - Suites on each floor (e.g. S-301) and which company occupies each
>
> **3) Routing (who fixes what)**
> - For each building, the primary technician (e.g. Oscar / Fernando)
> - A fallback person if the primary is unavailable
>
> **4) Request categories** — please confirm this list works, or edit it:
> Cleaning · Supplies · Soap/restroom supplies · Beverage equipment · HVAC ·
> Plumbing · Electrical · General maintenance · Other
>
> **5) Notifications**
> - Who should be emailed for new requests, assignments, and completions
>   (per building if it differs)
>
> **6) For push notifications** (a launch requirement) — the phone models your
> team will use (iPhone/Android) so we can validate on real devices.
>
> No passwords, no sensitive documents needed at this stage. Thanks!

---

## Existing open questions to fold in (from `docs/stack-ops/OPEN_QUESTIONS.md`)
- Q-009 photo retention → **CI-18**.
- Q-005 Resend domain → **CI-14**.
- Q-011 seed data → superseded by CI-01/05/06/07/08 (real Lucid data).
- Twilio A2P 10DLC (Q-004) is **not** a pilot blocker (SMS isn't a pilot channel).
