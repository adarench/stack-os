# Stack OS — Roadmap

**Owner:** human (orchestrator) · **Update freq:** weekly + at every phase boundary

## Current phase

**P1/P2 hardening** (in progress) — making the work-order board and list
genuinely usable as a Trello/AppFolio replacement before expanding scope.

P0 closed. P1 + P2 code landed. Hardening pass added: search, dispatcher
list view, mobile photo upload (multi-file + progress + retry + 25 MB cap),
route groups so `pnpm build` is green without creds, 41 unit tests
(was 18). Pending validation: real Neon/Clerk/R2/Resend creds and Day-3
end-to-end on a phone. P3 not started — explicitly deferred per Brad.

## Status legend

`▢ pending`  ·  `▣ in progress`  ·  `▦ blocked`  ·  `■ done`

## Phase table

| Phase | Days | Status | What | Definition of done |
|---|---|---|---|---|
| P0 | 0–2 | ■ | Docs + scaffold + Clerk + Drizzle + RLS + Inngest wiring + Twilio A2P filed + AppFolio probe | Preview deploy live; Clerk login works; RLS smoke test passes; A2P submitted; AppFolio probe done or filed in OPEN_QUESTIONS |
| P1 | 3–7 | ▣ | work_orders CRUD, properties/units, vendors, comments/attachments, mobile shell, photo capture, vendor magic-link invite | Real WO created on phone, photo uploaded, comment added, vendor assigned via magic link, SMS or email delivered |
| P2 | 8–12 | ▣→■ | Trello kanban + list views, drag-drop, dispatcher view | Dispatcher drags card from "new"→"assigned" on desktop; same view usable on phone |
| P3 | 13–18 | ▢ | Recurring tasks (`task_templates` → spawned `work_orders`), scheduling, calendar, notifications dispatch | Template spawns daily WO via Inngest cron; notifications respect prefs |
| P4 | 19–28 | ▢ | Inspections + findings → spawn WO, unit turns (project + child WOs), projects | Inspector logs finding on phone → auto-WO created; unit-turn dashboard groups WOs by stage |
| P5 | 29–35 | ▢ | Vendor COI tracking + tenant insurance + expiry alerts + vendor self-serve portal | Vendor uploads COI; expired-COI vendors blocked from new WO; tenant insurance expiry triggers email |
| P6 | 36–42 | ▢ | Light financial states (estimate → approved → invoiced → paid), approvals, costs, time entries | WO has cost estimate → approval flow → invoice attached → marked paid; threshold rules work |
| P7 | 43+ | ▢ | Operating dashboard, exec view, AppFolio import, reporting | Exec dashboard shows open WOs, COI gaps, MTD cost; AppFolio nightly read-only sync |

Days are agent-speed elapsed, with 1–2 humans driving 3–4 agents. Calendar weeks
are usually longer due to non-code blockers (Twilio A2P, AppFolio creds, vendor
adoption).

## Next focus

After P0 sign-off:
1. Lock the P1 task brief for each lane (Backend, UI, Infra).
2. Spin up Frontend & Mobile UI Agent and Infra & DX Agent in parallel with
   Schema & Backend Agent.
3. File Twilio A2P 10DLC (long pole).

## Blocked

See [`OPEN_QUESTIONS.md`](./OPEN_QUESTIONS.md).

## Rollback strategy

Every phase ships behind a feature flag (`wo_v1`, `board_v1`,
`recurring_v1`, ...). Disable to roll back. Schema migrations are reversible OR
shipped behind a flag with a dual-read period. File uploads are not deleted on
rollback.
