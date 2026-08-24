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
