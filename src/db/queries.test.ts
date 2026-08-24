import { beforeEach, describe, expect, it } from 'vitest';
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
