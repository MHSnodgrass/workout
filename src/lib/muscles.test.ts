import { describe, expect, it } from 'vitest';
import { MUSCLE_GROUPS, muscleCoverage } from './muscles';

const now = new Date(2026, 7, 24, 18).getTime(); // Monday evening
const daysAgo = (n: number, hour = 9) => new Date(2026, 7, 24 - n, hour).getTime();

const countFor = (coverage: ReturnType<typeof muscleCoverage>, group: string) =>
  coverage.counts.find((c) => c.group === group)?.sets ?? -1;

describe('muscleCoverage', () => {
  it('credits a set to every group the exercise is tagged with', () => {
    const c = muscleCoverage(
      [{ exerciseId: 1, loggedAt: daysAgo(1) }],
      new Map([[1, ['Chest', 'Triceps']]]),
      now,
    );
    expect(countFor(c, 'Chest')).toBe(1);
    expect(countFor(c, 'Triceps')).toBe(1);
  });

  it('lists every group, including the ones that got nothing', () => {
    const c = muscleCoverage([], new Map(), now);
    expect(c.counts).toHaveLength(MUSCLE_GROUPS.length);
    expect(c.counts.every((x) => x.sets === 0)).toBe(true);
  });

  it('ignores sets older than the window', () => {
    const c = muscleCoverage(
      [
        { exerciseId: 1, loggedAt: daysAgo(2) },
        { exerciseId: 1, loggedAt: daysAgo(30) },
      ],
      new Map([[1, ['Back']]]),
      now,
      7,
    );
    expect(countFor(c, 'Back')).toBe(1);
  });

  it('includes today and the six days before it', () => {
    const c = muscleCoverage(
      [
        { exerciseId: 1, loggedAt: daysAgo(0) },
        { exerciseId: 1, loggedAt: daysAgo(6) },
        { exerciseId: 1, loggedAt: daysAgo(7) },
      ],
      new Map([[1, ['Core']]]),
      now,
      7,
    );
    expect(countFor(c, 'Core')).toBe(2);
  });

  it('counts sets from untagged exercises separately rather than dropping them', () => {
    const c = muscleCoverage(
      [
        { exerciseId: 1, loggedAt: daysAgo(1) },
        { exerciseId: 2, loggedAt: daysAgo(1) },
        { exerciseId: 3, loggedAt: daysAgo(1) },
      ],
      new Map([[1, ['Chest']]]),
      now,
    );
    expect(c.taggedSets).toBe(1);
    expect(c.untaggedSets).toBe(2);
  });

  it('treats an empty tag list as untagged', () => {
    const c = muscleCoverage(
      [{ exerciseId: 1, loggedAt: daysAgo(1) }],
      new Map([[1, []]]),
      now,
    );
    expect(c.untaggedSets).toBe(1);
  });

  it('orders by volume, falling back to the canonical order for ties', () => {
    const c = muscleCoverage(
      [
        { exerciseId: 1, loggedAt: daysAgo(1) },
        { exerciseId: 1, loggedAt: daysAgo(1) },
        { exerciseId: 2, loggedAt: daysAgo(1) },
        { exerciseId: 3, loggedAt: daysAgo(1) },
      ],
      new Map([
        [1, ['Back']],
        [2, ['Chest']],
        [3, ['Shoulders']],
      ]),
      now,
    );
    expect(c.counts.slice(0, 3).map((x) => x.group)).toEqual(['Back', 'Chest', 'Shoulders']);
  });

  it('ignores tags that are not known groups', () => {
    const c = muscleCoverage(
      [{ exerciseId: 1, loggedAt: daysAgo(1) }],
      new Map([[1, ['Chest', 'Lats']]]),
      now,
    );
    expect(c.counts).toHaveLength(MUSCLE_GROUPS.length);
    expect(countFor(c, 'Chest')).toBe(1);
  });
});
