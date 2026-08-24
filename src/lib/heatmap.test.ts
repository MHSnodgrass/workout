import { describe, expect, it } from 'vitest';
import { buildHeatmap, monthLabels, WEEKS_SHOWN } from './heatmap';

/** Local midnight, so tests read in the same calendar the app renders in. */
const day = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).getTime();

// A Monday, so "the week containing today" is unambiguous in assertions.
const TODAY = day(2026, 7, 24);

const set = (loggedAt: number, sessionId = 1) => ({ loggedAt, sessionId });

describe('buildHeatmap — grid shape', () => {
  it('covers a year of complete weeks', () => {
    const { weeks } = buildHeatmap([], TODAY);

    expect(weeks).toHaveLength(WEEKS_SHOWN);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('starts each week on Sunday and ends on the Saturday of this week', () => {
    const { weeks } = buildHeatmap([], TODAY);
    const first = weeks[0][0];
    const last = weeks[WEEKS_SHOWN - 1][6];

    expect(new Date(first.date).getDay()).toBe(0);
    expect(new Date(last.date).getDay()).toBe(6);
    // Today (a Monday) sits in the final column.
    expect(weeks[WEEKS_SHOWN - 1].some((d) => d.date === day(2026, 7, 24, 0))).toBe(true);
  });

  it('reports every day as empty when nothing was logged', () => {
    const { weeks, totalSets, workouts, activeDays } = buildHeatmap([], TODAY);

    expect(weeks.flat().every((d) => d.count === 0 && d.level === 0)).toBe(true);
    expect([totalSets, workouts, activeDays]).toEqual([0, 0, 0]);
  });
});

describe('buildHeatmap — counting', () => {
  it('counts sets on the local day they were logged', () => {
    const { weeks } = buildHeatmap([set(TODAY), set(TODAY), set(day(2026, 7, 23))], TODAY);
    const byDate = new Map(weeks.flat().map((d) => [d.date, d.count]));

    expect(byDate.get(day(2026, 7, 24, 0))).toBe(2);
    expect(byDate.get(day(2026, 7, 23, 0))).toBe(1);
  });

  it('keeps a late-evening set on that evening, not the next UTC day', () => {
    const lateNight = day(2026, 7, 24, 23);
    const { weeks } = buildHeatmap([set(lateNight)], TODAY);
    const byDate = new Map(weeks.flat().map((d) => [d.date, d.count]));

    expect(byDate.get(day(2026, 7, 24, 0))).toBe(1);
  });

  it('ignores sets older than the window', () => {
    const longAgo = day(2024, 0, 1);

    expect(buildHeatmap([set(longAgo)], TODAY).totalSets).toBe(0);
  });

  it('counts distinct sessions as workouts', () => {
    const sets = [
      set(TODAY, 1),
      set(TODAY, 1),
      set(day(2026, 7, 22), 2),
      set(day(2026, 7, 20), 3),
      set(day(2026, 7, 20), 3),
    ];

    const { totalSets, workouts, activeDays } = buildHeatmap(sets, TODAY);

    expect({ totalSets, workouts, activeDays }).toEqual({
      totalSets: 5,
      workouts: 3,
      activeDays: 3,
    });
  });
});

describe('buildHeatmap — shading', () => {
  function levelsFor(counts: number[]): number[] {
    const sets = counts.flatMap((count, i) =>
      Array.from({ length: count }, () => set(day(2026, 7, 24 - i), i + 1)),
    );
    const byDate = new Map(buildHeatmap(sets, TODAY).weeks.flat().map((d) => [d.date, d.level]));
    return counts.map((_, i) => byDate.get(day(2026, 7, 24 - i, 0))!);
  }

  it('shades relative to the busiest day', () => {
    // Max is 20: 4 -> 20%, 10 -> 50%, 15 -> 75%, 20 -> 100%.
    expect(levelsFor([20, 15, 10, 4])).toEqual([4, 3, 2, 1]);
  });

  it('treats a uniform year as uniformly busy rather than uniformly idle', () => {
    expect(levelsFor([5, 5, 5])).toEqual([4, 4, 4]);
  });

  it('does not let one huge day erase the rest', () => {
    const levels = levelsFor([100, 8, 8]);

    expect(levels[0]).toBe(4);
    expect(levels.slice(1).every((l) => l >= 1)).toBe(true);
  });

  it('never gives a logged day level 0', () => {
    expect(levelsFor([50, 1])[1]).toBeGreaterThan(0);
  });
});

describe('monthLabels', () => {
  it('labels the first week of each month', () => {
    const { weeks } = buildHeatmap([], TODAY);
    const labels = monthLabels(weeks);

    // A year of weeks spans 12 or 13 month boundaries.
    expect(labels.length).toBeGreaterThanOrEqual(12);
    expect(labels.length).toBeLessThanOrEqual(13);
  });

  it('places each label on the column where that month starts', () => {
    const { weeks } = buildHeatmap([], TODAY);

    for (const { weekIndex, label } of monthLabels(weeks)) {
      const monthOfWeek = new Date(weeks[weekIndex][0].date).toLocaleDateString(undefined, {
        month: 'short',
      });
      expect(label).toBe(monthOfWeek);
    }
  });

  it('never labels the same month twice in a row', () => {
    const labels = monthLabels(buildHeatmap([], TODAY).weeks).map((l) => l.label);

    expect(labels.every((l, i) => i === 0 || l !== labels[i - 1])).toBe(true);
  });
});
