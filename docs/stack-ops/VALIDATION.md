# Stack OS — Validation log

**Owners:** QA / Test Validator + active agents · **Update freq:** every merge

Each entry records what was validated, by whom, with what evidence. This is
the audit trail that lets us mark phases done.

Format:
```
### YYYY-MM-DD · Phase · Feature
Tested by: <name>
Tests: <names of automated tests>
Manual QA: <steps and outcome>
Screenshots: <links if UI>
Signoff: <orchestrator name>
```

---

## P0

### 2026-05-05 · P0 · Repo scaffold
- Tests: `pnpm install` clean; `pnpm typecheck` passes silently
- Manual QA: deferred — Vercel preview deploy requires human Vercel auth (see `OPEN_QUESTIONS.md` Q-001)
- Schema integration test: deferred — requires `DATABASE_URL` on a real Neon branch (Q-002)
- RLS smoke test: deferred — requires `DATABASE_URL` on a real Neon branch (Q-002)
- Signoff: code-side complete; awaiting external creds

## P1 (first push)

### 2026-05-05 · P1 · server lib + UI + tests
- Tests: 13 vitest unit tests green (8 work-order FSM + 4 token + 1 harness); 6 RLS integration tests `todo` (auto-skipped without `DATABASE_URL`)
- Typecheck: clean
- Manual QA: deferred — needs Clerk + Neon + R2 + Resend creds; Day-3 phone validation pending
- Signoff: code-side complete; awaiting external creds + Day-3 phone walkthrough

### Day-3 manual QA checklist (pending creds)
- [ ] Staff signs in via Clerk on phone
- [ ] Staff creates property + unit + vendor + invites vendor user (magic link reaches inbox or appears in dev log)
- [ ] Vendor opens magic-link URL on phone, lands on `/vendor`, sees nothing assigned
- [ ] Staff creates a work order with property + unit
- [ ] Staff assigns vendor — WO advances to `assigned`
- [ ] Vendor refreshes `/vendor`, sees the assigned WO
- [ ] Staff captures `before_photo` from phone camera; image uploads via signed URL; appears in WO grid
- [ ] Staff transitions `assigned → scheduled → in_progress → resolved → verified → closed`
- [ ] All transitions audited; cross-org RLS smoke test passes
