# Feature Ideas Borrowed from openGym

Ideas worth stealing from [openGym](https://github.com/arvids-unavailable/openGym)
(AGPL-3.0, 3.8k★), adapted to this app's constraints: **no backend, IndexedDB
only, single user, lbs, static PWA on GitHub Pages**. We steal ideas and
mechanics, not code (AGPL — clean-room implementations only).

Reviewed 2026-08-24. Ordered roughly by value-for-effort within each tier.

---

## Tier 1 — Quick wins (an evening each)

### 1. Screen wake lock during workouts
Keep the screen awake while a session is active so the phone doesn't lock
between sets; release on finish. openGym makes this toggleable in Settings.
- **How:** `navigator.wakeLock.request('screen')` in `ActiveWorkout`,
  re-acquire on `visibilitychange`, release on finish/unmount. Toggle in
  Settings (`settings` table key).
- **Why:** Removes the biggest friction in our logging flow — unlocking the
  phone every set. Also makes the rest-timer bar reliably visible, which
  papers over the PWA's weakest spot (no background alarms).

### 2. Theme accents + light mode
openGym ships light/dark themes with 8 accent colors, saved per profile.
- **How:** Our CSS is already token-based (`--accent`, `--bg`, …). Add a
  light palette and 4–6 accent choices in Settings; persist in `settings`.
- **Why:** Cheap personality. The dark theme is currently the only option.

### 3. Consistent icon set
openGym uses hand-drawn icons instead of emoji for cross-platform consistency.
Our UI uses text glyphs (✕ ▲ ▼ ✓) which render inconsistently.
- **How:** Inline SVG icons (hand-rolled or `lucide-react`) for check, delete,
  reorder, edit, timer.
- **Why:** Sharper look on the Fold, no emoji-font lottery.

### 4. In-set work timer for timed exercises
openGym runs a count-up work timer *during* a timed set (plank, carry), then
logs the actual time held — separate from the rest timer.
- **How:** On a timed exercise's pending row, replace the seconds input with
  a start/stop stopwatch button that fills `durationSeconds` on stop
  (editable before ✓). Reuses the `RestTimerBar` ticking pattern.
- **Why:** Nobody wants to count plank seconds in their head and type them in.

---

## Tier 2 — The big one: progression intelligence

### 5. Double-progression suggestions ⭐ highest value steal
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
- **Later options (only if wanted):** stall detection after N failed
  attempts → suggest a deload (openGym: missed reps never advance load;
  stalls auto-deload ~10%).

### 6. Optional RIR/RPE effort column
Third per-set field: reps-in-reserve (or RPE). openGym keeps it independent
of progression math.
- **How:** Optional `rir` on `SetLog` (Dexie is schemaless-ish — additive
  field, no migration pain; bump backup `schemaVersion`), small optional
  input per set row, shown in history. Off by default via Settings toggle.
- **Why:** Cheap context for judging whether a "PR" was grindy or easy.
  Pairs well with #5's stall logic if we ever add it.

---

## Tier 3 — Stats & visualization

### 7. GitHub-style activity heatmap
Year grid on the Stats (or Home) screen shaded by training volume/time per day.
- **How:** Pure derivation from `sessions` (count sets or duration per day).
  Render as a CSS grid of little squares — no chart library needed.
- **Why:** The single most motivating "don't break the streak" visual.

### 8. Muscle-group coverage map
openGym shows front/back body figures shaded by weekly/monthly work, plus a
preview while building routines ("this plan misses hamstrings").
- **How:** Requires tagging each exercise with muscle groups — add optional
  `muscleGroups: string[]` to `Exercise`, set in the exercise editor. Start
  with a simple bar/list ("Chest 12 sets · Back 9 · Legs 6 this week")
  before attempting body-figure SVGs.
- **Why:** Answers "is Workout A/B/C balanced?" — genuinely useful when
  editing routines. The SVG figure is polish; the per-group set counts are
  the value.

### 9. Named best-set on the 1RM stat
openGym's est. 1RM display names which set produced it ("185×5 on Aug 12").
- **How:** `bestE1RM` already finds the set — return it and render it under
  the records card.
- **Why:** Ten-line change; makes the number trustworthy.

---

## Tier 4 — Bigger lifts (decide deliberately before starting)

### 10. Seeded exercise library
openGym ships 1,324 exercises with animated demos and equipment filters.
- **How for us:** Import a permissively-licensed dataset (e.g.
  [free-exercise-db](https://github.com/yuhonas/free-exercise-db), public
  domain) at build time; picker searches it and copies chosen entries into
  the user's `exercises` table (keeps backups self-contained). Images would
  bloat the PWA — link out or lazy-load only.
- **Why/why not:** Nice for discovering exercises + gets muscle tags (#8)
  for free; but Matthew's library is self-defined and small — only worth it
  if #8 is wanted without manual tagging.

### 11. Supersets
Pair two exercises, alternate their set rows, one rest after the pair.
- **How:** `supersetGroup` field on `RoutineExercise`; logging screen
  interleaves cards. Was deliberately cut from v1 — revisit only if the
  actual training style changes.

### 12. Weekly schedule ("today is Workout B day")
openGym assigns routines to weekdays; Home would highlight today's plan.
- **How:** Optional `weekday` on `Routine`; Home sorts/badges today's
  routine. Skip openGym's reschedule machinery — our "last done X days ago"
  already covers the flexible-schedule case.

### 13. Body-weight tracking with goal line
Weight log + chart with goal-line coloring; openGym even prompts at session
start.
- **How:** New `bodyWeights` table, small entry field on Home or Settings,
  Recharts line with a `ReferenceLine` for the goal. Include in backup.
- **Why/why not:** Was cut from v1 as scope creep; it's cheap and the chart
  infra exists. Add when wanted.

### 14. Rest-timer push notification when backgrounded
openGym (having a server) pushes rest-alerts even when the app is closed.
- **Reality check for us:** without a push server, a static PWA can only
  fire a notification from the service worker while it's alive; true
  scheduled notifications (Notification Triggers API) still aren't broadly
  available. **#1 (wake lock) mostly obsoletes this.** Revisit only if wake
  lock proves insufficient.

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

## Suggested order if we start pulling from this list

1. **#1 wake lock** + **#4 work timer** (one session, transforms gym usability)
2. **#5 progression suggestions** (the headline feature)
3. **#7 heatmap** + **#9 named best set** (stats polish)
4. **#2 themes** / **#3 icons** (look & feel pass)
5. Everything else on demand.
