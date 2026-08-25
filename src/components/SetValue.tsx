import type { ExerciseType, SetLog } from '../db/db';
import { formatRir } from '../lib/effort';
import { formatSet } from '../lib/format';

/**
 * A logged set, typeset rather than stringified.
 *
 * `formatSet` still produces the flat text for sentences and accessible names;
 * this renders the same value in parts so the numbers can carry the weight and
 * the units stay out of their way.
 */
export default function SetValue({ set, type }: { set: SetLog; type: ExerciseType }) {
  const effort = formatRir(set.rir);
  const label = assistLabel(set, type) ?? formatSet(set, type);
  return (
    <span className="value" aria-label={effort === '' ? label : `${label}, ${effort}`}>
      {parts(set, type)}
      {effort !== '' && <span className="rir">{effort}</span>}
    </span>
  );
}

function parts(set: SetLog, type: ExerciseType) {
  if (type === 'timed') {
    return (
      <>
        {set.durationSeconds ?? 0}
        <span className="unit">s</span>
        {set.weightLbs !== undefined && (
          <>
            <span className="op">@</span>
            {set.weightLbs}
            <span className="unit">lb</span>
          </>
        )}
      </>
    );
  }
  if (type === 'bodyweight') {
    const w = set.weightLbs;
    return (
      <>
        {w !== undefined && w !== 0 && (
          <>
            {w < 0 ? '−' : '+'}
            {Math.abs(w)}
            <span className="unit">lb</span>
            <span className="op">×</span>
          </>
        )}
        {set.reps ?? 0}
        <span className="unit">reps</span>
      </>
    );
  }
  return (
    <>
      {set.weightLbs ?? 0}
      <span className="unit">lb</span>
      <span className="op">×</span>
      {set.reps ?? 0}
    </>
  );
}

/**
 * "−40×6" is the right thing to see and the wrong thing to hear: a screen
 * reader announces the minus without saying what was taken off. Assisted sets
 * get the word instead. See lib/assist.ts.
 */
function assistLabel(set: SetLog, type: ExerciseType): string | null {
  if (type !== 'bodyweight' || set.weightLbs === undefined || set.weightLbs >= 0) return null;
  return `${Math.abs(set.weightLbs)} lb assist, ${set.reps ?? 0} reps`;
}
