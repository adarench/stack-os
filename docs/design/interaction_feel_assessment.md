# Interaction Feel Assessment

**Frame:** Tier 1 declared an interaction philosophy. This document
asks: does the rendered product *feel* that philosophy, or does the
felt experience contradict the intent?

I tested by:
1. Walking the product flow with the keyboard alone (no mouse).
2. Walking the same flow with mouse only (no keyboard).
3. Inspecting the screenshots at full resolution.
4. Reasoning about what an operator would feel at 9am Tuesday.

This is taste-level. Not "does it work" — "does it feel right."

---

## The five philosophy claims

Tier 1's stated principles (from
`docs/design/operator_ux_principles.md`):

1. **Pressure has visual weight.**
2. **Keyboard-first, mouse-acceptable.**
3. **Coordination beats observation.**
4. **Causality is the product.**
5. **Calm by default, loud when warranted.**
6. **The drawer is the cockpit, not a modal.**

Each below: does the render actually translate the principle to felt
behavior?

---

## Principle 1 — Pressure has visual weight

### How it should feel

Eye-tracking: the operator's gaze should land on the highest-pressure
row in <300ms without reading text. Urgent rows visually outrank
routine rows; the silhouette changes.

### How it actually feels

**Partial.** On /now, the OVERDUE lane lands hard — the red-bold title
+ tinted top border + red urgency dots + URG priority chips combine
into a clear pressure signal. ✓

But on /work (`after/02-work.png`), pressure doesn't translate. 42
rows of nearly identical composition. The severity rails on the left
edge are too subtle at this resolution; the eye doesn't pick them
up at peripheral distance. The page reads as a flat catalog, not a
triage queue.

On /compliance, the CANNOT DISPATCH panel lands but the COI rows
below are uniform. An expired-and-blocking row reads only marginally
louder than an active row.

### Felt rating: 6/10

Worked on /now. Failed on /work + /compliance row lists. The
**physical mechanism is correct** (severity rails, per-lane tails,
emphasized titles); it just doesn't apply uniformly across surfaces.

### Tightening direction

Apply per-band emphasis on /work (urgency banding with inline section
headers). Add severity rails to /compliance rows. Verify the rails
on /work actually render at peripheral-vision-detectable contrast.

---

## Principle 2 — Keyboard-first, mouse-acceptable

### How it should feel

The operator never reaches for the mouse during normal flow. `j/k`
moves between rows; `o` opens the drawer; `esc` closes it; `g+n`
jumps surfaces. Mouse is the fallback for new users.

### How it actually feels

**Functional, undiscoverable.** Testing the keyboard:
- `j` / `k` → focus moves between rows. ✓
- `o` / `enter` → drawer opens. ✓ (Drawer data loads quickly.)
- `esc` → drawer closes; focus returns to the row. ✓
- `/` → command palette opens. ✓
- `?` → shortcut overlay opens, lists all keys. ✓
- `g` then `n` → navigates to /now. ✓

But — and this matters — **none of this is visible until the
operator presses `?`**. The drawer footer says "Press esc to close"
and that's it. A new operator using mouse-only would never know `j/k`
exists. Adoption depends on word-of-mouth or onboarding tutorial,
which doesn't exist.

The closest analogue: Linear shows `?` for help, but ALSO shows
keyboard hints in tooltips on every UI button (e.g., hovering "New
issue" shows the button label + `C`). Stack OS doesn't.

### Felt rating: 5/10

The model works. The discoverability is zero. A power user gets the
full benefit; a new user gets nothing.

### Tightening direction

- Add a persistent footer hint: "press `?` for shortcuts" in the
  drawer footer.
- Add keyboard hint tooltips on the drawer status-change buttons,
  composer's `⌘↵`, etc.
- Optionally: a one-time toast on first sign-in pointing to `?`.

---

## Principle 3 — Coordination beats observation

### How it should feel

Every read surface earns its place by exposing the right action at
the right moment. The operator can act from where they read.

### How it actually feels

**Mixed.** On the drawer (especially the approval drawer in
`08-drawer-approval.png`), this principle lands hard. Sign-off /
Reject inline. Status transitions inline. Comment composer inline
in the Timeline tab.

But on /now, /work, /compliance, /inbox — the rows themselves are
inert. The operator must open the drawer to act. The interaction doc
recommended hover-actions on each row (assign / comment / more) and
inline status menus. These are Tier 2.

### Felt rating: 6/10 (drawer 10/10, rows 3/10)

The cockpit is right. The queue surfaces still feel observation-only.

### Tightening direction

Tier 2: inline row hover-actions. Inline status menus on row's status
text. Reply-inline on inbox comment notifications.

---

## Principle 4 — Causality is the product

### How it should feel

Operators feel the connections between entities. Approvals know what
they block; vendors know what they gate; inspections know what they
spawn.

### How it actually feels

**Strong on the drawer, absent everywhere else.** The drawer
articulates causality:
- WO drawer shows WAITING ON SIGN-OFF list with linked AP-refs.
- AP drawer shows WILL UNBLOCK card with the linked WO.

But **causality is invisible elsewhere**. Hovering an `WO-1001` ref
in the activity strip doesn't highlight the AP-CD8C73 approval that's
blocking it. Clicking an approval doesn't subtly mark the underlying
WO with a glow. The "ops graph" is structural in the data; it
surfaces only at the drawer scale.

This was the explicit Tier 3 move (cross-entity hover-highlight).
Deferred correctly. But the felt experience right now is "the drawer
is connected, the rest is islands."

### Felt rating: 6/10 (drawer 10/10, surfaces 4/10)

### Tightening direction

Tier 3: implement cross-entity hover-highlight. Until then, the
drawer carries the principle alone.

---

## Principle 5 — Calm by default, loud when warranted

### How it should feel

Constant motion doesn't make urgency visible — it hides it. The
screen should be quiet so when something escalates, the operator
notices.

### How it actually feels

**Reasonably calm.** The product doesn't pulse, doesn't auto-animate
KPIs, doesn't show trend arrows. The LiveIndicator dot is muted. The
auto-refresh is silent.

But there are two motion sources that still register:
1. The TimeSince ticker updates every 60s. A page open for a minute
   shifts every time chip from `-3d` to `-3d` (no change) or, worse,
   from `4h` to `5h` (a single character flicker). Subtle but real.
2. The auto-refresh fires `router.refresh()` every 15s on /now.
   This re-fetches data and re-renders. On a quiet day with no
   changes, the operator may notice the page flicker.

Both are correct architecturally. Both are *barely* noticeable. Calm
delivered.

### Felt rating: 8/10

### Tightening direction

Consider: on /now's activity strip, *new* events since the operator's
last visit should pulse briefly (2s) on scroll-into-view. This is
the "loud when warranted" piece. Not currently implemented.

---

## Principle 6 — The drawer is the cockpit, not a modal

### How it should feel

Reading + acting happen simultaneously. The drawer is part of the
work surface, not a popup that hides it.

### How it actually feels

**Yes. This is the surface where intent fully lands.** The screenshots
show queue + drawer side-by-side. The operator can `j/k` through rows
on the left while the drawer updates on the right. (Actually — does
the drawer update on row navigation? Let me re-test.)

Verified behavior:
- Open drawer on WO-1001 → press `j` → focus moves to next row, BUT
  drawer stays on WO-1001. The drawer does NOT auto-update.
- To see WO-1002 in the drawer, press `enter` after `j` to commit
  the navigation.

This is **correct** for the moment-by-moment flow (you don't want
the drawer to swap every time you press `j`). But it means the
"docked sticky preview" idea — where you `j/k` through rows and the
drawer follows — isn't implemented.

The Linear / Superhuman model has both: `j/k` to step focus, but
also `space` to peek (preview without commitment) and `enter` to
commit. Stack OS implements only commit, not peek.

### Felt rating: 8/10

The cockpit lives. The "drawer follows focus" peek mode is a Tier 2
nice-to-have.

### Tightening direction

Add `space` as a peek action that loads the drawer for the focused
row without committing the URL change. `enter` commits.

---

## Felt-experience composite

If I'm an operator at 9am Tuesday opening Stack OS for the first time
this week:

**0–5 seconds:**
- Top bar tells me state. `18 overdue (4d)`. I know I have a problem.
- Left rail tells me where: `Work 18`. I notice the red.
- /now shows OVERDUE 22 below the activity strip. I'm oriented.
**Felt: fast, calm, oriented.** ✓

**5–30 seconds:**
- I scan OVERDUE lane. URG chips on WO-1001 and WO-1002 catch me.
- I see vendor names: Stark Plumbing, Carlos Vega — I know who's on
  it.
- I see ages: `-5d`, `-4d`. I know which are oldest.
**Felt: triage works.** ✓

**30 seconds–2 minutes:**
- I click WO-1001. Drawer slides in on the right; queue stays visible.
- I read description, see WAITING ON SIGN-OFF, see two AP refs.
- I click AP-CD8C73 → drawer swaps to the approval. WILL UNBLOCK card
  shows me what I'm decoking.
- I Sign off. Toast confirms.
- I return to /now. Queue updates.
**Felt: I just did real work in 90 seconds.** ✓

**Hour 1 onwards:**
- I notice every timestamp says `-3d`. The activity strip is showing
  the same 12 events I saw yesterday. The "live" promise feels off.
- I notice /work is 42 rows of identical-looking work. I scroll. I
  scroll again. Nothing jumps out.
- I keep coming back to /now and /money. /work, /compliance, /inbox
  feel like they're for the weekly review, not the morning triage.
**Felt: the operational core is /now + drawer; the rest is reference.**

**This is the gap.** Tier 1 made /now + drawer feel elite. The rest
of the surfaces are functionally improved but emotionally not yet
operational.

---

## Verdict on each principle

| Principle | Felt rating | Status |
|---|---|---|
| Pressure has visual weight | 6/10 | /now ✓, /work ✗, /compliance ✗ |
| Keyboard-first | 5/10 | works ✓, undiscoverable ✗ |
| Coordination beats observation | 6/10 | drawer ✓, rows ✗ |
| Causality is the product | 6/10 | drawer ✓, surfaces ✗ |
| Calm by default | 8/10 | clean ✓, slight motion ⚠ |
| Drawer is the cockpit | 8/10 | docked ✓, no peek ⚠ |

Composite: **6.5/10**. Genuinely good. Not yet elite across the board.

The /now + drawer pairing is at 9/10. The /work + /compliance +
/money invoices + /inbox surfaces are at 5/10. Bringing the latter
group up to 8/10 is the Tier 2 work.

---

## What separates Stack OS from elite operator tools today

**Linear:** elite at keyboard discoverability. Every action has a
visible shortcut. Stack OS keys work but are invisible.

**Palantir Foundry:** elite at cross-entity navigation. Hovering an
entity surfaces its graph. Stack OS keeps causality local to the
drawer.

**Superhuman:** elite at peek-vs-commit. `space` previews, `enter`
commits. Stack OS commits only.

**Ramp:** elite at variable-density rows in decision queues. High-
urgency cards expand; low-urgency cards compress. Stack OS uniform.

**PagerDuty:** elite at SLA visualization. Burn-rate indicators on
each row. Stack OS shows aging but not burn rate.

None of these gaps are fatal. All are addressable in Tier 2/3.

---

## The honest taste call

The product **is** entering "real product" territory. The cockpit
+ status line + lane hierarchy + per-lane tails + docked split are
all correct decisions executed at a reasonable quality level.

The product is **not yet** elite across the board because:

1. Two surfaces (/work, /money invoices) didn't get Tier 1 attention
   and look it.
2. The interaction philosophy is more visible in the *drawer* than
   in the *queue surfaces*.
3. The seeded data has decayed; the "alive" affect is broken at the
   data layer.
4. Discoverability of the keyboard model is zero.

Fix #3 and #4 before deploy (an hour). Defer #1 and #2 to Tier 2.
That's the honest path.

---

## Final answer to "are we actually becoming elite?"

**On the cockpit: yes.** The approval drawer is best-in-class. The
WO drawer is one design pass away from best-in-class (hide empty
tabs, tighten Overview layout, drop the redundant TITLE field).

**On /now: mostly yes.** The status line, lane hierarchy, and
activity strip are all directionally elite. Two small bugs (NEEDS
YOU emphasis, stale timestamps) hold it back.

**On the queue surfaces: not yet.** /work is the gating piece. It's
the surface operators spend the most flat time on, and it currently
reads as a CRUD list. Tier 2's urgency banding + variable density +
inline actions are the path.

**On taste discipline overall: yes.** No charts. No KPI cards. No
glassmorphism. No gradients. No motion theatre. The taste decisions
*defended themselves* — we are not, despite many opportunities to be,
shipping a generic vertical SaaS.

That last point matters most. The product has resisted the dashboard
reflex. As long as that holds through Tier 2, the trajectory is
toward elite operator tooling, not toward another property-management
admin panel.
