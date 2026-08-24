# Workout Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user, offline-first workout-tracking PWA (routines, set logging with last-time history, rest timer, progression stats, JSON backup) deployed to GitHub Pages.

**Architecture:** React + TypeScript SPA with all data in IndexedDB via Dexie. Pure logic (queries, mutations, metrics, backup) lives in `src/db/` and `src/lib/` modules that are unit-tested with Vitest + fake-indexeddb; screens are thin React components using `dexie-react-hooks` live queries. HashRouter avoids GitHub Pages 404 issues. No backend.

**Tech Stack:** React 18+, TypeScript (strict), Vite, Dexie + dexie-react-hooks, react-router-dom (HashRouter), Recharts, vite-plugin-pwa, Vitest + fake-indexeddb, GitHub Pages via GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-24-workout-tracker-design.md`

## Global Constraints

- Units are **pounds only**; no unit conversion anywhere.
- All timestamps are **epoch milliseconds** (`Date.now()`).
- `archived` fields are stored as `0 | 1` (IndexedDB indexes don't handle booleans).
- Exactly **one active session** (a Session with `finishedAt === null`) may exist at a time.
- Exercises/routines **with logged history are soft-deleted** (`archived: 1`); with no history they are hard-deleted.
- Dexie database name: `workout-db`, schema version `1`. Backup files: `app: 'workout-tracker'`, `schemaVersion: 1`.
- Every Dexie write in UI code is awaited inside try/catch; failure shows a toast — never a silent drop.
- No `window.confirm`/`alert`/`prompt` anywhere — destructive actions use the two-tap `ConfirmButton` component.
- Routing uses **HashRouter**. Vite `base` is `'/workout/'` (set in Task 15; leave default until then).
- TypeScript `strict: true`; run `npm test` before every commit.
- UI reorder in the routine editor uses ▲/▼ buttons (conscious simplification of the spec's "drag to reorder" — same capability, no drag-and-drop dependency).
- Commit after every task with the trailer lines shown in Task 1's commit step.

## File Map (final state)

```
package.json, tsconfig.json, vite.config.ts, index.html, .gitignore
.github/workflows/deploy.yml
scripts/gen-icons.mjs          — one-off PNG icon generation (sharp)
public/icon-192.png, public/icon-512.png
src/main.tsx                   — React root
src/App.tsx                    — HashRouter + bottom tab nav
src/styles.css                 — the app's only stylesheet
src/db/db.ts                   — Dexie schema + record types
src/db/queries.ts              — read queries (last-time, history, PRs)
src/db/mutations.ts            — writes (sessions, sets, routines, exercises)
src/db/settings.ts             — key/value settings helpers
src/db/backup.ts               — export / validate / import
src/lib/metrics.ts             — pure math: 1RM, volume, series, PR flags
src/lib/format.ts              — date/set/metric formatting helpers
src/components/Toast.tsx       — error/info toast context
src/components/ConfirmButton.tsx — two-tap destructive confirm
src/components/RestTimerBar.tsx  — countdown bar with vibration
src/screens/HomeScreen.tsx
src/screens/LoggingScreen.tsx  — active workout + finish summary
src/screens/RoutinesScreen.tsx — routine list + exercise library
src/screens/RoutineEditorScreen.tsx — targets, reorder, exercise picker
src/screens/StatsScreen.tsx    — exercise list
src/screens/ExerciseStatsScreen.tsx — chart, records, history
src/screens/SettingsScreen.tsx — export/import, rest default
src/test/setup.ts, src/test/helpers.ts
```

---

### Task 1: Project scaffold and test tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/styles.css` (empty for now), `src/test/setup.ts`, `src/smoke.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a working `npm run dev`, `npm run build`, and `npm test` pipeline with fake-indexeddb preloaded for all tests. Later tasks assume `vitest` picks up `src/**/*.test.ts`.

- [ ] **Step 1: Write scaffold files**

`package.json`:

```json
{
  "name": "workout-tracker",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "icons": "node scripts/gen-icons.mjs"
  }
}
```

`.gitignore`:

```
node_modules
dist
dev-dist
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "useDefineForClassFields": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

`vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
  },
});
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#111418" />
    <title>Workout</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/App.tsx` (placeholder, replaced in Task 7):

```tsx
export default function App() {
  return <h1>Workout</h1>;
}
```

`src/styles.css`: create empty (filled in Task 7).

`src/test/setup.ts`:

```ts
import 'fake-indexeddb/auto';
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install react react-dom dexie dexie-react-hooks react-router-dom recharts
npm install -D typescript vite @vitejs/plugin-react @types/react @types/react-dom vitest fake-indexeddb vite-plugin-pwa sharp
```

Expected: installs cleanly, `package-lock.json` created.

- [ ] **Step 3: Write a smoke test**

`src/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('test pipeline', () => {
  it('runs with fake-indexeddb available', () => {
    expect(globalThis.indexedDB).toBeDefined();
  });
});
```

- [ ] **Step 4: Verify pipeline**

Run: `npm test` — Expected: 1 test passes.
Run: `npm run build` — Expected: builds `dist/` with no type errors.
Run: `npm run dev` briefly — Expected: page shows "Workout" heading at the printed localhost URL.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS project with Vitest and fake-indexeddb

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015bryd5xjiwE5dsY9FySm1Z"
```

Every later commit uses these same two trailer lines; they are omitted from the plan text below for brevity but MUST be included in each commit.

---

### Task 2: Database schema

**Files:**
- Create: `src/db/db.ts`, `src/test/helpers.ts`
- Test: `src/db/db.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `db` (the singleton `WorkoutDB`), types `Exercise`, `Routine`, `RoutineExercise`, `Session`, `SetLog`, `Setting`, `ExerciseType`. Test helpers: `resetDb()`, `seedExercise(over?)`, `seedRoutine(over?)`, `seedSession(routineId, over?)`, `seedSet(sessionId, exerciseId, over?)` — all return `Promise<number>` ids except `resetDb`.

- [ ] **Step 1: Write the failing test**

`src/db/db.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { resetDb } from '../test/helpers';

beforeEach(resetDb);

describe('db schema', () => {
  it('round-trips an exercise', async () => {
    const id = await db.exercises.add({
      name: 'Bench Press',
      type: 'weighted',
      defaultRestSeconds: 120,
      archived: 0,
    });
    const ex = await db.exercises.get(id);
    expect(ex?.name).toBe('Bench Press');
    expect(ex?.type).toBe('weighted');
  });

  it('round-trips a set log with optional fields absent', async () => {
    const id = await db.setLogs.add({
      sessionId: 1,
      exerciseId: 1,
      setNumber: 1,
      reps: 12,
      loggedAt: Date.now(),
    });
    const set = await db.setLogs.get(id);
    expect(set?.reps).toBe(12);
    expect(set?.weightLbs).toBeUndefined();
    expect(set?.durationSeconds).toBeUndefined();
  });

  it('indexes setLogs by exerciseId', async () => {
    await db.setLogs.add({ sessionId: 1, exerciseId: 7, setNumber: 1, reps: 5, loggedAt: 1 });
    await db.setLogs.add({ sessionId: 2, exerciseId: 7, setNumber: 1, reps: 5, loggedAt: 2 });
    await db.setLogs.add({ sessionId: 2, exerciseId: 8, setNumber: 1, reps: 5, loggedAt: 3 });
    expect(await db.setLogs.where('exerciseId').equals(7).count()).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/db.test.ts`
Expected: FAIL — cannot resolve `./db` / `../test/helpers`.

- [ ] **Step 3: Write the implementation**

`src/db/db.ts`:

```ts
import Dexie, { type Table } from 'dexie';

export type ExerciseType = 'weighted' | 'bodyweight' | 'timed';

export interface Exercise {
  id?: number;
  name: string;
  type: ExerciseType;
  defaultRestSeconds: number;
  archived: 0 | 1;
}

export interface Routine {
  id?: number;
  name: string;
  archived: 0 | 1;
}

export interface RoutineExercise {
  id?: number;
  routineId: number;
  exerciseId: number;
  order: number;
  targetSets: number;
  targetRepsMin?: number;
  targetRepsMax?: number;
  targetDurationSeconds?: number;
}

export interface Session {
  id?: number;
  routineId: number;
  startedAt: number;
  finishedAt: number | null;
  note?: string;
}

export interface SetLog {
  id?: number;
  sessionId: number;
  exerciseId: number;
  setNumber: number;
  weightLbs?: number;
  reps?: number;
  durationSeconds?: number;
  loggedAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

export class WorkoutDB extends Dexie {
  exercises!: Table<Exercise, number>;
  routines!: Table<Routine, number>;
  routineExercises!: Table<RoutineExercise, number>;
  sessions!: Table<Session, number>;
  setLogs!: Table<SetLog, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super('workout-db');
    this.version(1).stores({
      exercises: '++id, name, archived',
      routines: '++id, archived',
      routineExercises: '++id, routineId, exerciseId',
      sessions: '++id, routineId, startedAt',
      setLogs: '++id, sessionId, exerciseId',
      settings: 'key',
    });
  }
}

export const db = new WorkoutDB();
```

Note: `finishedAt` is deliberately NOT indexed — IndexedDB cannot index `null`; active-session lookup uses `.filter()`, which is fine at this data size.

`src/test/helpers.ts`:

```ts
import { db } from '../db/db';
import type { Exercise, Routine, Session, SetLog } from '../db/db';

export async function resetDb(): Promise<void> {
  await db.delete();
  await db.open();
}

let counter = 0;

export async function seedExercise(over: Partial<Exercise> = {}): Promise<number> {
  counter += 1;
  return db.exercises.add({
    name: `Exercise ${counter}`,
    type: 'weighted',
    defaultRestSeconds: 90,
    archived: 0,
    ...over,
  });
}

export async function seedRoutine(over: Partial<Routine> = {}): Promise<number> {
  counter += 1;
  return db.routines.add({ name: `Routine ${counter}`, archived: 0, ...over });
}

export async function seedSession(routineId: number, over: Partial<Session> = {}): Promise<number> {
  return db.sessions.add({ routineId, startedAt: Date.now(), finishedAt: Date.now(), ...over });
}

export async function seedSet(
  sessionId: number,
  exerciseId: number,
  over: Partial<SetLog> = {},
): Promise<number> {
  const count = await db.setLogs
    .where('sessionId')
    .equals(sessionId)
    .and((s) => s.exerciseId === exerciseId)
    .count();
  return db.setLogs.add({
    sessionId,
    exerciseId,
    setNumber: count + 1,
    weightLbs: 135,
    reps: 10,
    loggedAt: Date.now(),
    ...over,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/db.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/db.ts src/db/db.test.ts src/test/helpers.ts
git commit -m "feat: add Dexie schema for exercises, routines, sessions, sets"
```

---

### Task 3: Read queries

**Files:**
- Create: `src/db/queries.ts`
- Test: `src/db/queries.test.ts`

**Interfaces:**
- Consumes: `db` + types from `src/db/db.ts`; seed helpers from `src/test/helpers.ts`.
- Produces (all exported from `src/db/queries.ts`):
  - `interface SessionSets { session: Session; sets: SetLog[] }`
  - `getActiveSession(): Promise<Session | undefined>`
  - `getExerciseHistory(exerciseId: number): Promise<SessionSets[]>` — finished sessions only, ascending by `startedAt`, sets sorted by `setNumber`.
  - `getLastTime(exerciseId: number, excludeSessionId?: number): Promise<SessionSets | null>`
  - `getLastFinishedSessionDate(routineId: number): Promise<number | null>`
  - `exerciseHasHistory(exerciseId: number): Promise<boolean>`
  - `routineHasHistory(routineId: number): Promise<boolean>`

- [ ] **Step 1: Write the failing tests**

`src/db/queries.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  getActiveSession,
  getExerciseHistory,
  getLastFinishedSessionDate,
  getLastTime,
} from './queries';
import { resetDb, seedExercise, seedRoutine, seedSession, seedSet } from '../test/helpers';

beforeEach(resetDb);

describe('getActiveSession', () => {
  it('returns the unfinished session', async () => {
    const r = await seedRoutine();
    await seedSession(r, { startedAt: 1000, finishedAt: 2000 });
    const activeId = await seedSession(r, { startedAt: 3000, finishedAt: null });
    expect((await getActiveSession())?.id).toBe(activeId);
  });

  it('returns undefined when all sessions are finished', async () => {
    const r = await seedRoutine();
    await seedSession(r, { startedAt: 1000, finishedAt: 2000 });
    expect(await getActiveSession()).toBeUndefined();
  });
});

describe('getLastTime', () => {
  it('returns sets from the most recent finished session in ANY routine', async () => {
    const ex = await seedExercise();
    const rA = await seedRoutine();
    const rB = await seedRoutine();
    const older = await seedSession(rA, { startedAt: 1000, finishedAt: 1500 });
    await seedSet(older, ex, { weightLbs: 100, reps: 10 });
    const newer = await seedSession(rB, { startedAt: 2000, finishedAt: 2500 });
    await seedSet(newer, ex, { weightLbs: 105, reps: 8 });
    await seedSet(newer, ex, { weightLbs: 105, reps: 7 });

    const last = await getLastTime(ex);
    expect(last?.session.id).toBe(newer);
    expect(last?.sets.map((s) => s.setNumber)).toEqual([1, 2]);
    expect(last?.sets[0].weightLbs).toBe(105);
  });

  it('ignores unfinished sessions and the excluded (current) session', async () => {
    const ex = await seedExercise();
    const r = await seedRoutine();
    const finished = await seedSession(r, { startedAt: 1000, finishedAt: 1500 });
    await seedSet(finished, ex, { weightLbs: 95, reps: 10 });
    const unfinished = await seedSession(r, { startedAt: 2000, finishedAt: null });
    await seedSet(unfinished, ex, { weightLbs: 200, reps: 1 });

    const last = await getLastTime(ex, unfinished);
    expect(last?.session.id).toBe(finished);
  });

  it('returns null for a never-logged exercise', async () => {
    const ex = await seedExercise();
    expect(await getLastTime(ex)).toBeNull();
  });
});

describe('getExerciseHistory', () => {
  it('returns finished sessions ascending with sets ordered by setNumber', async () => {
    const ex = await seedExercise();
    const r = await seedRoutine();
    const s2 = await seedSession(r, { startedAt: 2000, finishedAt: 2500 });
    await seedSet(s2, ex);
    const s1 = await seedSession(r, { startedAt: 1000, finishedAt: 1500 });
    await seedSet(s1, ex);
    await seedSession(r, { startedAt: 3000, finishedAt: null }); // unfinished, no sets

    const history = await getExerciseHistory(ex);
    expect(history.map((h) => h.session.id)).toEqual([s1, s2]);
  });
});

describe('getLastFinishedSessionDate', () => {
  it('returns the latest finished startedAt for the routine, else null', async () => {
    const r = await seedRoutine();
    expect(await getLastFinishedSessionDate(r)).toBeNull();
    await seedSession(r, { startedAt: 1000, finishedAt: 1500 });
    await seedSession(r, { startedAt: 5000, finishedAt: null });
    expect(await getLastFinishedSessionDate(r)).toBe(1000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/db/queries.test.ts`
Expected: FAIL — cannot resolve `./queries`.

- [ ] **Step 3: Write the implementation**

`src/db/queries.ts`:

```ts
import { db } from './db';
import type { Session, SetLog } from './db';

export interface SessionSets {
  session: Session;
  sets: SetLog[];
}

export async function getActiveSession(): Promise<Session | undefined> {
  return db.sessions.filter((s) => s.finishedAt === null).first();
}

export async function getExerciseHistory(exerciseId: number): Promise<SessionSets[]> {
  const logs = await db.setLogs.where('exerciseId').equals(exerciseId).toArray();
  const bySession = new Map<number, SetLog[]>();
  for (const log of logs) {
    const arr = bySession.get(log.sessionId);
    if (arr) arr.push(log);
    else bySession.set(log.sessionId, [log]);
  }
  const sessions = (await db.sessions.bulkGet([...bySession.keys()])).filter(
    (s): s is Session => s !== undefined && s.finishedAt !== null,
  );
  return sessions
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((session) => ({
      session,
      sets: bySession.get(session.id!)!.sort((x, y) => x.setNumber - y.setNumber),
    }));
}

export async function getLastTime(
  exerciseId: number,
  excludeSessionId?: number,
): Promise<SessionSets | null> {
  const history = await getExerciseHistory(exerciseId);
  const eligible = history.filter((h) => h.session.id !== excludeSessionId);
  return eligible.length > 0 ? eligible[eligible.length - 1] : null;
}

export async function getLastFinishedSessionDate(routineId: number): Promise<number | null> {
  const sessions = await db.sessions.where('routineId').equals(routineId).toArray();
  const finished = sessions.filter((s) => s.finishedAt !== null);
  if (finished.length === 0) return null;
  return Math.max(...finished.map((s) => s.startedAt));
}

export async function exerciseHasHistory(exerciseId: number): Promise<boolean> {
  return (await db.setLogs.where('exerciseId').equals(exerciseId).count()) > 0;
}

export async function routineHasHistory(routineId: number): Promise<boolean> {
  return (await db.sessions.where('routineId').equals(routineId).count()) > 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/db/queries.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/queries.ts src/db/queries.test.ts
git commit -m "feat: add read queries (last-time lookup, history, active session)"
```

---

### Task 4: Mutations and settings

**Files:**
- Create: `src/db/mutations.ts`, `src/db/settings.ts`
- Test: `src/db/mutations.test.ts`

**Interfaces:**
- Consumes: `db` + types; `exerciseHasHistory`, `routineHasHistory` from `src/db/queries.ts`.
- Produces from `src/db/mutations.ts`:
  - `class ActiveSessionExistsError extends Error`, `class DuplicateExerciseNameError extends Error`
  - `startSession(routineId: number): Promise<number>` — throws `ActiveSessionExistsError` if one is active.
  - `finishSession(sessionId: number): Promise<void>`, `updateSessionNote(sessionId: number, note: string): Promise<void>`
  - `logSet(input: Omit<SetLog, 'id' | 'loggedAt'>): Promise<number>`
  - `updateSet(setLogId: number, changes: Partial<Pick<SetLog, 'weightLbs' | 'reps' | 'durationSeconds'>>): Promise<void>`
  - `deleteSet(setLogId: number): Promise<void>`, `deleteSession(sessionId: number): Promise<void>` (also deletes its SetLogs)
  - `createExercise(name: string, type: ExerciseType, defaultRestSeconds: number): Promise<number>` — throws `DuplicateExerciseNameError` on case-insensitive name clash with a non-archived exercise.
  - `updateExercise(exerciseId: number, changes: Partial<Pick<Exercise, 'name' | 'defaultRestSeconds'>>): Promise<void>`
  - `deleteExercise(exerciseId: number): Promise<'archived' | 'deleted'>`
  - `createRoutine(name: string): Promise<number>`, `renameRoutine(routineId: number, name: string): Promise<void>`
  - `deleteRoutine(routineId: number): Promise<'archived' | 'deleted'>`
  - `addExerciseToRoutine(routineId: number, exerciseId: number): Promise<number>` — appends at end with default targets (3×8–12, or 3×60s for timed).
  - `updateRoutineExercise(id: number, changes: Partial<Pick<RoutineExercise, 'targetSets' | 'targetRepsMin' | 'targetRepsMax' | 'targetDurationSeconds'>>): Promise<void>`
  - `removeRoutineExercise(id: number): Promise<void>`
  - `moveRoutineExercise(routineId: number, routineExerciseId: number, direction: -1 | 1): Promise<void>` — swaps `order` with its neighbor; no-op at list edges.
- Produces from `src/db/settings.ts`:
  - `getSetting<T>(key: string, fallback: T): Promise<T>`
  - `setSetting<T>(key: string, value: T): Promise<void>`
  - Known keys: `'globalRestSeconds'` (number, default 90), `'lastExportAt'` (number | null).

- [ ] **Step 1: Write the failing tests**

`src/db/mutations.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  ActiveSessionExistsError,
  DuplicateExerciseNameError,
  addExerciseToRoutine,
  createExercise,
  deleteExercise,
  deleteRoutine,
  deleteSession,
  finishSession,
  logSet,
  moveRoutineExercise,
  startSession,
} from './mutations';
import { getSetting, setSetting } from './settings';
import { resetDb, seedExercise, seedRoutine, seedSession, seedSet } from '../test/helpers';

beforeEach(resetDb);

describe('startSession / finishSession', () => {
  it('creates an unfinished session and refuses a second concurrent one', async () => {
    const r = await seedRoutine();
    const id = await startSession(r);
    expect((await db.sessions.get(id))?.finishedAt).toBeNull();
    await expect(startSession(r)).rejects.toBeInstanceOf(ActiveSessionExistsError);
    await finishSession(id);
    expect((await db.sessions.get(id))?.finishedAt).not.toBeNull();
    await expect(startSession(r)).resolves.toBeGreaterThan(0);
  });
});

describe('logSet', () => {
  it('stamps loggedAt', async () => {
    const r = await seedRoutine();
    const ex = await seedExercise();
    const s = await seedSession(r);
    const id = await logSet({ sessionId: s, exerciseId: ex, setNumber: 1, weightLbs: 135, reps: 10 });
    expect((await db.setLogs.get(id))?.loggedAt).toBeGreaterThan(0);
  });
});

describe('deleteSession', () => {
  it('deletes the session and its set logs', async () => {
    const r = await seedRoutine();
    const ex = await seedExercise();
    const s = await seedSession(r);
    await seedSet(s, ex);
    await seedSet(s, ex);
    await deleteSession(s);
    expect(await db.sessions.get(s)).toBeUndefined();
    expect(await db.setLogs.where('sessionId').equals(s).count()).toBe(0);
  });
});

describe('createExercise', () => {
  it('rejects case-insensitive duplicate names', async () => {
    await createExercise('Bench Press', 'weighted', 90);
    await expect(createExercise('  bench press ', 'weighted', 90)).rejects.toBeInstanceOf(
      DuplicateExerciseNameError,
    );
  });
});

describe('deleteExercise', () => {
  it('archives when history exists, hard-deletes otherwise', async () => {
    const withHistory = await seedExercise();
    const r = await seedRoutine();
    const s = await seedSession(r);
    await seedSet(s, withHistory);
    expect(await deleteExercise(withHistory)).toBe('archived');
    expect((await db.exercises.get(withHistory))?.archived).toBe(1);

    const fresh = await seedExercise();
    await addExerciseToRoutine(r, fresh);
    expect(await deleteExercise(fresh)).toBe('deleted');
    expect(await db.exercises.get(fresh)).toBeUndefined();
    expect(await db.routineExercises.where('exerciseId').equals(fresh).count()).toBe(0);
  });
});

describe('deleteRoutine', () => {
  it('archives when sessions exist, hard-deletes otherwise', async () => {
    const used = await seedRoutine();
    await seedSession(used);
    expect(await deleteRoutine(used)).toBe('archived');

    const unused = await seedRoutine();
    const ex = await seedExercise();
    await addExerciseToRoutine(unused, ex);
    expect(await deleteRoutine(unused)).toBe('deleted');
    expect(await db.routines.get(unused)).toBeUndefined();
    expect(await db.routineExercises.where('routineId').equals(unused).count()).toBe(0);
  });
});

describe('addExerciseToRoutine / moveRoutineExercise', () => {
  it('appends in order and swaps with neighbors, no-op at edges', async () => {
    const r = await seedRoutine();
    const a = await seedExercise();
    const b = await seedExercise();
    const reA = await addExerciseToRoutine(r, a);
    const reB = await addExerciseToRoutine(r, b);

    async function orderedIds() {
      const rows = await db.routineExercises.where('routineId').equals(r).sortBy('order');
      return rows.map((x) => x.id);
    }
    expect(await orderedIds()).toEqual([reA, reB]);
    await moveRoutineExercise(r, reB, -1);
    expect(await orderedIds()).toEqual([reB, reA]);
    await moveRoutineExercise(r, reB, -1); // already first
    expect(await orderedIds()).toEqual([reB, reA]);
  });

  it('applies default targets by type', async () => {
    const r = await seedRoutine();
    const lift = await seedExercise({ type: 'weighted' });
    const carry = await seedExercise({ type: 'timed' });
    const reLift = await addExerciseToRoutine(r, lift);
    const reCarry = await addExerciseToRoutine(r, carry);
    expect((await db.routineExercises.get(reLift))?.targetRepsMin).toBe(8);
    expect((await db.routineExercises.get(reCarry))?.targetDurationSeconds).toBe(60);
  });
});

describe('settings', () => {
  it('returns fallback then stored value', async () => {
    expect(await getSetting('globalRestSeconds', 90)).toBe(90);
    await setSetting('globalRestSeconds', 120);
    expect(await getSetting('globalRestSeconds', 90)).toBe(120);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/db/mutations.test.ts`
Expected: FAIL — cannot resolve `./mutations` / `./settings`.

- [ ] **Step 3: Write the implementation**

`src/db/settings.ts`:

```ts
import { db } from './db';

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value });
}
```

`src/db/mutations.ts`:

```ts
import { db } from './db';
import type { Exercise, ExerciseType, RoutineExercise, SetLog } from './db';
import { exerciseHasHistory, routineHasHistory } from './queries';

export class ActiveSessionExistsError extends Error {
  constructor() {
    super('A workout is already in progress');
  }
}

export class DuplicateExerciseNameError extends Error {
  constructor(name: string) {
    super(`An exercise named "${name}" already exists`);
  }
}

export async function startSession(routineId: number): Promise<number> {
  return db.transaction('rw', db.sessions, async () => {
    const active = await db.sessions.filter((s) => s.finishedAt === null).first();
    if (active) throw new ActiveSessionExistsError();
    return db.sessions.add({ routineId, startedAt: Date.now(), finishedAt: null });
  });
}

export async function finishSession(sessionId: number): Promise<void> {
  await db.sessions.update(sessionId, { finishedAt: Date.now() });
}

export async function updateSessionNote(sessionId: number, note: string): Promise<void> {
  await db.sessions.update(sessionId, { note });
}

export async function logSet(input: Omit<SetLog, 'id' | 'loggedAt'>): Promise<number> {
  return db.setLogs.add({ ...input, loggedAt: Date.now() });
}

export async function updateSet(
  setLogId: number,
  changes: Partial<Pick<SetLog, 'weightLbs' | 'reps' | 'durationSeconds'>>,
): Promise<void> {
  await db.setLogs.update(setLogId, changes);
}

export async function deleteSet(setLogId: number): Promise<void> {
  await db.setLogs.delete(setLogId);
}

export async function deleteSession(sessionId: number): Promise<void> {
  await db.transaction('rw', db.sessions, db.setLogs, async () => {
    await db.setLogs.where('sessionId').equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  });
}

export async function createExercise(
  name: string,
  type: ExerciseType,
  defaultRestSeconds: number,
): Promise<number> {
  const trimmed = name.trim();
  const clash = await db.exercises
    .filter((e) => e.archived === 0 && e.name.toLowerCase() === trimmed.toLowerCase())
    .first();
  if (clash) throw new DuplicateExerciseNameError(trimmed);
  return db.exercises.add({ name: trimmed, type, defaultRestSeconds, archived: 0 });
}

export async function updateExercise(
  exerciseId: number,
  changes: Partial<Pick<Exercise, 'name' | 'defaultRestSeconds'>>,
): Promise<void> {
  await db.exercises.update(exerciseId, changes);
}

export async function deleteExercise(exerciseId: number): Promise<'archived' | 'deleted'> {
  if (await exerciseHasHistory(exerciseId)) {
    await db.exercises.update(exerciseId, { archived: 1 });
    return 'archived';
  }
  await db.transaction('rw', db.exercises, db.routineExercises, async () => {
    await db.routineExercises.where('exerciseId').equals(exerciseId).delete();
    await db.exercises.delete(exerciseId);
  });
  return 'deleted';
}

export async function createRoutine(name: string): Promise<number> {
  return db.routines.add({ name: name.trim(), archived: 0 });
}

export async function renameRoutine(routineId: number, name: string): Promise<void> {
  await db.routines.update(routineId, { name: name.trim() });
}

export async function deleteRoutine(routineId: number): Promise<'archived' | 'deleted'> {
  if (await routineHasHistory(routineId)) {
    await db.routines.update(routineId, { archived: 1 });
    return 'archived';
  }
  await db.transaction('rw', db.routines, db.routineExercises, async () => {
    await db.routineExercises.where('routineId').equals(routineId).delete();
    await db.routines.delete(routineId);
  });
  return 'deleted';
}

export async function addExerciseToRoutine(routineId: number, exerciseId: number): Promise<number> {
  const existing = await db.routineExercises.where('routineId').equals(routineId).toArray();
  const order = existing.length === 0 ? 1 : Math.max(...existing.map((r) => r.order)) + 1;
  const exercise = await db.exercises.get(exerciseId);
  const base = { routineId, exerciseId, order, targetSets: 3 };
  if (exercise?.type === 'timed') {
    return db.routineExercises.add({ ...base, targetDurationSeconds: 60 });
  }
  return db.routineExercises.add({ ...base, targetRepsMin: 8, targetRepsMax: 12 });
}

export async function updateRoutineExercise(
  id: number,
  changes: Partial<
    Pick<RoutineExercise, 'targetSets' | 'targetRepsMin' | 'targetRepsMax' | 'targetDurationSeconds'>
  >,
): Promise<void> {
  await db.routineExercises.update(id, changes);
}

export async function removeRoutineExercise(id: number): Promise<void> {
  await db.routineExercises.delete(id);
}

export async function moveRoutineExercise(
  routineId: number,
  routineExerciseId: number,
  direction: -1 | 1,
): Promise<void> {
  await db.transaction('rw', db.routineExercises, async () => {
    const rows = await db.routineExercises.where('routineId').equals(routineId).sortBy('order');
    const index = rows.findIndex((r) => r.id === routineExerciseId);
    const neighbor = rows[index + direction];
    if (index === -1 || !neighbor) return;
    const current = rows[index];
    await db.routineExercises.update(current.id!, { order: neighbor.order });
    await db.routineExercises.update(neighbor.id!, { order: current.order });
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/db/mutations.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/mutations.ts src/db/settings.ts src/db/mutations.test.ts
git commit -m "feat: add mutations with soft-delete rules and settings store"
```

---

### Task 5: Metrics and PR detection

**Files:**
- Create: `src/lib/metrics.ts`
- Modify: `src/db/queries.ts` (append `detectSessionPRs`)
- Test: `src/lib/metrics.test.ts`, `src/db/prs.test.ts`

**Interfaces:**
- Consumes: types from `db.ts`; `getExerciseHistory` and `SessionSets` from `queries.ts`.
- Produces from `src/lib/metrics.ts` (all pure, no DB access):
  - `type MetricKey = 'e1rm' | 'topWeight' | 'volume' | 'totalReps' | 'maxDuration'`
  - `epley1RM(weightLbs: number, reps: number): number` — `weight × (1 + reps/30)`, but exactly `weight` when `reps === 1`.
  - `bestE1RM(sets: SetLog[]): number`, `topWeight(sets): number`, `totalVolume(sets): number`, `totalReps(sets): number`, `maxDuration(sets): number`
  - `metricValue(metric: MetricKey, sets: SetLog[]): number`
  - `defaultMetricFor(type: ExerciseType): MetricKey` — weighted→`'e1rm'`, bodyweight→`'totalReps'`, timed→`'maxDuration'`.
  - `availableMetricsFor(type: ExerciseType): MetricKey[]` — weighted: `['e1rm','topWeight','volume']`; bodyweight: `['totalReps','e1rm']`; timed: `['maxDuration']`.
  - `interface SessionPoint { sessionId: number; date: number; value: number; isPR: boolean }`
  - `buildSeries(history: SessionSets[], metric: MetricKey): SessionPoint[]` — ascending by date; `isPR` when value strictly exceeds all previous values and is > 0 (first session with a positive value is a PR).
- Produces in `src/db/queries.ts`:
  - `interface PRResult { exerciseId: number; exerciseName: string; metric: MetricKey; value: number; previousBest: number | null }`
  - `detectSessionPRs(sessionId: number): Promise<PRResult[]>` — for each exercise logged in the session, computes its default metric over the session's sets and compares against the best value across all finished sessions with an earlier `startedAt`; returns entries where the session beats (or first establishes) the record.

- [ ] **Step 1: Write the failing metrics tests**

`src/lib/metrics.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { SessionSets } from '../db/queries';
import {
  availableMetricsFor,
  bestE1RM,
  buildSeries,
  defaultMetricFor,
  epley1RM,
  maxDuration,
  metricValue,
  topWeight,
  totalReps,
  totalVolume,
} from './metrics';

function sets(...rows: Array<[number | undefined, number | undefined, number | undefined]>) {
  return rows.map(([weightLbs, reps, durationSeconds], i) => ({
    sessionId: 1,
    exerciseId: 1,
    setNumber: i + 1,
    weightLbs,
    reps,
    durationSeconds,
    loggedAt: i,
  }));
}

describe('epley1RM', () => {
  it('returns the weight itself for a single', () => {
    expect(epley1RM(225, 1)).toBe(225);
  });
  it('computes weight * (1 + reps/30)', () => {
    expect(epley1RM(135, 10)).toBeCloseTo(180);
  });
});

describe('per-session metrics', () => {
  const s = sets([135, 10, undefined], [155, 5, undefined], [undefined, 12, undefined]);
  it('bestE1RM ignores sets without weight or reps', () => {
    expect(bestE1RM(s)).toBeCloseTo(epley1RM(155, 5));
  });
  it('topWeight / totalVolume / totalReps', () => {
    expect(topWeight(s)).toBe(155);
    expect(totalVolume(s)).toBe(135 * 10 + 155 * 5);
    expect(totalReps(s)).toBe(27);
  });
  it('maxDuration', () => {
    expect(maxDuration(sets([50, undefined, 60], [50, undefined, 90]))).toBe(90);
  });
  it('metricValue dispatches', () => {
    expect(metricValue('topWeight', s)).toBe(155);
  });
});

describe('defaults', () => {
  it('picks default and available metrics per type', () => {
    expect(defaultMetricFor('weighted')).toBe('e1rm');
    expect(defaultMetricFor('bodyweight')).toBe('totalReps');
    expect(defaultMetricFor('timed')).toBe('maxDuration');
    expect(availableMetricsFor('weighted')).toEqual(['e1rm', 'topWeight', 'volume']);
  });
});

describe('buildSeries', () => {
  it('sorts ascending and flags strictly-new bests as PRs', () => {
    const history: SessionSets[] = [
      { session: { id: 2, routineId: 1, startedAt: 2000, finishedAt: 2500 }, sets: sets([105, 5, undefined]) },
      { session: { id: 1, routineId: 1, startedAt: 1000, finishedAt: 1500 }, sets: sets([100, 5, undefined]) },
      { session: { id: 3, routineId: 1, startedAt: 3000, finishedAt: 3500 }, sets: sets([105, 5, undefined]) },
    ];
    const series = buildSeries(history, 'topWeight');
    expect(series.map((p) => p.sessionId)).toEqual([1, 2, 3]);
    expect(series.map((p) => p.isPR)).toEqual([true, true, false]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/metrics.test.ts`
Expected: FAIL — cannot resolve `./metrics`.

- [ ] **Step 3: Implement metrics**

`src/lib/metrics.ts`:

```ts
import type { ExerciseType, SetLog } from '../db/db';
import type { SessionSets } from '../db/queries';

export type MetricKey = 'e1rm' | 'topWeight' | 'volume' | 'totalReps' | 'maxDuration';

export function epley1RM(weightLbs: number, reps: number): number {
  return reps === 1 ? weightLbs : weightLbs * (1 + reps / 30);
}

export function bestE1RM(sets: SetLog[]): number {
  return sets.reduce(
    (best, s) =>
      s.weightLbs !== undefined && s.reps !== undefined
        ? Math.max(best, epley1RM(s.weightLbs, s.reps))
        : best,
    0,
  );
}

export function topWeight(sets: SetLog[]): number {
  return sets.reduce((best, s) => Math.max(best, s.weightLbs ?? 0), 0);
}

export function totalVolume(sets: SetLog[]): number {
  return sets.reduce((sum, s) => sum + (s.weightLbs ?? 0) * (s.reps ?? 0), 0);
}

export function totalReps(sets: SetLog[]): number {
  return sets.reduce((sum, s) => sum + (s.reps ?? 0), 0);
}

export function maxDuration(sets: SetLog[]): number {
  return sets.reduce((best, s) => Math.max(best, s.durationSeconds ?? 0), 0);
}

export function metricValue(metric: MetricKey, sets: SetLog[]): number {
  switch (metric) {
    case 'e1rm':
      return bestE1RM(sets);
    case 'topWeight':
      return topWeight(sets);
    case 'volume':
      return totalVolume(sets);
    case 'totalReps':
      return totalReps(sets);
    case 'maxDuration':
      return maxDuration(sets);
  }
}

export function defaultMetricFor(type: ExerciseType): MetricKey {
  switch (type) {
    case 'weighted':
      return 'e1rm';
    case 'bodyweight':
      return 'totalReps';
    case 'timed':
      return 'maxDuration';
  }
}

export function availableMetricsFor(type: ExerciseType): MetricKey[] {
  switch (type) {
    case 'weighted':
      return ['e1rm', 'topWeight', 'volume'];
    case 'bodyweight':
      return ['totalReps', 'e1rm'];
    case 'timed':
      return ['maxDuration'];
  }
}

export interface SessionPoint {
  sessionId: number;
  date: number;
  value: number;
  isPR: boolean;
}

export function buildSeries(history: SessionSets[], metric: MetricKey): SessionPoint[] {
  const sorted = [...history].sort((a, b) => a.session.startedAt - b.session.startedAt);
  let best = -Infinity;
  return sorted.map(({ session, sets }) => {
    const value = metricValue(metric, sets);
    const isPR = value > best && value > 0;
    if (value > best) best = value;
    return { sessionId: session.id!, date: session.startedAt, value, isPR };
  });
}
```

- [ ] **Step 4: Run metrics tests to verify they pass**

Run: `npx vitest run src/lib/metrics.test.ts`
Expected: all PASS.

- [ ] **Step 5: Write the failing PR-detection test**

`src/db/prs.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { detectSessionPRs } from './queries';
import { resetDb, seedExercise, seedRoutine, seedSession, seedSet } from '../test/helpers';

beforeEach(resetDb);

describe('detectSessionPRs', () => {
  it('flags exercises that beat their previous best default metric', async () => {
    const bench = await seedExercise({ name: 'Bench Press' });
    const squat = await seedExercise({ name: 'Squat' });
    const r = await seedRoutine();

    const earlier = await seedSession(r, { startedAt: 1000, finishedAt: 1500 });
    await seedSet(earlier, bench, { weightLbs: 135, reps: 10 }); // e1rm 180
    await seedSet(earlier, squat, { weightLbs: 225, reps: 5 }); // e1rm 262.5

    const today = await seedSession(r, { startedAt: 2000, finishedAt: 2500 });
    await seedSet(today, bench, { weightLbs: 140, reps: 10 }); // beats it
    await seedSet(today, squat, { weightLbs: 225, reps: 3 }); // does not

    const prs = await detectSessionPRs(today);
    expect(prs).toHaveLength(1);
    expect(prs[0].exerciseName).toBe('Bench Press');
    expect(prs[0].previousBest).toBeCloseTo(180);
  });

  it('treats a first-ever session as a PR with previousBest null', async () => {
    const ex = await seedExercise();
    const r = await seedRoutine();
    const s = await seedSession(r, { startedAt: 1000, finishedAt: 1500 });
    await seedSet(s, ex, { weightLbs: 100, reps: 5 });
    const prs = await detectSessionPRs(s);
    expect(prs).toHaveLength(1);
    expect(prs[0].previousBest).toBeNull();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/db/prs.test.ts`
Expected: FAIL — `detectSessionPRs` is not exported.

- [ ] **Step 7: Implement detectSessionPRs**

Append to `src/db/queries.ts`:

```ts
import { defaultMetricFor, metricValue, type MetricKey } from '../lib/metrics';

export interface PRResult {
  exerciseId: number;
  exerciseName: string;
  metric: MetricKey;
  value: number;
  previousBest: number | null;
}

export async function detectSessionPRs(sessionId: number): Promise<PRResult[]> {
  const session = await db.sessions.get(sessionId);
  if (!session) return [];
  const sets = await db.setLogs.where('sessionId').equals(sessionId).toArray();
  const byExercise = new Map<number, SetLog[]>();
  for (const s of sets) {
    const arr = byExercise.get(s.exerciseId);
    if (arr) arr.push(s);
    else byExercise.set(s.exerciseId, [s]);
  }
  const results: PRResult[] = [];
  for (const [exerciseId, exSets] of byExercise) {
    const exercise = await db.exercises.get(exerciseId);
    if (!exercise) continue;
    const metric = defaultMetricFor(exercise.type);
    const value = metricValue(metric, exSets);
    if (value <= 0) continue;
    const history = await getExerciseHistory(exerciseId);
    const earlier = history.filter(
      (h) => h.session.id !== sessionId && h.session.startedAt < session.startedAt,
    );
    const previousBest =
      earlier.length > 0 ? Math.max(...earlier.map((h) => metricValue(metric, h.sets))) : null;
    if (previousBest === null || value > previousBest) {
      results.push({ exerciseId, exerciseName: exercise.name, metric, value, previousBest });
    }
  }
  return results;
}
```

(Move the `import` line to the top of `queries.ts` with the other imports.)

- [ ] **Step 8: Run all tests to verify they pass**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/metrics.ts src/lib/metrics.test.ts src/db/queries.ts src/db/prs.test.ts
git commit -m "feat: add progression metrics, series building, and PR detection"
```

---

### Task 6: Backup export, validation, import

**Files:**
- Create: `src/db/backup.ts`
- Test: `src/db/backup.test.ts`

**Interfaces:**
- Consumes: `db` + all record types.
- Produces from `src/db/backup.ts`:
  - `const BACKUP_APP = 'workout-tracker'`, `const SCHEMA_VERSION = 1`
  - `interface BackupFile { app: string; schemaVersion: number; exportedAt: number; exercises: Exercise[]; routines: Routine[]; routineExercises: RoutineExercise[]; sessions: Session[]; setLogs: SetLog[]; settings: Setting[] }`
  - `buildBackup(): Promise<BackupFile>`
  - `type ValidationResult = { ok: true; data: BackupFile } | { ok: false; error: string }`
  - `validateBackup(raw: unknown): ValidationResult`
  - `importBackup(backup: BackupFile): Promise<void>` — single transaction: clears all six tables then bulk-adds; all-or-nothing.

- [ ] **Step 1: Write the failing tests**

`src/db/backup.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { buildBackup, importBackup, validateBackup, SCHEMA_VERSION } from './backup';
import { resetDb, seedExercise, seedRoutine, seedSession, seedSet } from '../test/helpers';

beforeEach(resetDb);

describe('validateBackup', () => {
  it('rejects non-objects, wrong app, missing tables, future versions', () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup({ app: 'other' }).ok).toBe(false);
    expect(
      validateBackup({ app: 'workout-tracker', schemaVersion: SCHEMA_VERSION }).ok,
    ).toBe(false);
    expect(
      validateBackup({
        app: 'workout-tracker',
        schemaVersion: SCHEMA_VERSION + 1,
        exercises: [],
        routines: [],
        routineExercises: [],
        sessions: [],
        setLogs: [],
        settings: [],
      }).ok,
    ).toBe(false);
  });

  it('rejects malformed rows', () => {
    const base = {
      app: 'workout-tracker',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: 1,
      routines: [],
      routineExercises: [],
      sessions: [],
      setLogs: [],
      settings: [],
    };
    expect(validateBackup({ ...base, exercises: [{ name: 5, type: 'weighted' }] }).ok).toBe(false);
    expect(validateBackup({ ...base, exercises: [{ name: 'X', type: 'cardio' }] }).ok).toBe(false);
  });

  it('accepts a real export', async () => {
    await seedExercise();
    const result = validateBackup(JSON.parse(JSON.stringify(await buildBackup())));
    expect(result.ok).toBe(true);
  });
});

describe('export/import round trip', () => {
  it('restores exactly what was exported, replacing existing data', async () => {
    const ex = await seedExercise({ name: 'Deadlift' });
    const r = await seedRoutine();
    const s = await seedSession(r);
    await seedSet(s, ex, { weightLbs: 315, reps: 5 });
    const backup = await buildBackup();

    await resetDb();
    await seedExercise({ name: 'Should Be Replaced' });
    await importBackup(backup);

    expect(await db.exercises.count()).toBe(1);
    expect((await db.exercises.toArray())[0].name).toBe('Deadlift');
    expect(await db.setLogs.count()).toBe(1);
    expect((await db.setLogs.toArray())[0].weightLbs).toBe(315);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/db/backup.test.ts`
Expected: FAIL — cannot resolve `./backup`.

- [ ] **Step 3: Write the implementation**

`src/db/backup.ts`:

```ts
import { db } from './db';
import type { Exercise, Routine, RoutineExercise, Session, SetLog, Setting } from './db';

export const BACKUP_APP = 'workout-tracker';
export const SCHEMA_VERSION = 1;

export interface BackupFile {
  app: string;
  schemaVersion: number;
  exportedAt: number;
  exercises: Exercise[];
  routines: Routine[];
  routineExercises: RoutineExercise[];
  sessions: Session[];
  setLogs: SetLog[];
  settings: Setting[];
}

export async function buildBackup(): Promise<BackupFile> {
  return {
    app: BACKUP_APP,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    exercises: await db.exercises.toArray(),
    routines: await db.routines.toArray(),
    routineExercises: await db.routineExercises.toArray(),
    sessions: await db.sessions.toArray(),
    setLogs: await db.setLogs.toArray(),
    settings: await db.settings.toArray(),
  };
}

export type ValidationResult = { ok: true; data: BackupFile } | { ok: false; error: string };

const TABLE_KEYS = [
  'exercises',
  'routines',
  'routineExercises',
  'sessions',
  'setLogs',
  'settings',
] as const;

const EXERCISE_TYPES = ['weighted', 'bodyweight', 'timed'];

export function validateBackup(raw: unknown): ValidationResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Not a JSON object' };
  const d = raw as Record<string, unknown>;
  if (d.app !== BACKUP_APP) return { ok: false, error: 'Not a workout-tracker backup file' };
  if (typeof d.schemaVersion !== 'number' || d.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: `Unsupported schema version ${String(d.schemaVersion)}` };
  }
  for (const key of TABLE_KEYS) {
    if (!Array.isArray(d[key])) return { ok: false, error: `Missing or invalid "${key}"` };
  }
  for (const row of d.exercises as unknown[]) {
    const e = row as Record<string, unknown>;
    if (typeof e.name !== 'string' || !EXERCISE_TYPES.includes(e.type as string)) {
      return { ok: false, error: 'Invalid exercise entry' };
    }
  }
  for (const row of d.setLogs as unknown[]) {
    const l = row as Record<string, unknown>;
    if (typeof l.sessionId !== 'number' || typeof l.exerciseId !== 'number') {
      return { ok: false, error: 'Invalid set log entry' };
    }
  }
  for (const row of d.sessions as unknown[]) {
    const s = row as Record<string, unknown>;
    if (typeof s.routineId !== 'number' || typeof s.startedAt !== 'number') {
      return { ok: false, error: 'Invalid session entry' };
    }
  }
  return { ok: true, data: raw as BackupFile };
}

export async function importBackup(backup: BackupFile): Promise<void> {
  await db.transaction(
    'rw',
    [db.exercises, db.routines, db.routineExercises, db.sessions, db.setLogs, db.settings],
    async () => {
      await Promise.all([
        db.exercises.clear(),
        db.routines.clear(),
        db.routineExercises.clear(),
        db.sessions.clear(),
        db.setLogs.clear(),
        db.settings.clear(),
      ]);
      await db.exercises.bulkAdd(backup.exercises);
      await db.routines.bulkAdd(backup.routines);
      await db.routineExercises.bulkAdd(backup.routineExercises);
      await db.sessions.bulkAdd(backup.sessions);
      await db.setLogs.bulkAdd(backup.setLogs);
      await db.settings.bulkAdd(backup.settings);
    },
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/db/backup.test.ts`
Expected: all PASS. Then run `npm test` — everything still green.

- [ ] **Step 5: Commit**

```bash
git add src/db/backup.ts src/db/backup.test.ts
git commit -m "feat: add JSON backup export, validation, and atomic import"
```

---

### Task 7: App shell — router, nav, toast, styles, formatting helpers

**Files:**
- Create: `src/lib/format.ts`, `src/components/Toast.tsx`, `src/components/ConfirmButton.tsx`, and placeholder screens `src/screens/HomeScreen.tsx`, `src/screens/LoggingScreen.tsx`, `src/screens/RoutinesScreen.tsx`, `src/screens/RoutineEditorScreen.tsx`, `src/screens/StatsScreen.tsx`, `src/screens/ExerciseStatsScreen.tsx`, `src/screens/SettingsScreen.tsx`
- Modify: `src/App.tsx`, `src/styles.css`
- Test: `src/lib/format.test.ts` (formatting only; shell verified by hand)

**Interfaces:**
- Consumes: types from `db.ts`, `MetricKey` from `metrics.ts`.
- Produces from `src/lib/format.ts`:
  - `formatDate(ms: number): string` (e.g. "Aug 20"), `formatShortDate(ms: number): string` (e.g. "8/20")
  - `formatDaysAgo(ms: number): string` ("today" / "yesterday" / "N days ago")
  - `formatDuration(totalSeconds: number): string` ("42m 10s", "1h 5m")
  - `round1(n: number): number`
  - `metricLabel(metric: MetricKey): string` — e1rm→"est. 1RM", topWeight→"top set", volume→"volume", totalReps→"total reps", maxDuration→"max duration"
  - `formatSet(set: SetLog, type: ExerciseType): string` — weighted "135×10"; bodyweight "12" or "+25×8"; timed "60s" or "60s @ 50 lb"
  - `targetLabel(re: RoutineExercise, type: ExerciseType): string` — "3 × 8–12" or "3 × 60s"
- Produces from components: `useToast(): (msg: string) => void` + `<ToastProvider>`; `<ConfirmButton label? confirmLabel? onConfirm className?>` (two-tap destructive confirm, auto-disarms after 2.5s).
- Routes (HashRouter): `/` Home, `/log/:sessionId`, `/routines`, `/routines/:routineId`, `/stats`, `/stats/:exerciseId`, `/settings`. Bottom tab nav links to Home / Routines / Stats / Settings.

- [ ] **Step 1: Write the failing format tests**

`src/lib/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatDuration, formatSet, round1, targetLabel } from './format';

describe('formatDuration', () => {
  it('formats minutes and hours', () => {
    expect(formatDuration(130)).toBe('2m 10s');
    expect(formatDuration(3900)).toBe('1h 5m');
  });
});

describe('formatSet', () => {
  const base = { sessionId: 1, exerciseId: 1, setNumber: 1, loggedAt: 0 };
  it('formats each exercise type', () => {
    expect(formatSet({ ...base, weightLbs: 135, reps: 10 }, 'weighted')).toBe('135×10');
    expect(formatSet({ ...base, reps: 12 }, 'bodyweight')).toBe('12');
    expect(formatSet({ ...base, weightLbs: 25, reps: 8 }, 'bodyweight')).toBe('+25×8');
    expect(formatSet({ ...base, durationSeconds: 60 }, 'timed')).toBe('60s');
    expect(formatSet({ ...base, durationSeconds: 60, weightLbs: 50 }, 'timed')).toBe('60s @ 50 lb');
  });
});

describe('targetLabel', () => {
  it('formats rep-range and timed targets', () => {
    expect(
      targetLabel(
        { routineId: 1, exerciseId: 1, order: 1, targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 },
        'weighted',
      ),
    ).toBe('3 × 8–12');
    expect(
      targetLabel(
        { routineId: 1, exerciseId: 1, order: 1, targetSets: 3, targetDurationSeconds: 60 },
        'timed',
      ),
    ).toBe('3 × 60s');
  });
});

describe('round1', () => {
  it('rounds to one decimal', () => {
    expect(round1(180.04)).toBe(180);
    expect(round1(262.55)).toBe(262.6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL — cannot resolve `./format`.

- [ ] **Step 3: Implement format.ts**

`src/lib/format.ts`:

```ts
import type { ExerciseType, RoutineExercise, SetLog } from '../db/db';
import type { MetricKey } from './metrics';

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

export function formatDaysAgo(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m ${s}s`;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function metricLabel(metric: MetricKey): string {
  switch (metric) {
    case 'e1rm':
      return 'est. 1RM';
    case 'topWeight':
      return 'top set';
    case 'volume':
      return 'volume';
    case 'totalReps':
      return 'total reps';
    case 'maxDuration':
      return 'max duration';
  }
}

export function formatSet(set: SetLog, type: ExerciseType): string {
  if (type === 'timed') {
    const base = `${set.durationSeconds ?? 0}s`;
    return set.weightLbs !== undefined ? `${base} @ ${set.weightLbs} lb` : base;
  }
  if (type === 'bodyweight') {
    return set.weightLbs !== undefined ? `+${set.weightLbs}×${set.reps ?? 0}` : `${set.reps ?? 0}`;
  }
  return `${set.weightLbs ?? 0}×${set.reps ?? 0}`;
}

export function targetLabel(re: RoutineExercise, type: ExerciseType): string {
  if (type === 'timed') return `${re.targetSets} × ${re.targetDurationSeconds ?? 0}s`;
  return `${re.targetSets} × ${re.targetRepsMin ?? 0}–${re.targetRepsMax ?? 0}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/format.test.ts`
Expected: all PASS.

- [ ] **Step 5: Implement shell components and placeholder screens**

`src/components/Toast.tsx`:

```tsx
import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext<(msg: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 3000);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </ToastContext.Provider>
  );
}
```

`src/components/ConfirmButton.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';

export default function ConfirmButton({
  label = '✕',
  confirmLabel = 'Sure?',
  onConfirm,
  className = 'danger small',
}: {
  label?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function click() {
    if (armed) {
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timer.current = window.setTimeout(() => setArmed(false), 2500);
  }

  return (
    <button className={className} onClick={click}>
      {armed ? confirmLabel : label}
    </button>
  );
}
```

Each of the seven screen files gets a placeholder for now (replaced in later tasks), e.g. `src/screens/HomeScreen.tsx`:

```tsx
export default function HomeScreen() {
  return <div className="screen"><h1>Home</h1></div>;
}
```

(Repeat the same pattern with headings "Logging", "Routines", "Routine", "Stats", "Exercise", "Settings" for the other six files, default-exporting `LoggingScreen`, `RoutinesScreen`, `RoutineEditorScreen`, `StatsScreen`, `ExerciseStatsScreen`, `SettingsScreen` respectively.)

`src/App.tsx` (replace placeholder):

```tsx
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import HomeScreen from './screens/HomeScreen';
import LoggingScreen from './screens/LoggingScreen';
import RoutinesScreen from './screens/RoutinesScreen';
import RoutineEditorScreen from './screens/RoutineEditorScreen';
import StatsScreen from './screens/StatsScreen';
import ExerciseStatsScreen from './screens/ExerciseStatsScreen';
import SettingsScreen from './screens/SettingsScreen';

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <div className="app">
          <main className="content">
            <Routes>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/log/:sessionId" element={<LoggingScreen />} />
              <Route path="/routines" element={<RoutinesScreen />} />
              <Route path="/routines/:routineId" element={<RoutineEditorScreen />} />
              <Route path="/stats" element={<StatsScreen />} />
              <Route path="/stats/:exerciseId" element={<ExerciseStatsScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
            </Routes>
          </main>
          <nav className="tabbar">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/routines">Routines</NavLink>
            <NavLink to="/stats">Stats</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </nav>
        </div>
      </ToastProvider>
    </HashRouter>
  );
}
```

`src/styles.css` (replace empty file):

```css
:root {
  --bg: #111418;
  --surface: #1c2128;
  --border: #2d333b;
  --text: #e6edf3;
  --muted: #8b949e;
  --accent: #4f8ef7;
  --danger: #e5534b;
  --pr: #f5a623;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; }
.app { display: flex; flex-direction: column; min-height: 100dvh; }
.content { flex: 1; padding: 16px; padding-bottom: 76px; max-width: 640px; margin: 0 auto; width: 100%; }
.tabbar { position: fixed; bottom: 0; left: 0; right: 0; display: flex; background: var(--surface); border-top: 1px solid var(--border); padding-bottom: env(safe-area-inset-bottom); z-index: 5; }
.tabbar a { flex: 1; text-align: center; padding: 14px 0; color: var(--muted); text-decoration: none; font-size: 14px; }
.tabbar a.active { color: var(--accent); font-weight: 600; }
h1 { font-size: 22px; margin: 8px 0 16px; }
a { color: var(--accent); text-decoration: none; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
button { background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 8px 14px; font-size: 15px; }
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
button.big { width: 100%; padding: 14px; font-size: 17px; margin-top: 8px; display: block; }
button.danger { color: var(--danger); }
button.small { padding: 4px 10px; font-size: 13px; }
button:disabled { opacity: 0.5; }
input, select, textarea { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-size: 16px; }
input[type='number'] { width: 76px; }
input[type='checkbox'] { width: auto; }
textarea { width: 100%; min-height: 70px; margin: 10px 0; }
.row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.spread { justify-content: space-between; }
.small { font-size: 13px; color: var(--muted); }
.muted { color: var(--muted); }
.set-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.set-row.logged { opacity: 0.75; }
.last-time { color: var(--muted); font-size: 13px; margin: 4px 0 8px; }
.toast { position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%); background: var(--danger); color: #fff; padding: 10px 18px; border-radius: 8px; z-index: 20; white-space: nowrap; }
.rest-bar { position: fixed; bottom: 52px; left: 0; right: 0; display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: var(--surface); border-top: 1px solid var(--border); z-index: 10; }
.rest-bar.done { background: var(--accent); }
.rest-time { flex: 1; font-size: 20px; font-variant-numeric: tabular-nums; font-weight: 600; }
.pr-card { border-color: var(--pr); }
.banner { background: var(--surface); border: 1px solid var(--pr); border-radius: 12px; padding: 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
```

- [ ] **Step 6: Verify by hand**

Run: `npm run dev`. Check: dark theme applies; all four tabs navigate and highlight when active; each placeholder screen renders. Run `npm run build` — no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add app shell with tab navigation, toast, styles, format helpers"
```

---

### Task 8: Routines screen, routine editor, exercise library

**Files:**
- Modify: `src/screens/RoutinesScreen.tsx`, `src/screens/RoutineEditorScreen.tsx` (replace placeholders)

**Interfaces:**
- Consumes: `db`; mutations `createRoutine`, `deleteRoutine`, `deleteExercise`, `updateExercise`, `createExercise`, `addExerciseToRoutine`, `updateRoutineExercise`, `removeRoutineExercise`, `moveRoutineExercise`; `DuplicateExerciseNameError`; `getSetting`; `targetLabel`; `useToast`; `ConfirmButton`; `useLiveQuery` from `dexie-react-hooks`.
- Produces: working routine CRUD UI. No new exports consumed by later tasks.

- [ ] **Step 1: Implement RoutinesScreen**

`src/screens/RoutinesScreen.tsx` (replace placeholder):

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise } from '../db/db';
import { createRoutine, deleteExercise, deleteRoutine, updateExercise } from '../db/mutations';
import ConfirmButton from '../components/ConfirmButton';
import { useToast } from '../components/Toast';

export default function RoutinesScreen() {
  const toast = useToast();
  const routines = useLiveQuery(() => db.routines.filter((r) => r.archived === 0).toArray(), []);
  const exercises = useLiveQuery(() => db.exercises.filter((e) => e.archived === 0).toArray(), []);
  const [newName, setNewName] = useState('');

  async function create() {
    const name = newName.trim();
    if (!name) return;
    try {
      await createRoutine(name);
      setNewName('');
    } catch {
      toast("Couldn't create routine");
    }
  }

  return (
    <div className="screen">
      <h1>Routines</h1>
      <div className="row">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New routine name"
        />
        <button className="primary" onClick={create}>Add</button>
      </div>
      <div style={{ marginTop: 12 }}>
        {routines?.map((r) => (
          <div className="card row spread" key={r.id}>
            <Link to={`/routines/${r.id}`}><strong>{r.name}</strong></Link>
            <ConfirmButton
              onConfirm={async () => {
                try {
                  const result = await deleteRoutine(r.id!);
                  toast(result === 'archived' ? 'Routine archived (has history)' : 'Routine deleted');
                } catch {
                  toast("Couldn't delete routine");
                }
              }}
            />
          </div>
        ))}
        {routines?.length === 0 && <p className="muted">No routines yet — add one above.</p>}
      </div>
      <h1>Exercise library</h1>
      {exercises?.map((e) => <ExerciseLibRow key={e.id} exercise={e} />)}
      {exercises?.length === 0 && (
        <p className="muted">Exercises appear here once you add them to a routine.</p>
      )}
    </div>
  );
}

function ExerciseLibRow({ exercise }: { exercise: Exercise }) {
  const toast = useToast();
  const [name, setName] = useState(exercise.name);
  const [rest, setRest] = useState(String(exercise.defaultRestSeconds));

  async function save() {
    const trimmed = name.trim();
    const restNum = Number(rest);
    if (!trimmed || !Number.isFinite(restNum) || restNum < 0) return;
    try {
      await updateExercise(exercise.id!, { name: trimmed, defaultRestSeconds: restNum });
    } catch {
      toast("Couldn't save exercise");
    }
  }

  return (
    <div className="card">
      <div className="row spread">
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={save} />
        <ConfirmButton
          onConfirm={async () => {
            try {
              const result = await deleteExercise(exercise.id!);
              toast(result === 'archived' ? 'Exercise archived (has history)' : 'Exercise deleted');
            } catch {
              toast("Couldn't delete exercise");
            }
          }}
        />
      </div>
      <div className="row small" style={{ marginTop: 8 }}>
        <span>{exercise.type}</span>
        <span>· rest</span>
        <input type="number" value={rest} onChange={(e) => setRest(e.target.value)} onBlur={save} />
        <span>s</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement RoutineEditorScreen**

`src/screens/RoutineEditorScreen.tsx` (replace placeholder):

```tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise, type ExerciseType, type RoutineExercise } from '../db/db';
import {
  DuplicateExerciseNameError,
  addExerciseToRoutine,
  createExercise,
  moveRoutineExercise,
  removeRoutineExercise,
  renameRoutine,
  updateRoutineExercise,
} from '../db/mutations';
import { getSetting } from '../db/settings';
import { targetLabel } from '../lib/format';
import ConfirmButton from '../components/ConfirmButton';
import { useToast } from '../components/Toast';

export default function RoutineEditorScreen() {
  const { routineId } = useParams();
  const rid = Number(routineId);
  const toast = useToast();
  const routine = useLiveQuery(() => db.routines.get(rid), [rid]);
  const items = useLiveQuery(async () => {
    const res = await db.routineExercises.where('routineId').equals(rid).sortBy('order');
    const exs = await db.exercises.bulkGet(res.map((r) => r.exerciseId));
    return res
      .map((re, i) => ({ re, exercise: exs[i] }))
      .filter((x): x is { re: RoutineExercise; exercise: Exercise } => x.exercise !== undefined);
  }, [rid]);
  const [showPicker, setShowPicker] = useState(false);
  const [name, setName] = useState<string | null>(null);

  if (!routine || !items) return <div className="screen">Loading…</div>;

  return (
    <div className="screen">
      <input
        style={{ fontSize: 22, fontWeight: 600, width: '100%', marginBottom: 12 }}
        value={name ?? routine.name}
        onChange={(e) => setName(e.target.value)}
        onBlur={async () => {
          if (name && name.trim()) {
            try {
              await renameRoutine(rid, name);
            } catch {
              toast("Couldn't rename routine");
            }
          }
          setName(null);
        }}
      />
      {items.map(({ re, exercise }, i) => (
        <RoutineExerciseRow
          key={re.id}
          re={re}
          exercise={exercise}
          isFirst={i === 0}
          isLast={i === items.length - 1}
        />
      ))}
      {showPicker ? (
        <ExercisePicker
          routineId={rid}
          inRoutine={new Set(items.map((x) => x.re.exerciseId))}
          onDone={() => setShowPicker(false)}
        />
      ) : (
        <button className="big" onClick={() => setShowPicker(true)}>+ Add exercise</button>
      )}
    </div>
  );
}

function RoutineExerciseRow({
  re,
  exercise,
  isFirst,
  isLast,
}: {
  re: RoutineExercise;
  exercise: Exercise;
  isFirst: boolean;
  isLast: boolean;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);

  async function move(direction: -1 | 1) {
    try {
      await moveRoutineExercise(re.routineId, re.id!, direction);
    } catch {
      toast("Couldn't reorder");
    }
  }

  return (
    <div className="card">
      <div className="row spread">
        <strong>{exercise.name}</strong>
        <div className="row">
          <button className="small" disabled={isFirst} onClick={() => move(-1)}>▲</button>
          <button className="small" disabled={isLast} onClick={() => move(1)}>▼</button>
          <button className="small" onClick={() => setEditing((v) => !v)}>Edit</button>
          <ConfirmButton
            onConfirm={async () => {
              try {
                await removeRoutineExercise(re.id!);
              } catch {
                toast("Couldn't remove exercise");
              }
            }}
          />
        </div>
      </div>
      <div className="small">{targetLabel(re, exercise.type)}</div>
      {editing && <TargetEditor re={re} type={exercise.type} onSaved={() => setEditing(false)} />}
    </div>
  );
}

function TargetEditor({
  re,
  type,
  onSaved,
}: {
  re: RoutineExercise;
  type: ExerciseType;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [sets, setSets] = useState(String(re.targetSets));
  const [min, setMin] = useState(String(re.targetRepsMin ?? 8));
  const [max, setMax] = useState(String(re.targetRepsMax ?? 12));
  const [dur, setDur] = useState(String(re.targetDurationSeconds ?? 60));

  async function save() {
    const targetSets = Number(sets);
    if (!Number.isInteger(targetSets) || targetSets < 1) {
      toast('Sets must be at least 1');
      return;
    }
    try {
      if (type === 'timed') {
        await updateRoutineExercise(re.id!, { targetSets, targetDurationSeconds: Number(dur) });
      } else {
        await updateRoutineExercise(re.id!, {
          targetSets,
          targetRepsMin: Number(min),
          targetRepsMax: Number(max),
        });
      }
      onSaved();
    } catch {
      toast("Couldn't save targets");
    }
  }

  return (
    <div className="row" style={{ marginTop: 8 }}>
      <input type="number" value={sets} onChange={(e) => setSets(e.target.value)} />
      <span>sets ×</span>
      {type === 'timed' ? (
        <>
          <input type="number" value={dur} onChange={(e) => setDur(e.target.value)} />
          <span>s</span>
        </>
      ) : (
        <>
          <input type="number" value={min} onChange={(e) => setMin(e.target.value)} />
          <span>–</span>
          <input type="number" value={max} onChange={(e) => setMax(e.target.value)} />
          <span>reps</span>
        </>
      )}
      <button className="primary small" onClick={save}>Save</button>
    </div>
  );
}

function ExercisePicker({
  routineId,
  inRoutine,
  onDone,
}: {
  routineId: number;
  inRoutine: Set<number>;
  onDone: () => void;
}) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ExerciseType>('weighted');
  const globalRest = useLiveQuery(() => getSetting<number>('globalRestSeconds', 90), []);
  const matches = useLiveQuery(async () => {
    const all = await db.exercises.filter((e) => e.archived === 0).toArray();
    const query = q.trim().toLowerCase();
    return all.filter(
      (e) => !inRoutine.has(e.id!) && (query === '' || e.name.toLowerCase().includes(query)),
    );
  }, [q]);

  async function pick(exerciseId: number) {
    try {
      await addExerciseToRoutine(routineId, exerciseId);
      onDone();
    } catch {
      toast("Couldn't add exercise");
    }
  }

  async function createAndAdd() {
    if (!newName.trim()) return;
    try {
      const id = await createExercise(newName, newType, globalRest ?? 90);
      await addExerciseToRoutine(routineId, id);
      onDone();
    } catch (e) {
      toast(
        e instanceof DuplicateExerciseNameError
          ? 'An exercise with that name already exists'
          : "Couldn't create exercise",
      );
    }
  }

  return (
    <div className="card">
      <div className="row spread">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" />
        <button className="small" onClick={onDone}>Cancel</button>
      </div>
      {matches?.map((e) => (
        <div key={e.id} className="row spread" style={{ marginTop: 8 }}>
          <span>
            {e.name} <span className="small">({e.type})</span>
          </span>
          <button className="small primary" onClick={() => pick(e.id!)}>Add</button>
        </div>
      ))}
      {creating ? (
        <div className="row" style={{ marginTop: 12 }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Exercise name"
          />
          <select value={newType} onChange={(e) => setNewType(e.target.value as ExerciseType)}>
            <option value="weighted">Weighted</option>
            <option value="bodyweight">Bodyweight</option>
            <option value="timed">Timed</option>
          </select>
          <button className="primary small" onClick={createAndAdd}>Create</button>
        </div>
      ) : (
        <button className="small" style={{ marginTop: 12 }} onClick={() => setCreating(true)}>
          + New exercise
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify by hand**

Run: `npm run dev`. Checklist:
- Create routines "Workout A" and "Workout B"; create exercises Bench Press (weighted), Pull-ups (bodyweight), Farmer's Carry (timed) inside Workout A via the picker.
- Edit targets on each; timed shows seconds, others show a rep range; `targetLabel` renders correctly.
- Reorder with ▲/▼; edges are disabled; order survives reload.
- Duplicate exercise name shows the toast, not a crash.
- Delete an exercise with no history — it disappears from library and routine. Rename a routine inline.
- `npm test` and `npm run build` still pass.

- [ ] **Step 4: Commit**

```bash
git add src/screens/RoutinesScreen.tsx src/screens/RoutineEditorScreen.tsx
git commit -m "feat: add routine editor and exercise library screens"
```

---

### Task 9: Home screen

**Files:**
- Modify: `src/screens/HomeScreen.tsx` (replace placeholder)

**Interfaces:**
- Consumes: `db`; `getActiveSession`, `getLastFinishedSessionDate` from `queries.ts`; `startSession`, `ActiveSessionExistsError` from `mutations.ts`; `getSetting`; `formatDaysAgo`; `useToast`.
- Produces: navigation into `/log/:sessionId` on start/resume — the contract Task 10 depends on.

- [ ] **Step 1: Implement HomeScreen**

`src/screens/HomeScreen.tsx` (replace placeholder):

```tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { getActiveSession, getLastFinishedSessionDate } from '../db/queries';
import { startSession } from '../db/mutations';
import { getSetting } from '../db/settings';
import { formatDaysAgo } from '../lib/format';
import { useToast } from '../components/Toast';

export default function HomeScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const routines = useLiveQuery(() => db.routines.filter((r) => r.archived === 0).toArray(), []);
  const active = useLiveQuery(getActiveSession, []);
  const lastDone = useLiveQuery(async () => {
    const all = await db.routines.filter((r) => r.archived === 0).toArray();
    const entries = await Promise.all(
      all.map(async (r) => [r.id!, await getLastFinishedSessionDate(r.id!)] as const),
    );
    return new Map(entries);
  }, []);
  const needsBackup = useLiveQuery(async () => {
    if ((await db.sessions.count()) === 0) return false;
    const last = await getSetting<number | null>('lastExportAt', null);
    return last === null || Date.now() - last > 30 * 24 * 3600 * 1000;
  }, []);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  async function start(routineId: number) {
    try {
      const id = await startSession(routineId);
      navigate(`/log/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't start workout");
    }
  }

  return (
    <div className="screen">
      <h1>Workout</h1>
      {needsBackup && !nudgeDismissed && (
        <div className="banner">
          <span className="small">It's been a while since your last backup.</span>
          <div className="row">
            <Link to="/settings"><button className="small">Export</button></Link>
            <button className="small" onClick={() => setNudgeDismissed(true)}>✕</button>
          </div>
        </div>
      )}
      {active && (
        <div className="banner">
          <span>Workout in progress</span>
          <button className="primary" onClick={() => navigate(`/log/${active.id}`)}>Resume</button>
        </div>
      )}
      {routines?.map((r) => {
        const last = lastDone?.get(r.id!);
        return (
          <button
            key={r.id}
            className="card big"
            style={{ textAlign: 'left' }}
            disabled={!!active}
            onClick={() => start(r.id!)}
          >
            <strong>{r.name}</strong>
            <div className="small">{last ? `Last done ${formatDaysAgo(last)}` : 'Never done'}</div>
          </button>
        );
      })}
      {routines?.length === 0 && (
        <p className="muted">Create a routine in the Routines tab to get started.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify by hand**

Run: `npm run dev`. Checklist:
- Routine cards render with "Never done".
- Tapping a card navigates to `/log/<id>` (placeholder Logging screen for now).
- Going back Home shows the "Workout in progress" banner; routine cards are disabled; Resume returns to the same URL.
- `npm run build` passes.

- [ ] **Step 3: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: add home screen with routine cards, resume banner, backup nudge"
```

---

### Task 10: Logging screen — exercise cards, last-time history, set logging

**Files:**
- Modify: `src/screens/LoggingScreen.tsx` (replace placeholder)

**Interfaces:**
- Consumes: `db`; `getLastTime` from `queries.ts`; `logSet`, `deleteSet`, `finishSession` from `mutations.ts`; `formatDate`, `formatSet`, `targetLabel`; `useToast`; `ConfirmButton`.
- Produces: `ActiveWorkout` and `ExerciseCard` internal components. `ExerciseCard` takes an `onSetLogged: (restSeconds: number) => void` prop — Task 11 wires the rest timer through it (in this task the handler is a no-op). Finishing navigates Home (Task 12 replaces that with the summary view).

- [ ] **Step 1: Implement LoggingScreen**

`src/screens/LoggingScreen.tsx` (replace placeholder):

```tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise, type RoutineExercise, type Session } from '../db/db';
import { getLastTime } from '../db/queries';
import { deleteSet, finishSession, logSet } from '../db/mutations';
import { formatDate, formatSet, targetLabel } from '../lib/format';
import ConfirmButton from '../components/ConfirmButton';
import { useToast } from '../components/Toast';

export default function LoggingScreen() {
  const { sessionId } = useParams();
  const id = Number(sessionId);
  const session = useLiveQuery(() => db.sessions.get(id), [id]);

  if (!session) return <div className="screen">Loading…</div>;
  return <ActiveWorkout session={session} />;
}

function ActiveWorkout({ session }: { session: Session }) {
  const navigate = useNavigate();
  const toast = useToast();
  const items = useLiveQuery(async () => {
    const res = await db.routineExercises
      .where('routineId')
      .equals(session.routineId)
      .sortBy('order');
    const exs = await db.exercises.bulkGet(res.map((re) => re.exerciseId));
    return res
      .map((re, i) => ({ re, exercise: exs[i] }))
      .filter((x): x is { re: RoutineExercise; exercise: Exercise } => x.exercise !== undefined);
  }, [session.routineId]);

  function onSetLogged(_restSeconds: number) {
    // Rest timer wiring arrives in the next task.
  }

  async function finish() {
    try {
      await finishSession(session.id!);
      navigate('/');
    } catch {
      toast("Couldn't finish workout");
    }
  }

  return (
    <div className="screen">
      <h1>Workout</h1>
      {items?.map(({ re, exercise }) => (
        <ExerciseCard
          key={re.id}
          session={session}
          re={re}
          exercise={exercise}
          onSetLogged={onSetLogged}
        />
      ))}
      <button className="primary big" onClick={finish}>Finish workout</button>
    </div>
  );
}

interface PendingRow {
  weight: string;
  amount: string; // reps, or seconds for timed exercises
}

function ExerciseCard({
  session,
  re,
  exercise,
  onSetLogged,
}: {
  session: Session;
  re: RoutineExercise;
  exercise: Exercise;
  onSetLogged: (restSeconds: number) => void;
}) {
  const toast = useToast();
  const logged = useLiveQuery(
    () =>
      db.setLogs
        .where('sessionId')
        .equals(session.id!)
        .and((s) => s.exerciseId === exercise.id)
        .sortBy('setNumber'),
    [session.id, exercise.id],
  );
  const lastTime = useLiveQuery(() => getLastTime(exercise.id!, session.id), [exercise.id, session.id]);
  const [pending, setPending] = useState<PendingRow[] | null>(null);

  if (logged === undefined || lastTime === undefined) return null;

  const rows =
    pending ??
    Array.from({ length: Math.max(re.targetSets - logged.length, 0) }, (_, i) => ({
      weight: String(lastTime?.sets[logged.length + i]?.weightLbs ?? ''),
      amount: '',
    }));

  function updateRow(i: number, patch: Partial<PendingRow>) {
    setPending(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function logRow(i: number) {
    const row = rows[i];
    const weight = row.weight.trim() === '' ? undefined : Number(row.weight);
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast(exercise.type === 'timed' ? 'Enter seconds' : 'Enter reps');
      return;
    }
    if (weight !== undefined && !Number.isFinite(weight)) {
      toast('Weight must be a number');
      return;
    }
    if (exercise.type === 'weighted' && weight === undefined) {
      toast('Enter a weight');
      return;
    }
    try {
      await logSet({
        sessionId: session.id!,
        exerciseId: exercise.id!,
        setNumber: logged.length + 1,
        weightLbs: weight,
        reps: exercise.type === 'timed' ? undefined : amount,
        durationSeconds: exercise.type === 'timed' ? amount : undefined,
      });
      setPending(rows.filter((_, j) => j !== i));
      onSetLogged(exercise.defaultRestSeconds);
    } catch {
      toast("Couldn't save — set not recorded");
    }
  }

  return (
    <div className="card">
      <div className="row spread">
        <strong>{exercise.name}</strong>
        <span className="small">{targetLabel(re, exercise.type)}</span>
      </div>
      <div className="last-time">
        {lastTime
          ? `Last: ${lastTime.sets.map((s) => formatSet(s, exercise.type)).join(', ')} — ${formatDate(
              lastTime.session.startedAt,
            )}`
          : 'First time!'}
      </div>
      {logged.map((s) => (
        <div className="set-row logged" key={s.id}>
          <span style={{ flex: 1 }}>
            Set {s.setNumber}: {formatSet(s, exercise.type)}
          </span>
          <ConfirmButton
            onConfirm={async () => {
              try {
                await deleteSet(s.id!);
              } catch {
                toast("Couldn't delete set");
              }
            }}
          />
        </div>
      ))}
      {rows.map((row, i) => (
        <div className="set-row" key={`pending-${i}`}>
          <input
            type="number"
            inputMode="decimal"
            placeholder="lb"
            value={row.weight}
            onChange={(e) => updateRow(i, { weight: e.target.value })}
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder={exercise.type === 'timed' ? 'sec' : 'reps'}
            value={row.amount}
            onChange={(e) => updateRow(i, { amount: e.target.value })}
          />
          <button className="primary" onClick={() => logRow(i)}>✓</button>
          <button className="small" onClick={() => setPending(rows.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button
        className="small"
        style={{ marginTop: 8 }}
        onClick={() => setPending([...rows, { weight: '', amount: '' }])}
      >
        + Add set
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify by hand**

Run: `npm run dev`. Checklist:
- Start Workout A from Home. Each exercise card shows target, "First time!", and `targetSets` pending rows.
- Log sets on Bench Press; rows convert to logged lines; reload the page mid-workout — logged sets persist and remaining pending rows re-derive.
- Finish, start Workout A again: cards now show "Last: 135×10, … — <date>" and weight inputs pre-fill from the matching set number.
- Timed exercise accepts seconds; bodyweight works with empty weight; weighted refuses empty weight with a toast.
- "+ Add set" adds a row; ✕ removes one; deleting a logged set restores nothing silently (expected).
- `npm test` and `npm run build` pass.

- [ ] **Step 3: Commit**

```bash
git add src/screens/LoggingScreen.tsx
git commit -m "feat: add workout logging screen with last-time history and prefill"
```

---

### Task 11: Rest timer bar

**Files:**
- Create: `src/components/RestTimerBar.tsx`
- Modify: `src/screens/LoggingScreen.tsx` (wire the timer into `ActiveWorkout`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `RestTimerBar` default export with props `{ endsAt: number; onAdd30: () => void; onDismiss: () => void }`. `ActiveWorkout` gains `autoRest` (default `true`, header checkbox) and `restEndsAt: number | null` state; `onSetLogged(restSeconds)` becomes: if `autoRest`, set `restEndsAt = Date.now() + restSeconds * 1000`.

- [ ] **Step 1: Implement RestTimerBar**

`src/components/RestTimerBar.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';

export default function RestTimerBar({
  endsAt,
  onAdd30,
  onDismiss,
}: {
  endsAt: number;
  onAdd30: () => void;
  onDismiss: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);

  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));

  useEffect(() => {
    if (remaining === 0 && !fired.current) {
      fired.current = true;
      navigator.vibrate?.([300, 100, 300]);
    }
    if (remaining > 0) fired.current = false;
  }, [remaining]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className={`rest-bar${remaining === 0 ? ' done' : ''}`}>
      <span className="rest-time">
        {remaining === 0 ? 'Go!' : `${mins}:${String(secs).padStart(2, '0')}`}
      </span>
      <button onClick={onAdd30}>+30s</button>
      <button onClick={onDismiss}>{remaining === 0 ? 'OK' : 'Skip'}</button>
    </div>
  );
}
```

- [ ] **Step 2: Wire into ActiveWorkout**

In `src/screens/LoggingScreen.tsx`, add to the imports:

```tsx
import RestTimerBar from '../components/RestTimerBar';
```

In `ActiveWorkout`, add state and replace the no-op `onSetLogged`:

```tsx
const [autoRest, setAutoRest] = useState(true);
const [restEndsAt, setRestEndsAt] = useState<number | null>(null);

function onSetLogged(restSeconds: number) {
  if (autoRest) setRestEndsAt(Date.now() + restSeconds * 1000);
}
```

Replace the `<h1>Workout</h1>` header with a header row containing the toggle:

```tsx
<header className="row spread">
  <h1>Workout</h1>
  <label className="row small">
    <input type="checkbox" checked={autoRest} onChange={(e) => setAutoRest(e.target.checked)} />
    Auto rest timer
  </label>
</header>
```

And render the bar after the Finish button, inside the screen div:

```tsx
{restEndsAt !== null && (
  <RestTimerBar
    endsAt={restEndsAt}
    onAdd30={() => setRestEndsAt((t) => (t ?? Date.now()) + 30_000)}
    onDismiss={() => setRestEndsAt(null)}
  />
)}
```

- [ ] **Step 3: Verify by hand**

Run: `npm run dev`. Checklist:
- Logging a set starts the countdown bar above the tab bar, using that exercise's `defaultRestSeconds`.
- +30s extends it; Skip hides it; at zero it flips to "Go!" with accent background (vibration verifiable on the phone later).
- Unchecking "Auto rest timer" stops new sets from starting the countdown; re-checking restores it; a fresh session defaults to on.
- `npm run build` passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/RestTimerBar.tsx src/screens/LoggingScreen.tsx
git commit -m "feat: add auto-starting rest timer bar with vibration"
```

---

### Task 12: Finish summary with PRs and session note

**Files:**
- Modify: `src/screens/LoggingScreen.tsx`

**Interfaces:**
- Consumes: `detectSessionPRs` from `queries.ts`; `updateSessionNote` from `mutations.ts`; `formatDuration`, `metricLabel`, `round1` from `format.ts` / `metrics.ts`.
- Produces: `LoggingScreen` now renders `SessionSummary` when `session.finishedAt !== null`; `finish()` no longer navigates (the live query re-renders into the summary).

- [ ] **Step 1: Implement the summary**

In `src/screens/LoggingScreen.tsx`, extend imports:

```tsx
import { detectSessionPRs, getLastTime } from '../db/queries';
import { deleteSet, finishSession, logSet, updateSessionNote } from '../db/mutations';
import { formatDate, formatDuration, formatSet, targetLabel } from '../lib/format';
import { metricLabel, round1 } from '../lib/format';
```

(Note: `metricLabel` and `round1` already live in `format.ts` — merge them into the one import statement.)

Change `LoggingScreen`'s return to branch on completion:

```tsx
if (!session) return <div className="screen">Loading…</div>;
return session.finishedAt === null ? (
  <ActiveWorkout session={session} />
) : (
  <SessionSummary session={session} />
);
```

In `ActiveWorkout.finish()`, delete the `navigate('/')` line (the live query flips the view to the summary). Remove the now-unused `useNavigate` import from `ActiveWorkout` if nothing else uses it.

Add the component:

```tsx
function SessionSummary({ session }: { session: Session }) {
  const navigate = useNavigate();
  const toast = useToast();
  const prs = useLiveQuery(() => detectSessionPRs(session.id!), [session.id]);
  const setCount = useLiveQuery(
    () => db.setLogs.where('sessionId').equals(session.id!).count(),
    [session.id],
  );
  const [note, setNote] = useState(session.note ?? '');
  const durationSec = Math.round(((session.finishedAt ?? session.startedAt) - session.startedAt) / 1000);

  async function saveAndClose() {
    try {
      if (note.trim() !== (session.note ?? '')) await updateSessionNote(session.id!, note.trim());
      navigate('/');
    } catch {
      toast("Couldn't save note");
    }
  }

  return (
    <div className="screen">
      <h1>Workout complete</h1>
      <p>
        {setCount ?? 0} sets · {formatDuration(durationSec)}
      </p>
      {prs && prs.length > 0 && (
        <div className="card pr-card">
          <strong>New PRs 🎉</strong>
          <ul>
            {prs.map((p) => (
              <li key={p.exerciseId}>
                {p.exerciseName}: {metricLabel(p.metric)} {round1(p.value)}
                {p.previousBest !== null ? ` (was ${round1(p.previousBest)})` : ' (first time)'}
              </li>
            ))}
          </ul>
        </div>
      )}
      <textarea
        placeholder="Session note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button className="primary big" onClick={saveAndClose}>Done</button>
    </div>
  );
}
```

- [ ] **Step 2: Verify by hand**

Run: `npm run dev`. Checklist:
- Finish a workout: the screen flips to the summary in place with set count and duration.
- First-ever session shows every logged exercise as a "(first time)" PR; a second session beating est. 1RM shows "(was N)".
- Enter a note, tap Done, land on Home; revisiting `/log/<id>` shows the summary again with the note preserved.
- `npm test` and `npm run build` pass.

- [ ] **Step 3: Commit**

```bash
git add src/screens/LoggingScreen.tsx
git commit -m "feat: add workout finish summary with PR celebration and session note"
```

---

### Task 13: Stats screens — exercise list, progression chart, records, history

**Files:**
- Modify: `src/screens/StatsScreen.tsx`, `src/screens/ExerciseStatsScreen.tsx` (replace placeholders)

**Interfaces:**
- Consumes: `db`; `getExerciseHistory`, `SessionSets` from `queries.ts`; `availableMetricsFor`, `buildSeries`, `defaultMetricFor`, `SessionPoint`, `MetricKey` from `metrics.ts`; `deleteSession`, `deleteSet`, `updateSet` from `mutations.ts`; `formatDate`, `formatShortDate`, `formatSet`, `metricLabel`, `round1`; Recharts (`ResponsiveContainer`, `LineChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`, `CartesianGrid`); `ConfirmButton`; `useToast`.
- Produces: complete stats UI. No exports consumed by later tasks.

- [ ] **Step 1: Implement StatsScreen (exercise list)**

`src/screens/StatsScreen.tsx` (replace placeholder):

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatDaysAgo } from '../lib/format';

export default function StatsScreen() {
  const [q, setQ] = useState('');
  const list = useLiveQuery(async () => {
    const exercises = await db.exercises.filter((e) => e.archived === 0).toArray();
    const withLast = await Promise.all(
      exercises.map(async (e) => {
        const logs = await db.setLogs.where('exerciseId').equals(e.id!).toArray();
        const lastAt = logs.length > 0 ? Math.max(...logs.map((l) => l.loggedAt)) : 0;
        return { exercise: e, lastAt };
      }),
    );
    return withLast.sort((a, b) => b.lastAt - a.lastAt);
  }, []);
  const filtered = list?.filter((x) =>
    x.exercise.name.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div className="screen">
      <h1>Stats</h1>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" />
      <div style={{ marginTop: 12 }}>
        {filtered?.map(({ exercise, lastAt }) => (
          <Link key={exercise.id} to={`/stats/${exercise.id}`}>
            <div className="card row spread">
              <strong>{exercise.name}</strong>
              <span className="small">
                {lastAt > 0 ? `trained ${formatDaysAgo(lastAt)}` : 'never trained'}
              </span>
            </div>
          </Link>
        ))}
        {filtered?.length === 0 && <p className="muted">No exercises match.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement ExerciseStatsScreen**

`src/screens/ExerciseStatsScreen.tsx` (replace placeholder):

```tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { db, type ExerciseType, type SetLog } from '../db/db';
import { getExerciseHistory, type SessionSets } from '../db/queries';
import {
  availableMetricsFor,
  buildSeries,
  defaultMetricFor,
  type MetricKey,
  type SessionPoint,
} from '../lib/metrics';
import { deleteSession, deleteSet, updateSet } from '../db/mutations';
import { formatDate, formatSet, formatShortDate, metricLabel, round1 } from '../lib/format';
import ConfirmButton from '../components/ConfirmButton';
import { useToast } from '../components/Toast';

export default function ExerciseStatsScreen() {
  const { exerciseId } = useParams();
  const eid = Number(exerciseId);
  const exercise = useLiveQuery(() => db.exercises.get(eid), [eid]);
  const history = useLiveQuery(() => getExerciseHistory(eid), [eid]);
  const [metricOverride, setMetricOverride] = useState<MetricKey | null>(null);

  if (!exercise || history === undefined) return <div className="screen">Loading…</div>;

  const metric = metricOverride ?? defaultMetricFor(exercise.type);
  const series = buildSeries(history, metric);
  const data = series.map((p) => ({ ...p, label: formatShortDate(p.date) }));

  return (
    <div className="screen">
      <h1>{exercise.name}</h1>
      <div className="row">
        {availableMetricsFor(exercise.type).map((m) => (
          <button
            key={m}
            className={`small${m === metric ? ' primary' : ''}`}
            onClick={() => setMetricOverride(m)}
          >
            {metricLabel(m)}
          </button>
        ))}
      </div>
      {series.length === 0 ? (
        <p className="muted" style={{ marginTop: 12 }}>No logged sessions yet.</p>
      ) : (
        <>
          <div className="card" style={{ paddingLeft: 0, marginTop: 12 }}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data}>
                <CartesianGrid stroke="#2d333b" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#8b949e" />
                <YAxis stroke="#8b949e" domain={['auto', 'auto']} width={44} />
                <Tooltip
                  contentStyle={{ background: '#1c2128', border: '1px solid #2d333b' }}
                  formatter={(v) => [String(round1(Number(v))), metricLabel(metric)]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#4f8ef7"
                  dot={<PRDot />}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Records history={history} type={exercise.type} />
          <HistoryList history={history} type={exercise.type} />
        </>
      )}
    </div>
  );
}

function PRDot(props: { cx?: number; cy?: number; payload?: SessionPoint }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  return (
    <circle cx={cx} cy={cy} r={payload.isPR ? 5 : 3} fill={payload.isPR ? '#f5a623' : '#4f8ef7'} />
  );
}

function Records({ history, type }: { history: SessionSets[]; type: ExerciseType }) {
  return (
    <div className="card small">
      {availableMetricsFor(type).map((m) => {
        const points = buildSeries(history, m);
        const best = Math.max(...points.map((p) => p.value), 0);
        return (
          <div key={m}>
            Best {metricLabel(m)}: <strong>{round1(best)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function HistoryList({ history, type }: { history: SessionSets[]; type: ExerciseType }) {
  const toast = useToast();
  const newestFirst = [...history].reverse();
  return (
    <>
      <h1>History</h1>
      {newestFirst.map(({ session, sets }) => (
        <div className="card" key={session.id}>
          <div className="row spread">
            <strong>{formatDate(session.startedAt)}</strong>
            <ConfirmButton
              confirmLabel="Delete session?"
              onConfirm={async () => {
                try {
                  await deleteSession(session.id!);
                } catch {
                  toast("Couldn't delete session");
                }
              }}
            />
          </div>
          {session.note && <div className="small">“{session.note}”</div>}
          {sets.map((s) => (
            <SetHistoryRow key={s.id} set={s} type={type} />
          ))}
        </div>
      ))}
    </>
  );
}

function SetHistoryRow({ set, type }: { set: SetLog; type: ExerciseType }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState(String(set.weightLbs ?? ''));
  const [amount, setAmount] = useState(
    String(type === 'timed' ? set.durationSeconds ?? '' : set.reps ?? ''),
  );

  async function save() {
    const w = weight.trim() === '' ? undefined : Number(weight);
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) {
      toast(type === 'timed' ? 'Enter seconds' : 'Enter reps');
      return;
    }
    try {
      await updateSet(set.id!, {
        weightLbs: w,
        reps: type === 'timed' ? undefined : a,
        durationSeconds: type === 'timed' ? a : undefined,
      });
      setEditing(false);
    } catch {
      toast("Couldn't save set");
    }
  }

  if (!editing) {
    return (
      <div className="set-row">
        <span style={{ flex: 1 }}>
          Set {set.setNumber}: {formatSet(set, type)}
        </span>
        <button className="small" onClick={() => setEditing(true)}>Edit</button>
        <ConfirmButton
          onConfirm={async () => {
            try {
              await deleteSet(set.id!);
            } catch {
              toast("Couldn't delete set");
            }
          }}
        />
      </div>
    );
  }
  return (
    <div className="set-row">
      <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="lb" />
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={type === 'timed' ? 'sec' : 'reps'}
      />
      <button className="primary small" onClick={save}>Save</button>
    </div>
  );
}
```

- [ ] **Step 3: Verify by hand**

Run: `npm run dev`. Checklist:
- Stats tab lists exercises ordered by most recently trained; search filters.
- An exercise with 2+ finished sessions shows the line chart; PR sessions render as larger amber dots.
- Metric toggle switches between est. 1RM / top set / volume (weighted); records card shows a best per metric.
- History lists sessions newest first with notes; editing a set's numbers updates the chart live; deleting a set/session works via two-tap confirm.
- `npm test` and `npm run build` pass.

- [ ] **Step 4: Commit**

```bash
git add src/screens/StatsScreen.tsx src/screens/ExerciseStatsScreen.tsx
git commit -m "feat: add stats screens with progression chart, PR markers, history editing"
```

---

### Task 14: Settings screen — export, import, rest default

**Files:**
- Modify: `src/screens/SettingsScreen.tsx` (replace placeholder)

**Interfaces:**
- Consumes: `buildBackup`, `validateBackup`, `importBackup`, `BackupFile` from `backup.ts`; `getSetting`, `setSetting` from `settings.ts`; `formatDate`; `useToast`.
- Produces: complete settings UI; sets `'lastExportAt'` on export (which the Home nudge from Task 9 reads).

- [ ] **Step 1: Implement SettingsScreen**

`src/screens/SettingsScreen.tsx` (replace placeholder):

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { buildBackup, importBackup, validateBackup, type BackupFile } from '../db/backup';
import { getSetting, setSetting } from '../db/settings';
import { formatDate } from '../lib/format';
import { useToast } from '../components/Toast';

export default function SettingsScreen() {
  const toast = useToast();
  const globalRest = useLiveQuery(() => getSetting<number>('globalRestSeconds', 90), []);
  const lastExportAt = useLiveQuery(() => getSetting<number | null>('lastExportAt', null), []);
  const [pendingImport, setPendingImport] = useState<BackupFile | null>(null);

  async function doExport() {
    try {
      const backup = await buildBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workout-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await setSetting('lastExportAt', Date.now());
      toast('Backup exported');
    } catch {
      toast('Export failed');
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const result = validateBackup(parsed);
      if (!result.ok) {
        toast(`Invalid backup: ${result.error}`);
        return;
      }
      setPendingImport(result.data);
    } catch {
      toast("Couldn't read file — not valid JSON");
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    try {
      await importBackup(pendingImport);
      setPendingImport(null);
      toast('Data restored');
    } catch {
      toast('Import failed — existing data unchanged');
    }
  }

  return (
    <div className="screen">
      <h1>Settings</h1>
      <div className="card">
        <strong>Backup</strong>
        <p className="small">
          {lastExportAt ? `Last export: ${formatDate(lastExportAt)}` : 'Never exported'}
        </p>
        <button className="primary" onClick={doExport}>Export data</button>
      </div>
      <div className="card">
        <strong>Restore</strong>
        <p className="small">Importing replaces ALL current data.</p>
        <input type="file" accept="application/json,.json" onChange={onFile} />
        {pendingImport && (
          <div style={{ marginTop: 10 }}>
            <p className="small">
              Backup from {formatDate(pendingImport.exportedAt)}: {pendingImport.sessions.length}{' '}
              sessions, {pendingImport.setLogs.length} sets, {pendingImport.exercises.length}{' '}
              exercises.
            </p>
            <div className="row">
              <button className="danger" onClick={confirmImport}>Replace everything</button>
              <button onClick={() => setPendingImport(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      <div className="card">
        <strong>Rest timer default</strong>
        <div className="row" style={{ marginTop: 8 }}>
          <input
            type="number"
            value={globalRest ?? 90}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= 0) void setSetting('globalRestSeconds', n);
            }}
          />
          <span className="small">seconds (default for new exercises)</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify by hand**

Run: `npm run dev`. Checklist:
- Export downloads `workout-backup-<date>.json`; "Last export" updates; the Home nudge disappears.
- Selecting that file for import shows the counts panel; Cancel clears it; "Replace everything" restores and toasts.
- Importing a random `.json` (e.g. `package.json`) is rejected with a clear message and data is untouched.
- Changing the rest default persists across reload and pre-fills the new-exercise form (Task 8 picker).
- `npm test` and `npm run build` pass.

- [ ] **Step 3: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: add settings screen with backup export/import and rest default"
```

---

### Task 15: PWA packaging and GitHub Pages deployment

**Files:**
- Create: `scripts/gen-icons.mjs`, `.github/workflows/deploy.yml`, `public/icon-192.png`, `public/icon-512.png` (generated)
- Modify: `vite.config.ts`, `index.html`

**Interfaces:**
- Consumes: the finished app.
- Produces: installable PWA served at `https://<github-username>.github.io/workout/`.

**Note:** GitHub Pages on a free account requires a **public** repository. The repo holds only code — workout data never leaves the device — but confirm the user is comfortable making it public before pushing (a free alternative with private repos is Cloudflare Pages; only the deploy half of this task would change).

- [ ] **Step 1: Generate icons**

`scripts/gen-icons.mjs`:

```js
import sharp from 'sharp';

const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" rx="20" fill="#111418"/>
    <g stroke="#4f8ef7" stroke-width="8" stroke-linecap="round">
      <line x1="22" y1="50" x2="78" y2="50"/>
      <line x1="28" y1="34" x2="28" y2="66"/>
      <line x1="38" y1="26" x2="38" y2="74"/>
      <line x1="72" y1="34" x2="72" y2="66"/>
      <line x1="62" y1="26" x2="62" y2="74"/>
    </g>
  </svg>`,
);

for (const size of [192, 512]) {
  await sharp(svg).resize(size, size).png().toFile(`public/icon-${size}.png`);
  console.log(`public/icon-${size}.png`);
}
```

Run: `npm run icons` — Expected: both PNGs created under `public/`.

- [ ] **Step 2: Configure the PWA plugin and base path**

`vite.config.ts` (replace):

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/workout/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Workout Tracker',
        short_name: 'Workout',
        description: 'Offline workout tracker',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#111418',
        background_color: '#111418',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
  },
});
```

- [ ] **Step 3: Verify the build locally**

Run: `npm run build` then `npm run preview`. Open the preview URL **plus `/workout/`** path. Expected: app loads, `manifest.webmanifest` and `sw.js` are served, no console errors. DevTools → Application → Manifest shows the icons.

- [ ] **Step 4: Add the deploy workflow**

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [master]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 5: Create the GitHub repo and push** (requires user confirmation that public is OK)

```bash
gh repo create workout --public --source . --push
gh api -X POST repos/{owner}/workout/pages -f build_type=workflow
```

If `gh` is not authenticated, run `gh auth login` first (the user must do this interactively). The repo name **must** be `workout` to match `base: '/workout/'`.

- [ ] **Step 6: Verify the deployment**

Watch the Actions run: `gh run watch`. Expected: build + deploy succeed. Open `https://<username>.github.io/workout/` — the app loads. On the phone: open the URL in Chrome, use "Add to Home screen" / install prompt, launch it standalone, toggle airplane mode and confirm it still opens (offline cache), log a set, confirm vibration fires when the rest timer ends.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add PWA manifest, icons, and GitHub Pages deployment"
git push
```

---

## Post-plan verification (manual, on the Fold 8)

Full acceptance pass against the spec:
1. Create Workouts A/B with shared exercise (e.g. Bench Press in both) → log in A, start B → Bench shows A's numbers as "last time".
2. Reorder/remove/re-add exercises in a routine → stats history unchanged.
3. Kill the browser mid-workout → Resume banner restores the session with logged sets intact.
4. Export on phone → open the JSON on PC browser version → import → identical data.
5. Folded and unfolded widths both render without horizontal scroll.
