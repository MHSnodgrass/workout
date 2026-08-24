import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { deleteBodyWeight, getBodyWeights, logBodyWeight } from './bodyWeights';
import { resetDb } from '../test/helpers';

beforeEach(resetDb);

const at = (dayOffset: number, hour: number) =>
  new Date(2026, 0, 1 + dayOffset, hour).getTime();

describe('logBodyWeight', () => {
  it('records a reading', async () => {
    await logBodyWeight(201.4, at(0, 7));
    expect(await getBodyWeights()).toEqual([{ id: 1, at: at(0, 7), weightLbs: 201.4 }]);
  });

  it('replaces the same day rather than stacking readings', async () => {
    await logBodyWeight(201, at(0, 7));
    await logBodyWeight(203, at(0, 21));

    const all = await getBodyWeights();
    expect(all).toHaveLength(1);
    expect(all[0].weightLbs).toBe(203);
    expect(all[0].at).toBe(at(0, 21));
  });

  it('keeps separate days apart', async () => {
    await logBodyWeight(201, at(0, 7));
    await logBodyWeight(200, at(1, 7));
    expect(await getBodyWeights()).toHaveLength(2);
  });

  it('rejects a weight that is not a positive number', async () => {
    await expect(logBodyWeight(0, at(0, 7))).rejects.toThrow();
    await expect(logBodyWeight(Number.NaN, at(0, 7))).rejects.toThrow();
  });
});

describe('getBodyWeights', () => {
  it('returns readings oldest first', async () => {
    await logBodyWeight(200, at(2, 7));
    await logBodyWeight(202, at(0, 7));
    await logBodyWeight(201, at(1, 7));
    expect((await getBodyWeights()).map((w) => w.weightLbs)).toEqual([202, 201, 200]);
  });
});

describe('deleteBodyWeight', () => {
  it('removes one reading', async () => {
    const id = await logBodyWeight(200, at(0, 7));
    await logBodyWeight(201, at(1, 7));
    await deleteBodyWeight(id);
    expect((await getBodyWeights()).map((w) => w.weightLbs)).toEqual([201]);
  });
});

describe('body weight table', () => {
  it('survives the schema upgrade alongside the existing tables', async () => {
    await logBodyWeight(200, at(0, 7));
    expect(await db.bodyWeights.count()).toBe(1);
  });
});
