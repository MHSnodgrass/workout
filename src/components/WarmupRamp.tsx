import { useState } from 'react';
import { formatPlates, platesPerSide } from '../lib/plates';
import { round1 } from '../lib/format';
import { warmupRamp } from '../lib/warmup';

/**
 * The ramp up to today's working weight — guidance, never logged.
 *
 * Warm-ups in the history would inflate volume, hand the records screen fake
 * PRs, and drag `suggestNext`'s working weight down below what was trained.
 * Collapsed by default because on most sets you already know the ramp; it is
 * the first heavy lift of the day where you want it spelled out.
 */
export default function WarmupRamp({
  workingLbs,
  barLbs,
  plates,
}: {
  workingLbs: number;
  barLbs: number;
  plates: number[];
}) {
  const [open, setOpen] = useState(false);
  const ramp = warmupRamp(workingLbs, barLbs, plates);
  if (ramp.length === 0) return null;

  return (
    <div className="warmup">
      <button className="small warmup-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide warm-up' : `Warm-up to ${round1(workingLbs)} lb`}
      </button>
      {open &&
        ramp.map((step) => {
          const load = platesPerSide(step.weightLbs, barLbs, plates);
          return (
            <div className="set-line" key={step.weightLbs}>
              <span className="set-index">×{step.reps}</span>
              <span className="value">
                {round1(step.weightLbs)}
                <span className="unit">lb</span>
              </span>
              <span className="small">{load ? formatPlates(load.perSide) : ''}</span>
            </div>
          );
        })}
      {open && <p className="small">Not logged — warm-ups would skew your records.</p>}
    </div>
  );
}
