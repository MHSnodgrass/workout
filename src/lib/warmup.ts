/**
 * The ramp up to today's working weight.
 *
 * Guidance only — these are never logged. Warm-up sets in the history would
 * inflate volume, hand `metrics.ts` fake PRs to beat, and feed `suggestNext` a
 * working weight far below what was actually trained.
 *
 * The percentages are the ordinary ones and are of the working weight, not of
 * the load above the bar: at 225 the ramp is roughly 55/70/85%. Every step is
 * snapped down to something the rack can actually build, so nothing ever says
 * 85.25 lb.
 */

import { snapToLoadable } from './plates';

export interface WarmupSet {
  weightLbs: number;
  reps: number;
}

const STEPS: { fraction: number; reps: number }[] = [
  { fraction: 0.55, reps: 5 },
  { fraction: 0.7, reps: 3 },
  { fraction: 0.85, reps: 2 },
];

const BAR_REPS = 5;

export function warmupRamp(
  workingLbs: number,
  barLbs: number,
  available: number[],
): WarmupSet[] {
  // Nothing to ramp through: the working set *is* the bar.
  if (!Number.isFinite(workingLbs) || workingLbs <= barLbs) return [];

  const ramp: WarmupSet[] = [{ weightLbs: barLbs, reps: BAR_REPS }];
  for (const { fraction, reps } of STEPS) {
    const weightLbs = snapToLoadable(workingLbs * fraction, barLbs, available);
    // Skip anything that isn't a real step up — a light working weight puts
    // several percentages under the bar, and they all collapse into it.
    if (weightLbs <= ramp[ramp.length - 1].weightLbs) continue;
    if (weightLbs >= workingLbs) continue;
    ramp.push({ weightLbs, reps });
  }
  return ramp;
}
