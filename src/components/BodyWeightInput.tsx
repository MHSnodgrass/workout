import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getBodyWeights, logBodyWeight } from '../db/bodyWeights';
import { localMidnight } from '../lib/dates';
import { round1 } from '../lib/format';
import { useToast } from './Toast';

/**
 * One line, no chart — this sits on Home, which must not pull in Recharts.
 */
export default function BodyWeightInput({ hideHeading = false }: { hideHeading?: boolean }) {
  const toast = useToast();
  const recent = useLiveQuery(async () => {
    const all = await getBodyWeights();
    return all.length > 0 ? all[all.length - 1] : null;
  }, []);
  const [value, setValue] = useState('');

  const loggedToday =
    recent !== null && recent !== undefined && localMidnight(recent.at) === localMidnight(Date.now())
      ? recent
      : null;

  async function log() {
    const n = Number(value.trim());
    if (value.trim() === '' || !Number.isFinite(n) || n <= 0) {
      toast('Enter a weight');
      return;
    }
    try {
      await logBodyWeight(n);
      setValue('');
    } catch {
      toast("Couldn't save weight");
    }
  }

  return (
    <div className="card">
      <div className="row spread">
        {!hideHeading && <strong>Body weight</strong>}
        {loggedToday && <span className="small">Today: {round1(loggedToday.weightLbs)} lb</span>}
      </div>
      <div className="row" style={{ marginTop: hideHeading && !loggedToday ? 0 : 8 }}>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          aria-label="Body weight in pounds"
          placeholder={recent ? String(round1(recent.weightLbs)) : 'lb'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void log();
          }}
        />
        {/* The label says what pressing it does: one reading per day, so a
            second weigh-in replaces the first rather than adding to it. */}
        <button className="primary" onClick={log}>{loggedToday ? 'Update' : 'Log'}</button>
      </div>
    </div>
  );
}
