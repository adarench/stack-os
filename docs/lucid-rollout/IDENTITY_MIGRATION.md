# Identity Canonicalization — Migration Report

**Owner:** Stack OS · **Status:** complete (prod) · **Date:** 2026-07-29

Per the auth-reset requirement to canonicalize identity **without silently
merging ambiguous users**. This documents exactly what was reconciled.

## Model

Two identity tables (unchanged): `users` (staff/technicians) and `tenant_users`
(residents). A person may legitimately exist in both (e.g. an operator who also
tests as a tenant). Canonical key going forward: **one account per `lower(email)`
per org**, per table.

## Duplicates found + reconciled

| Table | Email | Rows | Action |
|---|---|---|---|
| `users` | adam.rencher12@gmail.com | **3** (created 2026-05-12, 2026-06-16, 2026-07-29) | Kept the canonical row `78082170…` (54 work orders, 57 audit rows, 3 assignments, 20 notifications). Reattributed the two duplicates' references (audit rows) to it, then deleted them. |
| `tenant_users` | — | 0 dups | none |

No ambiguous merges: the canonical row was chosen by clear evidence (it owns
essentially all the FK references); the duplicates were near-empty auth-subject
artifacts. **Orphans:** none (`tenant_users` all have units).

Cross-table `adam.rencher12@gmail.com` (in both `users` and `tenant_users`) is
**left as-is** — it's a legitimate dual identity (operator + test resident).

## Root cause (why duplicates appeared)

`ensureUserRow` keyed only on `(org_id, clerk_user_id)` — the auth **subject**.
Google issues a different subject on re-consent, and credential vs. Google login
present different subjects, so the same person signing in a second way created a
**new** `users` row with the same email. (This is why a fresh duplicate appeared
on 2026-07-29 mid-cleanup — a login recreated it.)

## Fix (going forward)

1. **`ensureUserRow` reconciles by email** (`ensure-user.ts`): match by subject →
   else adopt the existing row with the same `lower(email)` (and point its
   subject at the current login) → else create. Every login for a person now
   lands on the **same** account regardless of auth method.
2. **Uniqueness enforced** — migration **0020** adds a unique index
   `users_email_lower_org_unique (org_id, lower(email))`. A race that slips past
   step 1 is rejected at the DB and re-read (`onConflictDoNothing` + re-select).

## Verification

- Post-cleanup: `adam.rencher12@gmail.com` → **1** `users` row; **0** duplicate
  emails in `users`.
- Migration 0020 applied to prod `neondb` (succeeded only after the dedup).
- Regression: at-canonical, credential-auth, assign-technician all green
  (exercise `ensureUserRow`).

## Rollback

Drop `users_email_lower_org_unique`; `ensureUserRow`'s reconciliation is safe to
keep regardless (it only prevents duplicates). Deleted duplicate rows are not
restored (they were near-empty artifacts; their audit references were preserved
on the canonical row).
