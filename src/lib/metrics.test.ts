import { describe, expect, it } from 'vitest';
import type { SessionSets } from '../db/queries';
import {
  availableMetricsFor,
  bestE1RM,
  bestOccurrence,
  buildSeries,
  defaultMetricFor,
  epley1RM,
  maxDuration,
  metricValue,
  topWeight,
  totalReps,
  totalVolume,
} from './metrics';

function sets(...rows: Array<[number | undefined, number | undefined, number | undefined]>) {
  return rows.map(([weightLbs, reps, durationSeconds], i) => ({
    sessionId: 1,
    exerciseId: 1,
    setNumber: i + 1,
    weightLbs,
    reps,
    durationSeconds,
    loggedAt: i,
  }));
}

describe('epley1RM', () => {
  it('returns the weight itself for a single', () => {
    expect(epley1RM(225, 1)).toBe(225);
  });
  it('computes weight * (1 + reps/30)', () => {
    expect(epley1RM(135, 10)).toBeCloseTo(180);
  });
});

describe('per-session metrics', () => {
  const s = sets([135, 10, undefined], [155, 5, undefined], [undefined, 12, undefined]);
  it('bestE1RM ignores sets without weight or reps', () => {
    expect(bestE1RM(s)).toBeCloseTo(epley1RM(155, 5));
  });
  it('topWeight / totalVolume / totalReps', () => {
    expect(topWeight(s)).toBe(155);
    expect(totalVolume(s)).toBe(135 * 10 + 155 * 5);
    expect(totalReps(s)).toBe(27);
  });
  it('maxDuration', () => {
    expect(maxDuration(sets([50, undefined, 60], [50, undefined, 90]))).toBe(90);
  });
  it('metricValue dispatches', () => {
    expect(metricValue('topWeight', s)).toBe(155);
  });
});

describe('defaults', () => {
  it('picks default and available metrics per type', () => {
    expect(defaultMetricFor('weighted')).toBe('e1rm');
    expect(defaultMetricFor('bodyweight')).toBe('totalReps');
    expect(defaultMetricFor('timed')).toBe('maxDuration');
    expect(availableMetricsFor('weighted')).toEqual(['e1rm', 'topWeight', 'volume']);
  });
});

describe('buildSeries', () => {
  it('sorts ascending and flags strictly-new bests as PRs', () => {
    const history: SessionSets[] = [
      {
        session: { id: 2, routineId: 1, startedAt: 2000, finishedAt: 2500 },
        sets: sets([105, 5, undefined]),
      },
      {
        session: { id: 1, routineId: 1, startedAt: 1000, finishedAt: 1500 },
        sets: sets([100, 5, undefined]),
      },
      {
        session: { id: 3, routineId: 1, startedAt: 3000, finishedAt: 3500 },
        sets: sets([105, 5, undefined]),
      },
    ];
    const series = buildSeries(history, 'topWeight');
    expect(series.map((p) => p.sessionId)).toEqual([1, 2, 3]);
    expect(series.map((p) => p.isPR)).toEqual([true, true, false]);
  });
});

describe('bestOccurrence', () => {
  function session(id: number, startedAt: number, rows: Array<[number, number]>): SessionSets {
    return {
      session: { id, routineId: 1, startedAt, finishedAt: startedAt + 3600 },
      sets: rows.map(([weightLbs, reps], i) => ({
        id: id * 100 + i,
        sessionId: id,
        exerciseId: 1,
        setNumber: i + 1,
        weightLbs,
        reps,
        loggedAt: startedAt,
      })),
    };
  }

  const history: SessionSets[] = [
    session(1, 1_000, [
      [135, 10],
      [135, 10],
    ]),
    session(2, 2_000, [
      [185, 5],
      [155, 8],
    ]),
  ];

  it('names the set behind a set-level record', () => {
    const best = bestOccurrence('topWeight', history);

    expect(best?.value).toBe(185);
    expect(best?.set?.weightLbs).toBe(185);
    expect(best?.session.id).toBe(2);
  });

  it('names the set behind the best estimated 1RM', () => {
    const best = bestOccurrence('e1rm', history);

    expect(best?.set).toEqual(expect.objectContaining({ weightLbs: 185, reps: 5 }));
  });

  it('names only the session for a session-level record', () => {
    const best = bestOccurrence('volume', history);

    // Session 2 totals 185*5 + 155*8 = 2165, beating session 1's 2700? No:
    // session 1 is 135*10 + 135*10 = 2700, so session 1 holds the record.
    expect(best?.value).toBe(2700);
    expect(best?.session.id).toBe(1);
    expect(best?.set).toBeUndefined();
  });

  it('credits the earliest session when a record is tied', () => {
    const tied = [session(1, 1_000, [[200, 3]]), session(2, 2_000, [[200, 3]])];

    expect(bestOccurrence('topWeight', tied)?.session.id).toBe(1);
  });

  it('returns nothing when there is no history', () => {
    expect(bestOccurrence('e1rm', [])).toBeNull();
  });

  it('returns nothing when no set carries the metric', () => {
    const durationless = [session(1, 1_000, [[135, 10]])];

    expect(bestOccurrence('maxDuration', durationless)).toBeNull();
  });
});
