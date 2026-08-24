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
