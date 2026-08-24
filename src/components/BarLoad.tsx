import { formatPlates, platesPerSide } from '../lib/plates';
import { round1 } from '../lib/format';

/**
 * What to put on the bar for the weight currently in the input.
 *
 * Follows what you type rather than what the app suggested, because the number
 * you are about to lift is the one you need broken down. Says nothing at all
 * for an empty or nonsense input — a stale breakdown is worse than none.
 */
export default function BarLoad({
  weightLbs,
  barLbs,
  plates,
}: {
  weightLbs: number;
  barLbs: number;
  plates: number[];
}) {
  if (!Number.isFinite(weightLbs) || weightLbs <= 0) return null;
  const load = platesPerSide(weightLbs, barLbs, plates);

  if (load === null) {
    return <div className="bar-load light">Lighter than the {round1(barLbs)} lb bar</div>;
  }
  return (
    <div className="bar-load">
      <span className="eyebrow">{round1(barLbs)} bar</span>
      <span>{formatPlates(load.perSide)}</span>
      {load.perSide.length > 0 && <span className="eyebrow">a side</span>}
      {/* Never silently rounds: if the rack can't build it, say what it can. */}
      {load.short > 0 && (
        <span className="light">→ {round1(load.achieved)} lb, closest you can load</span>
      )}
    </div>
  );
}
