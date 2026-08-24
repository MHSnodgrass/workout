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
