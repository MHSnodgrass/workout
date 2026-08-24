import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { buildBackup, importBackup, validateBackup, SCHEMA_VERSION } from './backup';
import { logBodyWeight } from './bodyWeights';
import { resetDb, seedExercise, seedRoutine, seedSession, seedSet } from '../test/helpers';

beforeEach(resetDb);

describe('validateBackup', () => {
  it('rejects non-objects, wrong app, missing tables, future versions', () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup({ app: 'other' }).ok).toBe(false);
    expect(validateBackup({ app: 'workout-tracker', schemaVersion: SCHEMA_VERSION }).ok).toBe(false);
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

  it('accepts an older file that predates the bodyWeights table', () => {
    const v1 = {
      app: 'workout-tracker',
      schemaVersion: 1,
      exportedAt: 1,
      exercises: [],
      routines: [],
      routineExercises: [],
      sessions: [],
      setLogs: [],
      settings: [],
    };
    expect(validateBackup(v1).ok).toBe(true);
  });
});

describe('export/import round trip', () => {
  it('restores exactly what was exported, replacing existing data', async () => {
    const ex = await seedExercise({ name: 'Deadlift' });
    const r = await seedRoutine();
    const s = await seedSession(r);
    await seedSet(s, ex, { weightLbs: 315, reps: 5, rir: 2 });
    await logBodyWeight(201.4);
    const backup = await buildBackup();

    await resetDb();
    await seedExercise({ name: 'Should Be Replaced' });
    await importBackup(backup);

    expect(await db.exercises.count()).toBe(1);
    expect((await db.exercises.toArray())[0].name).toBe('Deadlift');
    expect(await db.setLogs.count()).toBe(1);
    expect((await db.setLogs.toArray())[0].weightLbs).toBe(315);
    expect((await db.setLogs.toArray())[0].rir).toBe(2);
    expect((await db.bodyWeights.toArray())[0].weightLbs).toBe(201.4);
  });

  it('clears body weights when restoring a file that has none', async () => {
    await logBodyWeight(201.4);
    const backup = await buildBackup();
    delete (backup as Partial<typeof backup>).bodyWeights;

    await importBackup(backup);

    expect(await db.bodyWeights.count()).toBe(0);
  });
});
