import { describe, expect, it } from 'vitest';
import { buildWeightSeries, describeTrend, weightTrend } from './bodyWeight';

const day = (n: number) => new Date(2026, 0, 1 + n).getTime();

describe('buildWeightSeries', () => {
  it('orders entries oldest first, whatever order they arrive in', () => {
    const series = buildWeightSeries(
      [
        { at: day(2), weightLbs: 198 },
        { at: day(0), weightLbs: 200 },
        { at: day(1), weightLbs: 202 },
      ],
      7,
    );
    expect(series.map((p) => p.weightLbs)).toEqual([200, 202, 198]);
  });

  it('averages over the trailing window', () => {
    const series = buildWeightSeries(
      [
        { at: day(0), weightLbs: 200 },
        { at: day(1), weightLbs: 202 },
        { at: day(2), weightLbs: 198 },
      ],
      7,
    );
    expect(series.map((p) => p.average)).toEqual([200, 201, 200]);
  });

  it('drops readings that fall outside the window', () => {
    const series = buildWeightSeries(
      [
        { at: day(0), weightLbs: 200 },
        { at: day(1), weightLbs: 210 },
        { at: day(2), weightLbs: 220 },
      ],
      2,
    );
    expect(series.map((p) => p.average)).toEqual([200, 205, 215]);
  });

  it('handles an empty log', () => {
    expect(buildWeightSeries([], 7)).toEqual([]);
  });
});

describe('weightTrend', () => {
  it('needs two readings to say anything', () => {
    expect(weightTrend([], day(0), 30)).toBeNull();
    expect(weightTrend([{ at: day(0), weightLbs: 200 }], day(0), 30)).toBeNull();
  });

  it('compares smoothed endpoints, not raw readings', () => {
    const trend = weightTrend(
      [
        { at: day(0), weightLbs: 200 },
        { at: day(5), weightLbs: 195 },
      ],
      day(5),
      30,
    );
    // The day-5 average still carries day 0, so the drop reads smaller than
    // the raw 5 lb — which is the point of smoothing a noisy signal.
    expect(trend).toEqual({ changeLbs: -2.5, days: 5 });
  });

  it('reports the span it actually covered, not the one asked for', () => {
    const trend = weightTrend(
      [
        { at: day(50), weightLbs: 210 },
        { at: day(60), weightLbs: 210 },
      ],
      day(60),
      30,
    );
    expect(trend?.days).toBe(10);
  });

  it('ignores readings older than the requested window', () => {
    const trend = weightTrend(
      [
        { at: day(0), weightLbs: 300 },
        { at: day(90), weightLbs: 200 },
        { at: day(100), weightLbs: 200 },
      ],
      day(100),
      30,
    );
    expect(trend).toEqual({ changeLbs: 0, days: 10 });
  });
});

describe('describeTrend', () => {
  it('says which way the average moved', () => {
    expect(describeTrend({ changeLbs: -2.44, days: 30 })).toBe('down 2.4 lb over 30 days');
    expect(describeTrend({ changeLbs: 1.2, days: 14 })).toBe('up 1.2 lb over 14 days');
  });

  it('calls a change too small to round "steady"', () => {
    expect(describeTrend({ changeLbs: 0.04, days: 30 })).toBe('steady over 30 days');
  });

  it('does not pluralize a single day', () => {
    expect(describeTrend({ changeLbs: -1, days: 1 })).toBe('down 1 lb over 1 day');
  });
});
