/**
 * What to actually put on the bar.
 *
 * The app already tells you to load 155 lb; this is the arithmetic you would
 * otherwise be doing in your head between sets.
 *
 * All of it runs on quarter-pounds as integers. Plate maths is relentlessly
 * fractional — 2.5s and 1.25s — and repeated floating-point subtraction turns
 * an exact load into 9.999999999999998, which then reads as "short by 0" or
 * silently drops a plate.
 */

export const DEFAULT_BAR_LBS = 45;
export const DEFAULT_PLATES = [45, 35, 25, 10, 5, 2.5];

const SCALE = 4; // quarter-pounds
const q = (lbs: number): number => Math.round(lbs * SCALE);
const lbs = (units: number): number => units / SCALE;

export interface PlateLoad {
  /** One entry per plate that goes on each side, heaviest first. */
  perSide: number[];
  /** What the bar ends up weighing. */
  achieved: number;
  /** How far short of the target that is — 0 when it lands exactly. */
  short: number;
}

function usable(available: number[]): number[] {
  return [...new Set(available.filter((p) => p > 0))].sort((a, b) => b - a);
}

/** null when the target is lighter than the bar — nothing to take off. */
export function platesPerSide(
  targetLbs: number,
  barLbs: number,
  available: number[],
): PlateLoad | null {
  if (!Number.isFinite(targetLbs) || targetLbs < barLbs) return null;

  // Halved before anything else: everything from here is one side of the bar.
  let remaining = Math.floor((q(targetLbs) - q(barLbs)) / 2);
  const perSide: number[] = [];
  for (const plate of usable(available)) {
    const size = q(plate);
    while (remaining >= size) {
      perSide.push(plate);
      remaining -= size;
    }
  }

  const loaded = perSide.reduce((sum, p) => sum + q(p), 0);
  const achieved = lbs(q(barLbs) + loaded * 2);
  return { perSide, achieved, short: lbs(q(targetLbs) - q(achieved)) };
}

/**
 * The nearest weight at or below `weightLbs` that the bar can actually hold.
 * The step is two of the smallest plate, because plates go on in pairs.
 */
export function snapToLoadable(weightLbs: number, barLbs: number, available: number[]): number {
  const plates = usable(available);
  if (plates.length === 0 || weightLbs <= barLbs) return barLbs;
  const step = q(plates[plates.length - 1]) * 2;
  const over = q(weightLbs) - q(barLbs);
  return lbs(q(barLbs) + Math.floor(over / step) * step);
}

/** "2 × 45, 25" — the way you'd say it standing at the rack. */
export function formatPlates(perSide: number[]): string {
  if (perSide.length === 0) return 'just the bar';
  const runs: { plate: number; count: number }[] = [];
  for (const plate of perSide) {
    const last = runs[runs.length - 1];
    if (last && last.plate === plate) last.count += 1;
    else runs.push({ plate, count: 1 });
  }
  return runs
    .map(({ plate, count }) => (count > 1 ? `${count} × ${plate}` : String(plate)))
    .join(', ');
}
