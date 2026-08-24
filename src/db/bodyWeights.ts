import { db } from './db';
import type { BodyWeight } from './db';
import { localMidnight } from '../lib/dates';

export class InvalidWeightError extends Error {
  constructor() {
    super('Enter a weight');
  }
}

export async function getBodyWeights(): Promise<BodyWeight[]> {
  return db.bodyWeights.orderBy('at').toArray();
}

/**
 * Records today's weight, replacing any earlier reading from the same local
 * day. Weighing twice shouldn't put a spike in the chart, and it makes the
 * log button safe to press again.
 */
export async function logBodyWeight(weightLbs: number, at: number = Date.now()): Promise<number> {
  if (!Number.isFinite(weightLbs) || weightLbs <= 0) throw new InvalidWeightError();
  return db.transaction('rw', db.bodyWeights, async () => {
    const day = localMidnight(at);
    const existing = await db.bodyWeights.filter((w) => localMidnight(w.at) === day).first();
    if (existing) {
      await db.bodyWeights.update(existing.id!, { at, weightLbs });
      return existing.id!;
    }
    return db.bodyWeights.add({ at, weightLbs });
  });
}

export async function deleteBodyWeight(id: number): Promise<void> {
  await db.bodyWeights.delete(id);
}
