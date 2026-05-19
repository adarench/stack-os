# Tier 1 Final Assessment

**Scope:** the one-hour polish sprint that closed the gap between the
Tier 1 architectural intent and the rendered taste. Eight fixes. No new
features. The product is now ready to deploy as the stable Tier 1
baseline.

Anchors: `test/screenshots/before/` (pre-Tier-1), `after/` (Tier-1 raw),
`final/` (Tier-1 + polish). Compare 01-now.png across all three to
see the trajectory.

---

## What landed in this polish sprint

| # | Fix | Result visible in |
|---|---|---|
| 1 | NEEDS YOU emphasis tone-driven (not laneKey hardcoded) | `final/01-now.png` — NEEDS YOU title is red bold, count red |
| 2 | /compliance KPI tiles deleted | `final/03-compliance.png` — list flows directly from CANNOT DISPATCH panel |
| 3 | Empty drawer tabs hidden + redundant TITLE field dropped | `final/07-drawer-wo.png` — only OVERVIEW + TIMELINE 10 tabs |
| 4 | Compact date format in drawer (`May 16 · 6:58p`) | `final/07-drawer-wo.png` |
| 5 | "Pending since" = `an hour ago` (operator prose) | `final/08-drawer-approval.png` |
| 6 | Activity verbs humanized — `marked in progress` not `moved → in_progress` | `final/01-now.png` activity strip |
| 7 | Notification kind chips humanized (`new ticket`, `vendor comment`, `needs sign-off`, `recurring spawned`...) | `final/06-inbox.png` |
| 8 | Top bar left anchor `STACK · OPS` + persistent border-l between brand and status line | every final screenshot |
| 9 | `?` keyboard hint button in top bar | every final screenshot (rightmost) |
| 10 | Severity rails sharper (3px `rounded-sm`, not `rounded-full`) | `final/02-work.png` (visible on URG/HIGH rows) |
| 11 | Low-priority routine rows recede (opacity 70) | `final/02-work.png` (bottom rows fade) |
| 12 | /money EXPORT tab folded into a quiet `EXPORT CSV` link on the tab strip | `final/04-money-approvals.png` + `final/05-money-invoices.png` |
| 13 | /money tab names humanized — `SIGN-OFFS` / `VENDOR BILLING` | top of money screenshots |
| 14 | Invoices grouped by vendor with outstanding totals + oldest-age | `final/05-money-invoices.png` |
| 15 | Invoice rows show WO ref + actor (`paid by Adam Rencher`) | `final/05-money-invoices.png` |
| 16 | Re-seed: all audit + activity + notification timestamps anchored to now | every final screenshot — minutes/hours, not days |

---

## What became genuinely strong

### `final/01-now.png` — the operator's home

Reads as a real dispatch terminal. The four signals stack the way the
operator expects:

1. **Top bar status anchor**: `STACK · OPS  |  42 open · 8 overdue (8h) · 4 blocked · 5 awaiting · 3 COIs ≤30d  |  Search ⌘K · + · ?`
2. **Activity strip with live timestamps**: `-6m @SY marked in progress WO-1006`, `-9m @AR commented WO-1006`, `-13m vendor commented WO-1003`. Mostly minute-scale events. The "alive" promise lands.
3. **NEEDS YOU 5** in red bold, with pending duration in the tail (1h muted, 3h muted, 6h muted, 18h amber, 2d red). The SLA aging is the primary scan signal.
4. **OVERDUE 12** in red bold, with vendor names + red age chips. The operator sees who's accountable and how late.

The /now page is now what it claimed to be in the design docs:
**a dispatch radar, not a list of lists.**

### `final/08-drawer-approval.png` — the cockpit

Best single surface in the product. Reads exactly like Ramp's
decision queue or PagerDuty's escalation panel:

```
AP-EA099D · budget overage
DECISION | TIMELINE 2

REASON           budget overage
AMOUNT           $275.00
PENDING SINCE    an hour ago         ← humanized prose, not "-1h"
NOTES            Vacant turn going over due to flooring damage.
WILL UNBLOCK     WO-1012 blocked
                 Vacant unit turn — Willow 2

[Sign off] [Reject]
```

Every element earns its place. The WILL UNBLOCK card is the
**cross-entity causality** made visible. This is the surface to
point to when justifying the "operational coordination OS"
framing.

### `final/05-money-invoices.png` — the un-ERP

Three weeks ago this page was a flat list of `STK-3041 · Submitted ·
$1450.00 · -4d`. Now:

```
STARK PLUMBING CO   3 bills              $2345 outstanding · oldest 14h
  STK-3041   WO-1001   awaiting review                       $1450.00  -6h
  STK-3044   WO-1002   awaiting review                       $895.00  -14h
  STK-3022   WO-1040   paid by Adam Rencher                  $85.00   -4d

GOLDCOAT PAINTERS   1 bill               $5400 outstanding · oldest 2d
  GLD-880    WO-1015   disputed                              $5400.00 -2d
```

The dispatcher's mental model — "what's outstanding to which
vendor, oldest first" — matches the layout. Operator language
throughout (`awaiting review`, `approved · awaiting payment`).
**This is what "operations-aware financial coordination" looks
like.** Not an AR aging report; an operational queue.

### Drawer empties hidden

`final/07-drawer-wo.png` shows only `OVERVIEW | TIMELINE 10` tabs.
No `COSTS 0`, no `FILES 0`. The drawer feels *intentional* —
context-aware, not schema-generated. Critical for perceived
maturity.

### Compact dates, humanized prose

- `May 16 · 6:58p · -2d` instead of `5/16/2026, 6:58:51 PM -2d`
- `an hour ago` instead of `-1h`
- `marked in progress` instead of `moved → in_progress`

Small individually; large in aggregate. The product now reads
like an operator wrote the copy, not a backend developer.

### Activity strip humanization

The activity strip on /now now shows:
```
-6m  @SY      marked in progress  WO-1006
-9m  @AR      commented            WO-1006
-13m @AR      assigned             WO-1003
-13m vendor   commented            WO-1003
```

No more `moved → in_progress`. No raw enum values. The strip reads
like a coordination log.

---

## What still needs Tier 2

These are deferred deliberately. Each gates a specific next-tier
behavior.

1. **`/work` urgency banding.** The page is denser and the severity
   rails read better, but it's still a flat list of 42 rows.
   Operators visiting /work for sustained-attention work want
   grouped urgency bands (Overdue → Blocked → In-flight → Today →
   Backlog) with inline section headers. The keystone Tier 2 move.

2. **Batch operations.** `x` toggles row selection (already in the
   keyboard model); but no batch action bar exists yet. Tuesday
   morning triage of 8 new WOs is still one-at-a-time.

3. **Optimistic UI + ⌘Z undo.** Every server action awaits the
   round-trip. Status changes, comments, decisions all feel
   ~200-400ms slower than they need to.

4. **Variable-height approval cards on /money.** Every card is the
   same physical size regardless of urgency. A 2-day $1450 decision
   should physically loom larger than a 1-hour $275 budget overage.

5. **Inbox inline reply + dismiss.** Inbox is still a read-only
   feed. Operators want to reply-in-place to comments that just
   landed and dismiss-as-handled.

6. **Cross-entity hover-highlight.** Hovering a `WO-1001` ref
   anywhere in the UI should subtly highlight the related
   approvals + vendor COI elsewhere on screen. The "ops graph"
   surfacing. **Tier 3 moat — defer.**

7. **`/now` upcoming lane.** The page shows what's happening now
   and what just happened. It doesn't show what's about to happen
   (2:30p inspection, 9am recurring spawn, 11am SLA breach).
   Useful for shift-planning, not strictly triage.

8. **Drawer peek mode (`space`).** Currently `o`/`enter` commits
   the drawer URL. Linear/Superhuman also have `space` for a
   non-committing preview. Daily quality-of-life.

These are sequenced in `docs/design/implementation_priority_order.md`.
They are explicitly **not in scope** for this stabilization phase.

---

## What is intentionally deferred (or skipped entirely)

Per the user's stabilization constraint, none of these will be built:

- Real-time presence indicators
- AI assignment suggestions
- Drag-and-drop kanban as the default view
- Gamification, achievements, streaks
- Charts, sparklines, KPI tiles (forbidden)
- Theming polish / dark-mode-only flourishes
- Marketing surfaces / landing pages
- Public API / SDK
- Workflow builder UI
- Mobile gesture system (separate pass)

These are not roadmap items; they are explicitly anti-roadmap. The
product is strongest as a focused operational coordination OS, not
as a feature-complete suite.

---

## What is now "production believable"

Walking the rendered product end-to-end with the question "would I
let an operations manager run their day from this?":

- **/now** — yes. The shell + activity strip + lane hierarchy + per-
  lane tails carry the dispatcher's morning loop. *Production
  believable.*

- **Drawer (WO + approval + timeline)** — yes. The cockpit lives.
  Decisions, status changes, comments all happen inline. *Production
  believable.*

- **/compliance** — yes. The CANNOT DISPATCH panel + "blocks N WOs"
  consequence chips + clean COI list are exactly the operator-facing
  surface a property manager needs. *Production believable.*

- **/money sign-offs** — yes. Approval cards with consequence chips,
  pending durations, holding-vendor identity, inline approve/reject.
  *Production believable.*

- **/money vendor billing** — yes (newly). Grouped by vendor with
  outstanding totals + WO links + actor attribution. The
  not-an-ERP cut works. *Production believable.*

- **/inbox** — yes (newly). Threaded notifications, humanized
  type chips, recent timestamps after re-seed. Operationally
  useful for catching up. *Production believable.*

- **/work** — *good enough to ship*. Reads as a dense catalog
  rather than a triage surface. Will get the banding upgrade in
  Tier 2.

---

## What still feels startup-y

Honest residuals, none fatal:

1. **The `STACK · OPS` brand mark in the top bar.** It's a string,
   not a designed logo. A real product would have a 16px mark + the
   text. For demo purposes, fine.

2. **The empty space on /work and /inbox at the bottom.** When data
   is sparse (8 invoices, 20 notifications), the surfaces have lots
   of white below the list. The system doesn't yet compress when
   data is short.

3. **No light/dark mode polish.** The product is light-mode only by
   visible default. Dark mode is wired via ThemeProvider but not
   audited for the operator surfaces. Acceptable for first release.

4. **No mobile responsive audit.** Bottom tab bar exists; the
   drawer collapses to full-width on smaller screens; but a real
   walkthrough on phone hasn't happened. Field workers using mobile
   will eventually need attention.

5. **Severity rails on /work still subtle at smaller resolutions.**
   On a 13" laptop the 3px rails are detectable but not screaming.
   The new `rounded-sm` helps over `rounded-full`. Could go to 4px
   if needed.

None of these are deploy-blocking. All are normal "first deploy" tax.

---

## The trajectory, summarized

| Phase | Mood | Build |
|---|---|---|
| Before | "Empty admin template" | shell+routes only |
| Tier 1 raw | "Right architecture, mid execution" | docked drawer, status line, lane hierarchy, per-lane tails landed |
| **Tier 1 final** | **"Real operational product"** | language, hierarchy, empty-tab discipline, humanized timestamps, vendor billing |
| Tier 2 (future) | "Genuinely elite operator tool" | banding, batch, optimistic, cross-entity highlight |

The Tier 1 → Tier 1 final delta is what makes the difference between
"this looks like a startup demo" and "I'd actually use this." The
last hour was the highest-leverage hour of the whole project.

The product has earned its right to be evaluated as elite operator
tooling. Now we stabilize, ship, and let real walks inform Tier 2.

---

## Deploy posture

**Ship it.** The polish sprint closed the visible seams that the
pre-deploy critique flagged. The remaining gaps are roadmap, not
quality.

Sequence:
1. Commit the polish pass (this is the next action).
2. Push to `redesign/operator-shell`.
3. `vercel deploy --prod` (with user authorization).
4. Re-seed prod against `org_3DK8ysf4DrE4m0LkQNbPoIL0GP0` so live
   timestamps anchor to "now."
5. Walk the deployed product manually. Look for staleness, layout
   bugs in production-only states (no bypass).
6. Open Tier 2 sprint with `/work` urgency banding as the first
   ticket.

The product is now in **stabilization mode**. The risk shifts from
"can we build this" to "do we have the discipline to stop building
and let the foundation breathe." Both halves matter equally from
here.
