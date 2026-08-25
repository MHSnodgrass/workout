/**
 * Assisted work — a bodyweight set done with some of your weight taken off.
 *
 * A negative `SetLog.weightLbs` on a bodyweight exercise means assistance, so
 * assisted, unassisted and weighted reps of the same movement stay one
 * exercise on one scale: −40 → 0 → +25. Nothing else in the schema changes.
 *
 * The sign lives on a toggle rather than in the number field, because the
 * phone keypad `inputMode="decimal"` raises has no minus key — there was
 * literally no way to type one. Everything here is the pure half of that
 * arrangement; the logging screen only wires it up.
 */

import type { ExerciseType } from '../db/db';

/** Which way the toggle is pointing: added weight, or assistance. */
export type Sign = 1 | -1;

export type LoadParse = { ok: true; value: number | undefined } | { ok: false; error: string };

/** Split what the field holds from what the toggle holds, for prefilling a row. */
export function splitSign(weightLbs: number | undefined): { sign: Sign; magnitude: string } {
  if (weightLbs === undefined) return { sign: 1, magnitude: '' };
  return { sign: weightLbs < 0 ? -1 : 1, magnitude: String(Math.abs(weightLbs)) };
}

/**
 * What a row becomes when its weight field changes. On a bodyweight exercise a
 * minus typed on a real keyboard flips the toggle instead of living in the
 * field, so the two can't disagree about the sign and multiply into a positive.
 *
 * Everywhere else there is no toggle to move it to, and quietly swallowing the
 * minus would leave the field reading 135 while the set refuses to log. The
 * character stays put and `parseLoad` explains the refusal against what the
 * user can actually see.
 */
export function acceptLoadInput(
  raw: string,
  sign: Sign,
  type: ExerciseType,
): { magnitude: string; sign: Sign } {
  if (type !== 'bodyweight') return { magnitude: raw, sign: 1 };
  const minus = raw.startsWith('-');
  return { magnitude: minus ? raw.slice(1) : raw, sign: minus ? ((-sign) as Sign) : sign };
}

/** Recombine the field and the toggle into the weight to store. */
export function parseLoad(magnitude: string, sign: Sign, type: ExerciseType): LoadParse {
  const trimmed = magnitude.trim();
  if (trimmed === '') {
    return type === 'weighted' ? { ok: false, error: 'Enter a weight' } : { ok: true, value: undefined };
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { ok: false, error: 'Weight must be a number' };
  const signed = n * sign;
  if (signed < 0 && type !== 'bodyweight') {
    return { ok: false, error: 'Only bodyweight exercises can be assisted' };
  }
  // 0 * -1 is -0, which survives arithmetic but prints as "-0" wherever it
  // reaches the screen.
  return { ok: true, value: signed === 0 ? 0 : signed };
}
