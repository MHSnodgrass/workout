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
  linkSuperset,
  logSet,
  moveRoutineExercise,
  removeRoutineExercise,
  setExerciseBar,
  startSession,
  unlinkSuperset,
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

  it('stores muscle groups when the library supplies them', async () => {
    const id = await createExercise('Barbell Squat', 'weighted', 90, {
      muscleGroups: ['Quads', 'Glutes'],
      barLbs: 45,
    });
    const saved = await db.exercises.get(id);
    expect(saved?.muscleGroups).toEqual(['Quads', 'Glutes']);
    expect(saved?.barLbs).toBe(45);
  });

  it('sets and clears the bar weight', async () => {
    const id = await createExercise('Bench Press', 'weighted', 90);
    await setExerciseBar(id, 45);
    expect((await db.exercises.get(id))?.barLbs).toBe(45);
    // Cleared means gone, not undefined-in-place: absent is what "not a
    // barbell lift" looks like everywhere else.
    await setExerciseBar(id, null);
    expect('barLbs' in (await db.exercises.get(id))!).toBe(false);
  });

  it('leaves muscleGroups unset when none are given', async () => {
    // Absent, not []: an untagged exercise and one tagged with nothing are the
    // same thing to the coverage card, and storing [] just adds a lie to backups.
    const id = await createExercise('Face Pull', 'weighted', 90);
    expect((await db.exercises.get(id))?.muscleGroups).toBeUndefined();
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

describe('supersets', () => {
  async function routineOf(n: number): Promise<{ routineId: number; ids: number[] }> {
    const routineId = await seedRoutine();
    const ids: number[] = [];
    for (let i = 0; i < n; i += 1) {
      ids.push(await addExerciseToRoutine(routineId, await seedExercise()));
    }
    return { routineId, ids };
  }

  async function groupsOf(routineId: number): Promise<(number | undefined)[]> {
    const rows = await db.routineExercises.where('routineId').equals(routineId).sortBy('order');
    return rows.map((r) => r.supersetGroup);
  }

  async function orderedIds(routineId: number): Promise<(number | undefined)[]> {
    const rows = await db.routineExercises.where('routineId').equals(routineId).sortBy('order');
    return rows.map((r) => r.id);
  }

  it('links an exercise to the one above it and unlinks the pair again', async () => {
    const { routineId, ids } = await routineOf(2);
    await linkSuperset(routineId, ids[1]);
    const [first, second] = await groupsOf(routineId);
    expect(first).toBeDefined();
    expect(second).toBe(first);

    await unlinkSuperset(routineId, ids[1]);
    expect(await groupsOf(routineId)).toEqual([undefined, undefined]);
  });

  it('moves a linked pair as one block', async () => {
    const { routineId, ids } = await routineOf(3);
    await linkSuperset(routineId, ids[2]); // pair up the last two
    await moveRoutineExercise(routineId, ids[1], -1);
    expect(await orderedIds(routineId)).toEqual([ids[1], ids[2], ids[0]]);
    // …and the pair survived the move.
    const groups = await groupsOf(routineId);
    expect(groups[0]).toBe(groups[1]);
    expect(groups[2]).toBeUndefined();
  });

  it('dissolves the group when removing one half of a pair', async () => {
    const { routineId, ids } = await routineOf(2);
    await linkSuperset(routineId, ids[1]);
    await removeRoutineExercise(ids[1]);
    expect(await groupsOf(routineId)).toEqual([undefined]);
  });
});

describe('settings', () => {
  it('returns fallback then stored value', async () => {
    expect(await getSetting('globalRestSeconds', 90)).toBe(90);
    await setSetting('globalRestSeconds', 120);
    expect(await getSetting('globalRestSeconds', 90)).toBe(120);
  });
});
