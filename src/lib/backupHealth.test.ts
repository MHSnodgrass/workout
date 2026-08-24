import { describe, expect, it } from 'vitest';
import { NUDGE_AFTER_SESSIONS, backupNudge, sessionsSinceExport } from './backupHealth';

const day = 86_400_000;
const now = 1_700_000_000_000;

describe('sessionsSinceExport', () => {
  it('counts only what was finished after the last export', () => {
    const finished = [now - 5 * day, now - 3 * day, now - day];
    expect(sessionsSinceExport(finished, now - 4 * day)).toBe(2);
  });

  it('counts everything when nothing has ever been exported', () => {
    expect(sessionsSinceExport([now - day, now], null)).toBe(2);
  });

  it('is zero right after an export', () => {
    expect(sessionsSinceExport([now - day], now)).toBe(0);
  });

  it('is zero with no history at all', () => {
    expect(sessionsSinceExport([], null)).toBe(0);
  });
});

describe('backupNudge', () => {
  it('stays quiet until there is enough at stake', () => {
    // The old rule was time since export, which nagged after a month off —
    // when nothing was at risk — and stayed silent through a hard month.
    expect(backupNudge(0)).toBeNull();
    expect(backupNudge(NUDGE_AFTER_SESSIONS - 1)).toBeNull();
  });

  it('says how much work is unprotected', () => {
    expect(backupNudge(NUDGE_AFTER_SESSIONS)).toBe('10 workouts since your last backup.');
  });

  it('keeps counting past the threshold', () => {
    expect(backupNudge(31)).toBe('31 workouts since your last backup.');
  });

  it('speaks English for exactly one', () => {
    expect(backupNudge(1, 1)).toBe('1 workout since your last backup.');
  });
});
