# Workout Tracker — Design Spec

**Date:** 2026-08-24
**Status:** Approved for planning
**Author:** Matthew Snodgrass (with Claude)

## Summary

A single-user, offline-first Progressive Web App (PWA) for tracking
weight-lifting workouts. Runs installed on Matthew's Samsung Fold 8 and in
any desktop browser. All data lives on-device in IndexedDB; there is no
backend, no accounts, and no network dependency after install. Hosted as a
static site on GitHub Pages (HTTPS is required for PWA install).

Watch (Wear OS) support is explicitly **out of scope**. Cardio tracking is
**out of scope** (handled by a different app).

## Goals

1. Define routines (Workout A/B/C…) as ordered lists of exercises with
   set/rep targets.
2. On workout day: pick a routine, see last time's weight/reps for each
   exercise, and log sets with minimal taps.
3. Auto-starting rest timer between sets, toggleable per session.
4. Stats: per-exercise progression over time with PR tracking.
5. Routines and exercises are freely editable without corrupting or losing
   any logged history.
6. Data survives phone loss via manual JSON export/import.

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | React 18+ with TypeScript |
| Build | Vite + `vite-plugin-pwa` (service worker, manifest, offline caching) |
| Storage | IndexedDB via Dexie, with `dexie-react-hooks` for live queries |
| Charts | Recharts |
| Tests | Vitest for core logic |
| Hosting | GitHub Pages (static) |

Units are **pounds only** — no unit conversion anywhere.

## Data model

Principle: **exercises are global, routines reference them, and history
attaches to the exercise — never the routine.** Editing a routine (add,
remove, reorder, re-target) can never orphan or alter logged history.
Bench press history follows bench press, even if it appears in multiple
routines or is removed from all of them.

IndexedDB tables (Dexie):

### Exercise
- `id` (auto)
- `name` (string, unique-ish; validated case-insensitively on create)
- `type`: `"weighted" | "bodyweight" | "timed"`
- `defaultRestSeconds` (number)
- `archived` (boolean)

Semantics of `type` (all sets share one shape — see SetLog):
- **weighted**: weight required, reps required
- **bodyweight**: reps required, weight optional (added weight, e.g. weighted pull-ups)
- **timed**: duration required, weight optional (e.g. farmer's carries)

### Routine
- `id` (auto)
- `name` (string, e.g. "Workout A")
- `archived` (boolean)

### RoutineExercise (join table)
- `id` (auto)
- `routineId`, `exerciseId`
- `order` (number; drag-reorder rewrites these)
- `targetSets` (number)
- `targetRepsMin`, `targetRepsMax` (numbers, for weighted/bodyweight)
- `targetDurationSeconds` (number, for timed)

Deleting a RoutineExercise removes the exercise from that routine only.

### Session (one workout day)
- `id` (auto)
- `routineId`
- `startedAt`, `finishedAt` (timestamps; `finishedAt` null while in progress)
- `note` (optional string)

### SetLog (one completed set)
- `id` (auto)
- `sessionId`, `exerciseId` (indexed together and separately)
- `setNumber` (1-based within exercise within session)
- `weightLbs` (number, optional)
- `reps` (number, optional)
- `durationSeconds` (number, optional)
- `loggedAt` (timestamp)

### Key queries
- **"Last time" for an exercise:** most recent *finished* session containing
  SetLogs for that `exerciseId` (any routine), return its sets in order.
- **Progression series:** all SetLogs for an exerciseId grouped by session,
  reduced to per-session metrics (see Stats).

### Deletion rules
- Exercises and routines with any logged history: **soft delete only**
  (`archived: true`; hidden from pickers, still resolvable from history).
- Exercises/routines with zero history: hard delete allowed.
- Sessions/SetLogs: user can delete a set or an entire session (mistake
  correction); this is a real delete with a confirm prompt.

## Screens

Bottom tab navigation: **Home · Routines · Stats · Settings**.

### Home / Start Workout
- Routine cards ("Workout A — last done 3 days ago"). Tap → creates a
  Session and opens the logging screen.
- If an unfinished session exists, show a "Resume workout" banner instead
  of allowing a second concurrent session (one active session max).

### Logging screen
- One card per RoutineExercise, in order. Card shows:
  - Name + target (e.g., "3 × 8–10").
  - **Last time line**: previous session's sets ("135×10, 135×9, 135×8 —
    Aug 20") or "First time!".
  - Set rows, pre-created to `targetSets` count. Each row: weight input,
    reps (or duration) input, ✓ button. Weight pre-fills from the same set
    number last time. "+ Add set" / remove-row available.
- ✓ writes the SetLog to IndexedDB immediately (crash-safe; nothing is
  held only in memory) and starts the rest timer.
- **Rest timer**: slim persistent bottom bar; counts down the exercise's
  `defaultRestSeconds`; vibrates (Vibration API) and flashes at zero;
  +30s and skip controls. A header toggle disables auto-start for the
  current session (defaults back to on for the next session).
  Timer state does not need to survive a full app kill — it is a
  convenience, not a record.
- **Finish workout** sets `finishedAt` and shows a summary: sets logged,
  duration, and any PRs hit (see Stats for PR definition), with the
  session note field.
- Exercises can be skipped (no sets logged) without ceremony.

### Routines screen
- List routines → create/rename/archive.
- Routine editor: ordered exercise list; drag to reorder; tap to edit
  targets; add exercise via searchable picker over the exercise library
  with inline "create new exercise" (name, type, rest default).
- Exercise library management lives here too: rename, edit rest default,
  archive. Renames apply everywhere retroactively (history shows the new
  name) — acceptable for a single-user app.

### Stats screen
- Searchable exercise list ordered by most recently trained.
- Per exercise:
  - **Line chart** (Recharts) of per-session metric over time.
    - Weighted: default metric **estimated 1RM** (Epley:
      `weight × (1 + reps/30)`, best set of the session); toggle to
      **top-set weight** and **total volume** (Σ weight×reps).
    - Bodyweight: total reps (and est. 1RM if added weight was used).
    - Timed: max duration (and weight if logged).
  - **PR markers** on the chart; records summary (best est. 1RM, best
    top-set weight, best volume day).
  - **History list**: every session for the exercise with full sets,
    newest first. Sessions/sets editable+deletable from here.
- PR definition: a new all-time best in the exercise's default metric.

### Settings
- Export data: downloads one JSON file (schema version + all tables).
- Import data: file picker → validate shape → **replace** current data
  after an explicit confirm. (Merge is out of scope.)
- Backup nudge: dismissible banner if last export was >30 days ago and
  there are logged sessions.
- Rest timer global default (fallback for new exercises).

## Error handling

- All Dexie writes awaited; failure surfaces a toast ("Couldn't save —
  set not recorded") — never a silent drop.
- Import validates JSON structure and schema version before any write;
  invalid files are rejected with a clear message and existing data is
  untouched. Import wraps in a single Dexie transaction (all-or-nothing).
- Schema migrations use Dexie's versioned upgrade mechanism from day one
  (schema version stamped in exports too).

## Testing

Vitest unit tests for the logic that can silently rot:
- "Last time" query (multiple routines sharing an exercise, unfinished
  sessions excluded, first-time case).
- Est. 1RM / volume / PR computation.
- Import validation (rejects malformed files; round-trips an export).
- Session resume (unfinished session detection).
- Pre-fill logic (weight from matching set number last session).

UI verified by hand on the Fold 8 (folded and unfolded widths) and desktop.

## Explicitly out of scope (v1)

- Wear OS / watch app, Samsung Health integration
- Cardio logging
- Multi-user, accounts, sync/backend
- Supersets, plate calculator, body-weight tracking, scheduling/reminders
- kg units / unit switching
- Import merge (replace only)
