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
  return (
    <span className="value" aria-label={effort === '' ? formatSet(set, type) : `${formatSet(set, type)}, ${effort}`}>
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
    return (
      <>
        {set.weightLbs !== undefined && (
          <>
            +{set.weightLbs}
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
