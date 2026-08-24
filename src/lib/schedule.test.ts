import { describe, expect, it } from 'vitest';
import { isScheduledToday, scheduleLabel } from './schedule';

// 2026-08-24 is a Monday.
const monday = new Date(2026, 7, 24, 9).getTime();
const thursday = new Date(2026, 7, 27, 9).getTime();

describe('isScheduledToday', () => {
  it('matches the local weekday', () => {
    expect(isScheduledToday([1, 4], monday)).toBe(true);
    expect(isScheduledToday([1, 4], thursday)).toBe(true);
    expect(isScheduledToday([2], monday)).toBe(false);
  });

  it('treats an unscheduled routine as never today, not always', () => {
    expect(isScheduledToday(undefined, monday)).toBe(false);
    expect(isScheduledToday([], monday)).toBe(false);
  });
});

describe('scheduleLabel', () => {
  it('says nothing when nothing is scheduled', () => {
    expect(scheduleLabel(undefined)).toBe('');
    expect(scheduleLabel([])).toBe('');
  });

  it('names a single day', () => {
    expect(scheduleLabel([1])).toBe('Mon');
  });

  it('joins two days with an ampersand and more with commas', () => {
    expect(scheduleLabel([1, 4])).toBe('Mon & Thu');
    expect(scheduleLabel([1, 3, 5])).toBe('Mon, Wed & Fri');
  });

  it('reads in week order however the days were stored', () => {
    expect(scheduleLabel([5, 1, 3])).toBe('Mon, Wed & Fri');
  });

  it('collapses a full week', () => {
    expect(scheduleLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
  });
});
