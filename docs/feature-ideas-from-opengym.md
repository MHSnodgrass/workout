# Feature Ideas Borrowed from openGym

Ideas worth stealing from [openGym](https://github.com/arvids-unavailable/openGym)
(AGPL-3.0, 3.8k★), adapted to this app's constraints: **no backend, IndexedDB
only, single user, lbs, static PWA on GitHub Pages**. We steal ideas and
mechanics, not code (AGPL — clean-room implementations only).

Reviewed 2026-08-24. Ordered roughly by value-for-effort within each tier.

**Status as of 2026-08-24** — shipped: #1–#9, #12, #13, #15. Remaining: #10,
#11 and #14. Each item below is marked, with a note on what actually landed
where it differs from the plan.

---

## Tier 1 — Quick wins (an evening each)

### 1. Screen wake lock during workouts — ✅ shipped
Keep the screen awake while a session is active so the phone doesn't lock
between sets; release on finish. openGym makes this toggleable in Settings.
- **How:** `navigator.wakeLock.request('screen')` in `ActiveWorkout`,
  re-acquire on `visibilitychange`, release on finish/unmount. Toggle in
  Settings (`settings` table key).
- **Why:** Removes the biggest friction in our logging flow — unlocking the
  phone every set. Also makes the rest-timer bar reliably visible, which
  papers over the PWA's weakest spot (no background alarms).
- **Landed as planned.** Controller in `src/lib/wakeLock.ts` (plain TS, so
  the re-acquire-on-`visibilitychange` logic is testable in node), hook in
  `useWakeLock.ts`. Settings key `keepAwake`, default on.

### 2. Theme accents — ✅ shipped
openGym ships light/dark themes with 8 accent colors, saved per profile.
- **How:** Our CSS is already token-based (`--accent`, `--bg`, …). Add 4–6
  accent choices in Settings; persist in `settings`.
- **Why:** Cheap personality.
- **Landed.** Six accents in `src/lib/theme.ts`, key `accent`.
  **Light mode is not happening** — dropped from scope 2026-08-24, the app is
  dark-only by choice. Don't re-propose it.
  Each accent ships its own `--accent-ink`: white on the lighter accents
  fails contrast, so the button-label color travels with the accent, and
  the contrast floors are asserted in `theme.test.ts`. No red accent —
  red already means destructive, and matching it blunts the delete buttons.

### 3. Consistent icon set — ✅ shipped
openGym uses hand-drawn icons instead of emoji for cross-platform consistency.
Our UI uses text glyphs (✕ ▲ ▼ ✓) which render inconsistently.
- **How:** Inline SVG icons (hand-rolled or `lucide-react`) for check, delete,
  reorder, edit, timer.
- **Why:** Sharper look on the Fold, no emoji-font lottery.
- **Landed** with `lucide-react`. Icon-only buttons gained `aria-label`s
  and the app gained `:focus-visible` outlines, which it had none of.
  `ConfirmButton`'s armed state stays the word "Sure?" — an icon can't
  ask a question.

### 4. In-set work timer for timed exercises — ✅ shipped
openGym runs a count-up work timer *during* a timed set (plank, carry), then
logs the actual time held — separate from the rest timer.
- **How:** On a timed exercise's pending row, replace the seconds input with
  a start/stop stopwatch button that fills `durationSeconds` on stop
  (editable before ✓). Reuses the `RestTimerBar` ticking pattern.
- **Why:** Nobody wants to count plank seconds in their head and type them in.
- **Landed differently:** the stopwatch sits *beside* the seconds input
  rather than replacing it, so the field is always visible and editable.
  Confirming a running set stops it and logs the elapsed value. Stored as
  a start timestamp, so backgrounding the app can't lose time.

---

## Tier 2 — The big one: progression intelligence

### 5. Double-progression suggestions — ✅ shipped, stall detection included
openGym's core loop: progression schemes tell you what to attempt today.
**Double progression** fits our data model perfectly since routine exercises
already have rep ranges (`targetRepsMin`/`targetRepsMax`):
- Hit the **top** of the rep range on **all** target sets last time →
  suggest **+5 lb** (configurable increment per exercise).
- Otherwise → suggest same weight, aim for more reps.
- Bodyweight: progress reps to a ceiling, then suggest adding a set
  (openGym's exact rule).
- Timed: suggest +5–10s.
- **How:** Pure function in `src/lib/progression.ts` —
  `suggestNext(lastTime, re, exercise) → { weightLbs?, note }` — unit-tested
  like `metrics.ts`. Surface it on the `ExerciseCard` as a one-line hint
  ("Try 140 — you hit 3×12 last time") and pre-fill the suggested weight
  instead of last time's weight.
- **Why:** This automates the exact "what should I do for progressive
  overload" decision the app was built for. Today we show history; this
  gives the answer.
- **Landed** in `src/lib/progression.ts`. The working weight is the
  *lightest* of the target sets — the load actually completed for every
  set — so a ramped session progresses from its base, not its top single.
  Increment is per-exercise (`Exercise.incrementLbs`) over a global
  `defaultIncrementLbs`.
- **Stall detection landed too** (2026-08-24). `suggestNext` now takes the
  whole history rather than just last time, so one function owns the
  decision instead of the screen arbitrating between "hold" and "deload".
  It counts back consecutive sessions at the *same* working weight that
  missed the range top; at the threshold (setting `stallSessions`, default
  3) it suggests `working × 0.9` snapped to the exercise's increment, and
  holds instead if that can't land strictly lower. Changing the load or
  hitting the range ends the streak, so working back up can't re-trigger.
  The hint renders in `--pr` gold rather than the accent — a retreat should
  not look like an advance.
- **Weighted only.** There's nothing to take off a bodyweight exercise, and
  "drop a set" is a different decision than "drop the load" — not invented.

### 6. Optional RIR/RPE effort column — ✅ shipped
Third per-set field: reps-in-reserve (or RPE). openGym keeps it independent
of progression math.
- **How:** Optional `rir` on `SetLog` (Dexie is schemaless-ish — additive
  field, no migration pain; bump backup `schemaVersion`), small optional
  input per set row, shown in history. Off by default via Settings toggle.
- **Why:** Cheap context for judging whether a "PR" was grindy or easy.
  Pairs well with #5's stall logic if we ever add it.
- **Landed** as RIR only, not RPE — same information, and "2 left in the
  tank" needs no mental mapping. `src/lib/effort.ts` parses and labels it;
  0–10 accepted, whole numbers only. Setting key `trackRir`, default off.
  It first appended to `formatSet` so it would appear everywhere at once;
  **#15 reversed that** — effort now renders only as its own column in
  `SetValue`, because in the joined "Last: …" line it read as
  `155×12 · 1 RIR, 155×12 · 0 RIR, …` and buried the numbers that matter.
  **`suggestNext` deliberately does not read it**, per openGym's split.

---

## Tier 3 — Stats & visualization

### 7. GitHub-style activity heatmap — ✅ shipped
Year grid on the Stats (or Home) screen shaded by training volume/time per day.
- **How:** Pure derivation from `sessions` (count sets or duration per day).
  Render as a CSS grid of little squares — no chart library needed.
- **Why:** The single most motivating "don't break the streak" visual.
- **Landed** in `src/lib/heatmap.ts` + `components/Heatmap.tsx`, at the top
  of Stats. Shades by **sets logged** — the only measure that behaves across
  weighted, bodyweight and timed work. Levels are relative to the busiest
  day, not quartiles: quartiles collapse a year of similar sessions into the
  lowest band. Days bucket by *local* date. Month labels were added because
  the per-day tooltips never appear on a phone.

### 8. Muscle-group coverage map — ✅ shipped (list, not figures)
openGym shows front/back body figures shaded by weekly/monthly work, plus a
preview while building routines ("this plan misses hamstrings").
- **How:** Requires tagging each exercise with muscle groups — add optional
  `muscleGroups: string[]` to `Exercise`, set in the exercise editor. Start
  with a simple bar/list ("Chest 12 sets · Back 9 · Legs 6 this week")
  before attempting body-figure SVGs.
- **Why:** Answers "is Workout A/B/C balanced?" — genuinely useful when
  editing routines. The SVG figure is polish; the per-group set counts are
  the value.
- **Landed** as `Exercise.muscleGroups[]` from a **fixed vocabulary of ten**
  in `src/lib/muscles.ts` — free text fragments into "chest"/"Chest"/"pecs"
  within a week and then the counts mean nothing. Tagging chips live on the
  exercise library rows in Routines, where the other exercise properties
  already are. Stats shows a 7-day bar list; a set counts once toward *each*
  of its groups, so the totals deliberately exceed the sets logged.
  Untrained groups stay listed at zero — the gaps are the point — and sets
  from untagged exercises are counted and reported separately rather than
  silently dropped, with a link to go fix it.
- **Not done:** the body-figure SVGs, and openGym's "this plan misses
  hamstrings" preview while editing a routine. The second one is the more
  useful of the two if this gets revisited.

### 9. Named best-set on the 1RM stat — ✅ shipped
openGym's est. 1RM display names which set produced it ("185×5 on Aug 12").
- **How:** `bestE1RM` already finds the set — return it and render it under
  the records card.
- **Why:** Ten-line change; makes the number trustworthy.
- **Landed, but bigger than ten lines.** Records derived from session-level
  aggregates, so "which set" didn't exist for all metrics. `bestOccurrence()`
  in `metrics.ts` now returns `{ value, session, set? }`: est. 1RM / top set /
  max duration name the set, while volume and total reps are session totals
  and name only the date.

---

## Tier 4 — Bigger lifts (decide deliberately before starting)

### 10. Seeded exercise library — ☐ not started
openGym ships 1,324 exercises with animated demos and equipment filters.
- **How for us:** Import a permissively-licensed dataset (e.g.
  [free-exercise-db](https://github.com/yuhonas/free-exercise-db), public
  domain) at build time; picker searches it and copies chosen entries into
  the user's `exercises` table (keeps backups self-contained). Images would
  bloat the PWA — link out or lazy-load only.
- **Why/why not:** Nice for discovering exercises + gets muscle tags (#8)
  for free; but Matthew's library is self-defined and small — only worth it
  if #8 is wanted without manual tagging.
- **State as of 2026-08-24 — chosen, not yet designed.** The rationale above
  has shifted: #8 shipped *with* manual tagging, so this is no longer the
  only route to muscle data. What it's now worth is discovery, and killing
  the tagging chore for anything new.
  Open questions to settle before coding: whether the dataset ships in the
  bundle or as a lazy chunk (it's ~1,300 entries — this is the whole
  decision, since the logging path must stay light); how free-exercise-db's
  `primaryMuscles`/`secondaryMuscles` map onto our fixed ten in
  `lib/muscles.ts`; and whether a picked entry is copied into `exercises`
  (keeping backups self-contained, as planned) or referenced by id.

### 11. Supersets — ☐ not started
Pair two exercises, alternate their set rows, one rest after the pair.
- **How:** `supersetGroup` field on `RoutineExercise`; logging screen
  interleaves cards. Was deliberately cut from v1 — revisit only if the
  actual training style changes.
- **State as of 2026-08-24 — chosen, not yet designed.** Things that have
  changed under it since it was cut, and that a design has to answer:
  rest is currently started per exercise by `onSetLogged(defaultRestSeconds)`
  in `LoggingScreen`, so "one rest after the pair" means the trigger moves
  from the set to the group. Progression (`suggestNext`) is per exercise and
  should stay that way — a superset changes the *order* sets are performed,
  not what each lift should be loaded to. Also needs deciding: whether the
  pair renders as one merged card or two linked cards, and what happens when
  the two exercises have different `targetSets`.

### 12. Weekly schedule ("today is Workout B day") — ✅ shipped
openGym assigns routines to weekdays; Home would highlight today's plan.
- **How:** Optional `weekday` on `Routine`; Home sorts/badges today's
  routine. Skip openGym's reschedule machinery — our "last done X days ago"
  already covers the flexible-schedule case.
- **Landed** as `Routine.weekdays[]` — **plural**, because a Push/Pull/Legs
  split runs Push on Mon *and* Thu and a single day would force duplicate
  routines. Seven toggle chips in the routine editor; Home badges today's
  routines, outlines them in the accent and floats them to the top, while
  everything else keeps its existing order. Unscheduled routines show
  nothing, and every routine stays startable on any day — the schedule is a
  hint, not a gate. `src/lib/schedule.ts` handles the labels ("Mon & Thu",
  "Every day").

### 13. Body-weight tracking with goal line — ✅ shipped
Weight log + chart with goal-line coloring; openGym even prompts at session
start.
- **How:** New `bodyWeights` table, small entry field on Home or Settings,
  Recharts line with a `ReferenceLine` for the goal. Include in backup.
- **Landed** as `bodyWeights` (Dexie `version(2)`), a one-line entry card on
  Home, and a lazy `/stats/body-weight` route with the chart. **One reading
  per local day** — logging again replaces it, so the button is idempotent
  and a second weigh-in can't spike the chart.
  A raw daily line is unreadable (water swings a couple of pounds), so the
  chart draws a muted raw line under an accent **7-day moving average**, and
  the trend compares smoothed endpoints. The trend reports the span it
  actually covered, not the 30 days it was asked for. Goal weight lives on
  that screen rather than in Settings, with `ifOverflow="extendDomain"` so
  it stays on screen; it carries no chart label, which collided with the
  date axis. Pure logic in `src/lib/bodyWeight.ts`; `localMidnight`/`addDays`
  moved out of `heatmap.ts` into `src/lib/dates.ts`.
- **Not done:** openGym's prompt-at-session-start. Home is enough.

### 14. Rest-timer alert when you've switched away — ☐ not started
**What it is, plainly:** you finish a set, the rest timer starts, you switch
to Instagram or your phone screen goes off — and right now nothing tells you
rest is up. The timer only counts while the app is on screen. This would buzz
or ping you when it hits zero regardless of what you're looking at.
- **What's actually achievable here** (openGym has a server; we don't):
  - **Realistic:** while the app is merely backgrounded — screen still on,
    you're in another app — a service worker can usually still fire a
    notification, and `navigator.vibrate` already runs when the tab is
    visible. This covers the common case.
  - **Not achievable:** a guaranteed alarm after the phone has been locked
    for minutes. Browsers suspend background timers, there's no push server
    to wake us, and the API for genuinely *scheduled* notifications isn't
    broadly supported. Anything promising that would be lying.
  - **Caveat worth knowing before building:** #1's wake lock keeps the screen
    on during a workout, so in the intended flow — phone propped up, screen
    awake — the timer is already visible and this adds nothing. It earns its
    keep specifically when you leave the app mid-rest.
- **Would need:** notification permission (asked once, in Settings, not on
  first load), a Settings toggle, and honest copy about the lock-screen
  limit so it isn't relied on for a heavy set.

---

## Not from openGym

### 15. Visual identity pass — ✅ shipped
Added and done 2026-08-24. The app worked but read as generic dark-Bootstrap
— a starter template rather than a thing someone made.
- **What's actually wrong**, concretely:
  - `system-ui` for everything. No display face, no character.
  - One card — `--surface`, 1px `--border`, 12px radius — repeated on every
    screen, so every screen has the same texture and nothing has emphasis.
  - No type scale worth the name: 22px `h1`, then 15px body and 13px
    `.small`. Nothing between, nothing above.
  - Every screen is the same flat vertical stack of full-width cards. No
    density contrast, no grouping, no rhythm.
  - **The numbers are set in the same weight as their labels.** Weights,
    reps and PRs are the entire point of the app and they're typographically
    invisible.
- **Constraint:** this is a phone-first PWA used mid-set, in a gym, one
  handed. Legible and fast to hit beats clever.
- **What landed.** The premise: this app is a *ledger of numbers*, so the
  numbers are the typography.
  - **Barlow + Barlow Condensed**, self-hosted (latin subset, ~22kB each,
    `public/fonts/`, SIL OFL) and precached by the service worker, because a
    gym with no signal shouldn't drop the app into a fallback face. One
    superfamily at two widths — the *width* contrast carries the
    personality, so no second typeface has to shout alongside.
  - **`components/SetValue.tsx` is the signature.** A logged set is a ruled
    ledger line — `01 · 155 lb × 12 · 1 RIR` — condensed and tabular so
    columns align down a card and across sessions. Pending inputs use the
    same face: what you type is typeset like what you logged.
  - Type scale: 31px condensed screen titles, an uppercase `h2.section`
    eyebrow for in-page sections (which were all `h1` before — three per
    screen), `.eyebrow` for the quiet half of a label/number pair, `.stat`
    for hero numbers.
  - Tab bar gained icons, uppercase micro-labels and an accent rule on the
    active tab. `--tabbar-h`/`--above-tabs` now drive everything pinned
    above it, which also **fixed a real bug**: the rest timer would have
    slid under the tab bar on any device with a gesture bar.
  - Palette unchanged apart from a quieter `--hairline` for ledger rules and
    a `--sunken` for inset wells. Deliberately no new hue: the accent is
    user-owned, and a second brand color would fight all six.
- **Reversed on sight:** `formatSet` no longer appends RIR. It looked right
  in the abstract and turned the joined "Last: …" line into `155×12 · 1 RIR,
  155×12 · 0 RIR, …` — unreadable exactly when it has to be read. Effort now
  lives only in the ledger column.

---

## Deliberately NOT stealing

| openGym feature | Why not |
|---|---|
| Multi-user, passkey auth, admin dashboard | Single-user app, no server — auth is complexity with zero benefit |
| Docker/self-host backend, JSON file store | The whole point of our design is zero infrastructure |
| Cardio (time + speed) | Tracked in a different app by choice (spec decision) |
| 12-language localization | Audience of one, speaks English |
| FitNotes/Strong/Hevy importers | No legacy data to import; revisit only if that changes |
| Plan sharing / PDF export | No one to share with; JSON backup covers portability |
| Guest mode | Meaningless without accounts |

---

## What's left

Every feature worth stealing has been stolen, and the design pass is done.
What's left is only the deliberate-decision pile:

1. **#10 seeded exercise library** and **#11 supersets** — both need a
   decision before any code. These are next.
2. **#14 rest alert when you've switched away** — kept in scope. Read that
   entry before scoping it: the backgrounded case is doable, a guaranteed
   lock-screen alarm is not, and the wake lock already covers the flow where
   the phone stays propped up and awake.

Smaller unbuilt pieces, noted where they belong: #8's routine-balance
preview and body figures, #13's prompt-at-session-start, and deloads for
bodyweight work.

### Conventions these were built to
- Pure logic lives in `src/lib/` with vitest tests; TDD.
- Components are **not** unit-tested — the repo has no jsdom or
  testing-library. UI is verified by driving the real app instead.
- `vite.config.ts` sets `environment: 'node'`; keep new logic node-testable.
- Recharts is lazy-loaded via the stats routes. Keep it off the logging path
  — verified against the production build, not just the import graph.
- Backup `SCHEMA_VERSION` is 2. Tables added after v1 are validated as
  *optional*, so older backup files still restore; `TABLE_KEYS` lists only
  the six that shipped in v1. Keep it that way when adding a table.
- **Bump `SCHEMA_VERSION` for a new table, not for a new optional field.**
  `weekdays` and `muscleGroups` were added without a bump: old builds store
  and ignore unknown fields, so nothing is lost either direction, and every
  bump makes a stale cached build refuse a file it could actually read.
- Type is token-driven: `--ui` (Barlow) for text, `--display` (Barlow
  Condensed) for titles and every number. Numbers get `tabular-nums` so
  columns align; use `components/SetValue.tsx` for a logged set rather than
  printing `formatSet` into a div.
- Anything pinned above the tab bar offsets by `--above-tabs`, never a
  hardcoded pixel value — that's what keeps it clear of a gesture bar.
