/**
 * Reps in reserve — how many more reps were left at the end of a set.
 *
 * Deliberately independent of the progression math in `progression.ts`: effort
 * is context for reading your own history, not an input to the weight the app
 * suggests.
 */

export const MAX_RIR = 10;

export type RirParse = { ok: true; value: number | undefined } | { ok: false; error: string };

export function parseRir(input: string): RirParse {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: true, value: undefined };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { ok: false, error: 'RIR must be a number' };
  if (!Number.isInteger(n)) return { ok: false, error: 'RIR must be a whole number' };
  if (n < 0 || n > MAX_RIR) return { ok: false, error: `RIR must be 0–${MAX_RIR}` };
  return { ok: true, value: n };
}

/**
 * Bare label, no separator: the caller owns how it joins on, because "@" —
 * the usual shorthand — already means weight in a timed set (`60s @ 50 lb`).
 */
export function formatRir(rir: number | undefined): string {
  // Not a falsy check: 0 RIR — nothing left in the tank — is the most
  // interesting value there is.
  return rir === undefined ? '' : `${rir} RIR`;
}
