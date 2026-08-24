import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { installStarterProgram } from './starterProgram';
import { STARTER_EXERCISES, STARTER_ROUTINES } from '../lib/starterProgram';
import { resetDb, seedExercise, seedRoutine } from '../test/helpers';

beforeEach(resetDb);

const ENTRY_COUNT = STARTER_ROUTINES.reduce((n, r) => n + r.entries.length, 0);

describe('installStarterProgram', () => {
  it('creates every routine, exercise and entry into an empty database', async () => {
    const summary = await installStarterProgram();

    expect(await db.routines.count()).toBe(STARTER_ROUTINES.length);
    expect(await db.exercises.count()).toBe(STARTER_EXERCISES.length);
    expect(await db.routineExercises.count()).toBe(ENTRY_COUNT);
    expect(summary).toEqual({
      routinesAdded: STARTER_ROUTINES.length,
      exercisesCreated: STARTER_EXERCISES.length,
      exercisesReused: 0,
    });
  });

  it('keeps each routine in the order the program lists it', async () => {
    await installStarterProgram();
    const monday = await db.routines.filter((r) => r.name === 'Squat & Bench').first();
    const rows = await db.routineExercises.where('routineId').equals(monday!.id!).sortBy('order');
    const names = await Promise.all(
      rows.map(async (r) => (await db.exercises.get(r.exerciseId))!.name),
    );
    expect(names).toEqual(STARTER_ROUTINES[0].entries.map((e) => e.exercise));
    expect(new Set(rows.map((r) => r.order)).size).toBe(rows.length);
  });

  it('carries the settings the program depends on', async () => {
    await installStarterProgram();
    const squat = await db.exercises.filter((e) => e.name === 'Back Squat').first();
    expect(squat).toMatchObject({ type: 'weighted', incrementLbs: 5, barLbs: 45, archived: 0 });
    expect(await db.routines.filter((r) => r.name === 'Bench & Volume').first()).toMatchObject({
      weekdays: [5],
    });
  });

  it('links nothing as a superset', async () => {
    await installStarterProgram();
    const rows = await db.routineExercises.toArray();
    expect(rows.every((r) => r.supersetGroup === undefined)).toBe(true);
  });

  it('reuses an exercise you already have rather than duplicating it', async () => {
    await seedExercise({ name: 'Bench Press', defaultRestSeconds: 42, incrementLbs: 10 });
    const summary = await installStarterProgram();

    const benches = await db.exercises.filter((e) => e.name === 'Bench Press').toArray();
    expect(benches).toHaveLength(1);
    // Yours, untouched — the install adds what's missing, it doesn't reconfigure.
    expect(benches[0]).toMatchObject({ defaultRestSeconds: 42, incrementLbs: 10 });
    expect(summary.exercisesReused).toBe(1);
    expect(summary.exercisesCreated).toBe(STARTER_EXERCISES.length - 1);
  });

  it('matches an existing exercise regardless of case', async () => {
    await seedExercise({ name: 'back squat' });
    await installStarterProgram();
    expect(await db.exercises.filter((e) => e.name.toLowerCase() === 'back squat').count()).toBe(1);
  });

  it('skips a routine whose name you already use', async () => {
    await seedRoutine({ name: 'Deadlift & Press' });
    const summary = await installStarterProgram();

    expect(await db.routines.filter((r) => r.name === 'Deadlift & Press').count()).toBe(1);
    expect(summary.routinesAdded).toBe(STARTER_ROUTINES.length - 1);
    // The skipped routine's entries are skipped with it.
    expect(await db.routineExercises.count()).toBe(
      ENTRY_COUNT - STARTER_ROUTINES[1].entries.length,
    );
  });

  it('is safe to run twice', async () => {
    await installStarterProgram();
    const second = await installStarterProgram();

    expect(second).toEqual({ routinesAdded: 0, exercisesCreated: 0, exercisesReused: 0 });
    expect(await db.routines.count()).toBe(STARTER_ROUTINES.length);
    expect(await db.exercises.count()).toBe(STARTER_EXERCISES.length);
    expect(await db.routineExercises.count()).toBe(ENTRY_COUNT);
  });

  it('ignores an archived routine of the same name and installs a fresh one', async () => {
    await seedRoutine({ name: 'Squat & Bench', archived: 1 });
    const summary = await installStarterProgram();
    expect(summary.routinesAdded).toBe(STARTER_ROUTINES.length);
    expect(await db.routines.filter((r) => r.name === 'Squat & Bench' && r.archived === 0).count())
      .toBe(1);
  });
});
