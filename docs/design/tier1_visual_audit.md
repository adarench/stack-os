# Tier 1 Visual Audit

**Method:** I walked every PNG in `test/screenshots/after/` against the
matching baseline in `test/screenshots/before/`, viewed full-resolution.
This document is what I actually saw rendered — not what was intended,
not what the code says. Refs are real screenshot file paths.

The intent of Tier 1 was structural. The intent landed. This document
asks the harder question: **does the rendered implementation actually
read as elite, or did engineering taste leak through?**

---

## TL;DR — what the screenshots show

**Works (genuinely):**
- Docked drawer is real cockpit (07, 08, 09).
- Status line in top bar persists across surfaces (every screenshot).
- /now lane hierarchy registers — OVERDUE is loud, the rest fall back.
- Approval drawer (08) is best-in-class: REASON / AMOUNT / WILL UNBLOCK / Sign-off.
- Comment composer with internal/with-vendor toggle (09) feels right.

**Visibly off (taste-level):**
- The activity strip + audit + inbox all show `-3d` `-4d` timestamps.
  Seeded data has decayed. The "alive" affect the strip is supposed to
  carry is contradicted. **Single largest gap between intent and render.**
- /work reads as a 42-row spreadsheet, not a triage queue. Severity rails
  are too subtle (3px, low-saturation) and there's no urgency grouping.
- /money invoices tab is half-empty whitespace (05); /compliance has
  three decorative stat tiles (03). Both are dashboard-reflex bloat.
- The top bar's left third is empty. Clerk's `OrganizationSwitcher`
  renders nothing when there's only one org.
- "moved → in_progress" in activity feed is half-humanized. The verb is
  aliased; the diff value isn't.

**Hidden bug:**
- NEEDS YOU lane title is not red-bolded when count ≥ 5 — the
  `emphasized` flag is hardcoded to overdue/blocked only.

The rest of this doc walks each surface.

---

## /now — `after/01-now.png`

### What's working

- **Top bar status line** reads as the dispatch terminal it should:
  `42 open · 18 overdue (4d) · 4 blocked · 5 awaiting · 3 COIs ≤30d`.
  The "(4d)" detail next to overdue is the oldest-age signal — small
  and meaningful.
- **Left rail badges** (`Work 18`, `Compliance 3`, `Money 5`) with red
  tint on overdue/needs. The rail finally has operational signal.
- **OVERDUE 22** lane title is red-bold, count is red — emphasis
  landed. The lane visually dominates the page.
- **Per-lane row tails** working:
  - NEEDS YOU rows show pending duration in red on the right (4d,
    4d, 4d, 4d, 5d) — no owner clutter, no time chip clutter.
  - OVERDUE rows show vendor name + red age (`Stark Plumbing Co
    -5d`). Vendor identity matters here; the tail gives it.
- **Severity rails on the left edge** of OVERDUE rows are visible
  (small red lines next to the urgency dot).

### What's still off

1. **Activity strip timestamps all read `-3d`.** Every event in the
   strip is from 3 days ago because the seed has decayed. The
   "alive" promise of /now is contradicted by stale data. This is
   structurally fine but a re-seed is required before deploy.

2. **NEEDS YOU lane title is NOT emphasized**, even though it has 5
   items (which crosses the red-tone threshold in `laneTone`). The
   `emphasized` flag in `now/page.tsx` is hardcoded:
   ```ts
   const emphasized = laneKey === "overdue" || laneKey === "blocked";
   ```
   It should be `tone === "red" || tone === "amber"`. **Bug.**

3. **Top bar left side is empty.** Clerk's `OrganizationSwitcher`
   renders nothing for single-org users. Result: the status line
   floats with no anchor on the left. Should have a tiny brand mark
   ("STACK OS" in mono) or the org name as a static label.

4. **Three red signals on a single urgent row** (priority bar + red
   urgency dot + URG chip). All red, all next to each other. Reads
   as one signal because the eye merges them, but technically each
   is encoding the same thing. The priority bar should be enough; the
   urgency dot could be quieter (filled but smaller) on urgent rows.

5. **Activity strip event text mixes humanized verbs with
   raw db states** — `@MP moved → in_progress` is part-human,
   part-engineering. The `moved` verb is the alias for
   `status_changed`; the `in_progress` is the raw enum value. Should
   render as `marked in progress` or just `→ in progress` (lowercase,
   spaced).

6. **"NOW" page header** in the main area is small and uppercase. Now
   that the status line lives in the top bar, this page-level header
   is partially redundant. Could go entirely, or shrink to just the
   LIVE indicator.

### Eye movement trace

Top → status line (read it fast, 0.5s)
↓
Activity strip (glance, 1s)
↓
**OVERDUE 22** lane title hits hard — red bold typography ✓
↓
First few overdue rows: URG chip catches the eye on WO-1001/1002 ✓

The dispatch flow is correct. But the dispatcher is going to immediately
notice the `-3d` timestamps and feel "this isn't live data."

---

## /work — `after/02-work.png`

### What's working

- Filter chip bar (TYPE / STATUS / DUE) is compact, inline with item
  count.
- LIST / BOARD toggle in the upper right.
- 42 rows visible in one viewport — density is right.

### What's still off

1. **It reads as a spreadsheet.** 42 rows of nearly identical
   composition. The eye has nothing to grab onto. Per the design
   audit's recommendation, /work should group by urgency band
   (Overdue → Blocked → In-flight → Today → Backlog) with a tiny
   inline header for each. This was a **deliberate Tier 1 deferral
   per the priority doc**, but the cost shows in the render: this
   page is the weakest of the five.

2. **Severity rails on /work are nearly invisible.** Compare to /now's
   OVERDUE lane where the rails read cleanly. On /work, even on the
   HIGH priority rows (WO-1003 deadbolt, WO-1006 outlet sparking),
   the 3px rail blends with the row background. Possible causes:
   - The bar is `bg-urgency-overdue` / `bg-urgency-blocked` —
     verify Tailwind compile actually produces these classes.
   - Or the row background (`bg-muted/40` on hover, transparent at
     rest) doesn't contrast enough. The rail needs higher contrast
     against the white page.

3. **The right side of every row is busy.** Owner initials + time chip
   + status word (e.g., `VE -3d IN PROGRESS`). Three signals
   competing. The lane-aware tail design solves this for /now, but
   /work uses the `default` tail mode which is the legacy uniform
   right-side composition.

4. **The first row (WO-1006) shows `-3d` in red** — that's the time
   chip rendering with overdue tone, but WO-1006 is `in_progress` not
   overdue. The TimeSince color logic vs. the urgency dot logic are
   inconsistent here. Need to verify.

5. **The `42 ITEMS` label upper-left is loud and useless.** It's an
   item count. Doesn't drive any action. The space could carry a
   secondary filter ("Mine") instead.

6. **No visual "above the fold" focus.** A dispatcher landing on
   /work scrolls — nothing tells them "start here." Without bands or
   a "Mine" toggle, every row is equally a candidate for the next
   action.

### Eye movement trace

Filter bar (read 1s)
↓
First row, look at left edge for priority signal — barely visible
↓
Look at title — gray
↓
Look at right side — busy
↓
Skip to next row

The scan velocity is similar to /work-before. Tier 1 didn't materially
change this surface. **This is the highest-leverage Tier 2 target.**

---

## /compliance — `after/03-compliance.png`

### What's working

- **CANNOT DISPATCH** violations panel is loud and clear. Three
  vendors, each with "BLOCKS N WOS" chip and "no insurance on file"
  context.
- COI rows with `BLOCKS 2 WOS` chip in red + temporal chip
  (`13d ago` / `in 12d` / `in 6mo`).

### What's still off

1. **The three stat tiles** (Active 5 / Expiring soon 2 / Expired 1)
   eat ~80px of vertical space and add nothing. They repeat the
   counts already visible in the tab badge (`VENDOR COIS 8`). **Dashboard
   reflex. Delete.** The design audit already flagged this.

2. **COI rows have no severity rail.** The Greenleaf row (expired,
   blocks 2 WOs, 13d ago) reads only marginally louder than the
   active SparkleClean row. Both rows are 32px, same typography. The
   expired+blocking row should LOOK like it needs action.

3. **"BLOCKS 2 WOS" chip is small uppercase mono.** Could be more
   prominent — maybe colored background instead of colored text.

4. **The "tenant insurance" tab name** still reads database-y.
   Operators say "renter policies." Minor.

5. **Half the page is whitespace** below the COI list. 8 COIs is
   probably correct for this org size; the design should compress
   when data is sparse rather than leave dead space.

### Eye movement trace

Top → CANNOT DISPATCH panel reads ✓ (good red border, structured)
↓
Three stat tiles (waste of attention)
↓
COI list — eye latches on the red BLOCKS chips ✓

The panel works. The list works. The stat tiles are pure noise.

---

## /money approvals — `after/04-money-approvals.png`

### What's working

- Tabs work; tab names are human ("APPROVALS", "INVOICES", "EXPORT").
- **Each approval card carries the right info**: humanized title
  ("budget overage", "vendor swap requested", "estimate awaiting
  sign-off"), WO ref, pending duration (red mono), WO consequence
  chip (WO BLOCKED, OVERDUE 5D), $amount, holding [owner], Approve /
  Reject.
- Total pending + oldest age header.

### What's still off

1. **Every card is the same physical size.** A $1450 5-day-pending
   approval blocking an urgent overdue WO is the same height as a
   $275 4-day-pending budget overage. The pressure hierarchy doesn't
   translate to card size.

2. **The red dot in each card's top-left is tiny and disconnected.**
   It's the urgency dot but it doesn't anchor the card visually. A
   left-edge severity rail (like the rows on /now) would be more
   coherent with the rest of the system.

3. **"Approve / Reject" buttons are the same on every card.** For a
   tier-3 low-urgency approval ($275, no overdue WO), icon-only
   `[✓][✗]` would suffice. Big primary buttons for everything reads
   loud.

4. **The cards are visually heavy** — bordered, padded, multiple
   inline elements. The page has 5 cards taking ~600px of vertical.
   Compress the low-urgency ones to 32px rows like the rest of the
   product.

5. **`pending 4d` in red** — works as SLA aging signal. Good.

### Eye movement trace

Total pending banner ($4390 · oldest 5d)
↓
First card: title + WO ref + pending → eye latches on `pending 4d` red ✓
↓
Read description → consequence chip in amber ✓
↓
Eye to Approve button ✓

The decision flow works. The cards just need to compress on quiet items.

---

## /money invoices — `after/05-money-invoices.png`

### What's still off

1. **Half the viewport is empty whitespace.** 8 invoice rows, the
   rest of the page is bare white.

2. **Rows are flat and informationless.** Each: dot + invoice number
   + status word + amount + time. No vendor name. No WO ref. No
   "submitted by" actor. The operator can't action this — they have
   to click each one to learn anything.

3. **Status colors are encoding by dot color only.** Amber dot =
   submitted, blue = approved, gray = disputed, green = paid. The
   dot is the only signal. The status word next to it is the same
   gray for every row. Reads as: "look at the dots."

4. **No grouping by vendor.** The design audit recommended grouping
   so operators thinking "what's outstanding to Stark?" can see it
   together. Currently flat chronological list.

5. **The EXPORT tab still exists.** Single export button on a whole
   tab. Wasted slot. Design audit recommended folding into a footer
   action or replacing with "Recent decisions."

This page hasn't substantially changed in Tier 1 — invoices and
export weren't in the scope. But viewing it post-Tier-1, the
contrast with the other surfaces (which all gained density) is sharp.

---

## /inbox — `after/06-inbox.png`

### What's working

- Subject lines read in operator language (`New WO: Bedroom outlet
  not working`, `WO-1003 assigned to Quicklock`, `Stark commented on
  WO-1001`).
- Target ref chips inline (WO-1029, WO-1003, etc.).
- Threading on WO-1011 (indented `WO-1011 blocked` under
  `WO-1011 — escalated`).
- 20 TOTAL count header.

### What's still off

1. **Timestamps all show `-3d` / `-4d`.** Same staleness as activity
   strip. Inbox should feel like recent traffic, but it reads as a
   read-only archive of last week.

2. **The "WO CREATED" / "WO ASSIGNED" / "APPROVAL REQUESTED" type
   chips** still read database-y. They're the notification `kind`
   field humanized via underscore-to-space. Should map to operator
   phrases:
   - `WO_CREATED` → "new ticket"
   - `WO_ASSIGNED` → "assigned"
   - `APPROVAL_REQUESTED` → "needs sign-off"
   - `COMMENT_EXTERNAL` → "vendor comment"
   - `INSPECTION_IN_PROGRESS` → "inspection started"

3. **No filter chips at top.** The design audit recommended `All ·
   Mentions · Assignments · Approvals · Compliance · System`. Tier
   2.

4. **No "Mine" toggle.** Every notification is for the current user
   (since notifications.recipient_user_id is filtered), so this is
   moot — but visible to the operator it isn't clear "these are
   all yours" vs. "these are the org's."

5. **Body excerpts are full sentences.** Two lines of vendor reply
   `"On-site. Confirmed source — supply line behind tub."` adds
   density but eats vertical. Truncation to ~80 chars + ellipsis
   would tighten.

---

## Drawer (WO) — `after/07-drawer-wo.png`

### What's working

- **Docked split renders correctly.** Queue is fully visible on the
  left; drawer occupies the right ~540px. The dispatcher can read
  the queue and the entity simultaneously.
- **Drawer header**: status dot + ref + title + close. Compact and
  scannable.
- **OVERVIEW tab**: TITLE / LOCATION / STATUS / PRIORITY / DUE /
  UPDATED / DESCRIPTION / WAITING ON SIGN-OFF (with AP-refs) / MOVE
  THIS (state buttons).
- **WAITING ON SIGN-OFF** is the cross-entity causality made visible.
  AP-CD8C73 and AP-79C557 are clickable into their own drawer state.
  This is the moat.
- **MOVE THIS** buttons in operator language: "Send to vendor",
  "Schedule", "Mark in progress", "Cancel".

### What's still off

1. **"TITLE" field redundant with the header.** The drawer header
   already shows `WO-1001 · Bathroom ceiling leak — water through
   2A`. The TITLE field in the body is the same. Drop it.

2. **OVERVIEW labels above values** (TITLE / LOCATION / STATUS, etc.)
   take a lot of vertical space. Per the design audit, two-column
   `label: value` inline pairs would tighten. Current Field component
   renders label-above-value at `text-[10px] tracking-wider`.

3. **DUE shows full timestamp** `5/13/2026, 12:02:37 AM -5d`. Too
   precise. Should be `5/13 · -5d` or `May 13 · -5d`. The
   `.toLocaleString()` output is engineering-shaped.

4. **STATUS field shows `● blocked`** — good, but `PRIORITY: Urgent`
   right next to it is in title case (capitalize). The two labels
   read with mixed casing. Either both lowercase ("urgent" /
   "blocked") or both proper case ("Urgent" / "Blocked"). Pick one.

5. **`COSTS 0` and `FILES 0` tabs** show with zero counts. Should hide
   when empty (per design audit). Visual noise.

6. **The drawer's right-edge alignment is white on white.** No
   shadow, no subtle elevation. The "this is the drawer" boundary
   is just a hairline `border-l`. On a light page, the drawer doesn't
   feel like a separate surface — it feels like part of the page
   that happens to have different content. Slight elevation (1px
   shadow / very subtle bg tint) would help.

---

## Drawer (Approval) — `after/08-drawer-approval.png`

### What's working

This is the best-rendered surface in the product right now.

- **AP-AEA25E · budget overage** header.
- DECISION / TIMELINE 2 tabs.
- REASON · AMOUNT · PENDING SINCE · NOTES — clear hierarchy.
- **WILL UNBLOCK card**: `WO-1012 blocked · Vacant unit turn —
  Willow 2`. Clickable into the underlying WO drawer. Cross-entity
  causality is *the* operational signal.
- `[Sign off] [Reject]` buttons centered, single decision action.

### What's still off

1. **AMOUNT $275.00** is in a large mono font but the row above
   (REASON: budget overage) is in regular weight. The dollar amount
   feels bigger than the reason title. Possibly correct — the
   amount IS the operational fact — but the typography hierarchy
   reads "this is a financial decision" more than "this is an
   operational unblock." Subtle.

2. **PENDING SINCE: -4d** reads engineering-shaped. "4 days ago" is
   the operator phrase. The minus sign is a developer affordance.

3. **"DECISION" tab name** — operators say "approval" or "sign-off".
   "Decision" is fine but slightly clinical.

---

## Drawer (Timeline) — `after/09-drawer-wo-timeline.png`

### What's working

- Comment cards stylistically differentiate: ADAM RENCHER INTERNAL
  (muted bg) vs VENDOR WITH VENDOR (amber-tinted bg).
- Audit section below with monospace tape feed.
- Composer at bottom with `INTERNAL` toggle and `⌘↵ to post` hint.

### What's still off

1. **Comment author `ADAM RENCHER` in caps + tracking-wider** reads
   like a stamp. Title case (`Adam Rencher`) would feel more human.
   Same for `VENDOR`.

2. **The visibility toggle button** says "INTERNAL" in tiny caps —
   it's a button, but it doesn't look like one. Should be a
   switch widget or a more clearly-clickable affordance.

3. **AUDIT timestamps all show `-3d` / `-4d`** — staleness again.

4. **The composer textarea is small** (2 rows). For a real comment
   the operator will write 3-4 sentences, which immediately scrolls
   into the textarea. Could be 3 rows default.

5. **`⌘↵ to post` hint is muted gray.** Discoverable but not loud.
   The "Post" button is on the right, which is correct.

---

## Cross-surface observations

### Color usage

The product uses **only red, amber, green-gray, muted gray, and
white/foreground.** This palette restraint is correct for an
operational surface — every PM tool that uses 7+ colors looks like a
toy. But two issues:

1. **Red is overloaded.** It encodes: overdue, urgent priority,
   blocked, expired COI, alert badge. The operator's eye registers
   "red" as "something I should look at" but doesn't differentiate
   between *kinds* of red. Likely fine in practice (all reds are
   high-attention), but if we ever want a "red for safety" vs "red
   for SLA" distinction, we're out of headroom.

2. **No surface tint per nav section.** /now, /work, /compliance,
   /money, /inbox all have identical white backgrounds. The
   operator context-switching has no peripheral signal which
   surface they're on. A very subtle background hue per surface
   (e.g., /money slightly warmer, /compliance slightly cooler)
   would help orientation. This is a Tier 3+ nice-to-have but
   worth noting.

### Typography

- Body text is consistent `text-sm` / `text-[13px]` / `text-[11px]`
  / `text-[10px]` — five tiers. Reads disciplined.
- Mono font (likely `font-mono` Tailwind) for refs, times, amounts.
- No display tier — when /now's status line shows `42 open · 18
  overdue (4d)`, the numbers and labels are the same size. For
  high-pressure moments (e.g., 50+ overdue), there's no
  larger-display option.
- **No condensed font.** A condensed mono on the right-side tail
  would let more fit per row at the same height.

### Spacing

- Most surfaces use `space-y-0` or `space-y-1` for row stacks.
  Tight. Correct for density.
- The drawer interior uses `space-y-4` (or similar) — generous.
  Tighter would feel more cockpit-y.

### Interactive affordances

- Hover states: rows show `hover:bg-muted/40`. Subtle and right.
- Focus states: `focus:bg-muted/40` — same as hover. Browser-default
  `focus-visible` outline shows. Could be more distinct.
- Buttons: shadcn defaults. Fine.

### Discoverability

- **No keyboard hint anywhere** on screen except in the drawer
  footer ("Press esc to close"). A new operator wouldn't know `?`
  shows the shortcut overlay. A subtle persistent footer or
  bottom-right hint would help adoption.

- **Severity rails are operator-invisible** without prior knowledge.
  A first-time operator wouldn't notice "the urgent rows have a thin
  red line on the left." Either make it more prominent or accept
  that it's a peripheral-vision-only signal (correct for trained
  operators).

---

## Priority of visual fixes (before deploy)

1. **Re-seed prod with fresh timestamps.** The single biggest
   gap between intent and render. Without this, the "alive" promise
   is contradicted. **30 seconds of work, biggest impact.**

2. **Fix NEEDS YOU lane emphasis bug.** The flag should be tone-based,
   not laneKey-based. **5 minutes.**

3. **Delete /compliance stat tiles.** Pure dashboard noise. **5 mins.**

4. **Humanize the activity strip diff values.** `moved → in_progress`
   should be `moved → in progress` or `marked in progress`. **15 mins.**

5. **Hide empty drawer tabs** (COSTS 0, FILES 0). **5 mins.**

6. **Top bar left side** — add a tiny brand mark or org label so the
   left third isn't empty whitespace. **10 mins.**

7. **Verify severity rails actually render** on /work — the rails may
   be CSS-suppressed or too subtle. **15 mins.**

Total: ~1 hour of fixes that bring the *render* in line with the
*intent*. Without these, the product looks 80% there.
