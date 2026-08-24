import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise } from '../db/db';
import {
  createRoutine,
  deleteExercise,
  deleteRoutine,
  setExerciseBar,
  updateExercise,
} from '../db/mutations';
import { getSetting } from '../db/settings';
import { MUSCLE_GROUPS } from '../lib/muscles';
import { DEFAULT_BAR_LBS } from '../lib/plates';
import ConfirmButton from '../components/ConfirmButton';
import { useToast } from '../components/Toast';

export default function RoutinesScreen() {
  const toast = useToast();
  const routines = useLiveQuery(() => db.routines.filter((r) => r.archived === 0).toArray(), []);
  const exercises = useLiveQuery(() => db.exercises.filter((e) => e.archived === 0).toArray(), []);
  const [newName, setNewName] = useState('');

  async function create() {
    const name = newName.trim();
    if (!name) return;
    try {
      await createRoutine(name);
      setNewName('');
    } catch {
      toast("Couldn't create routine");
    }
  }

  return (
    <div className="screen">
      <h1>Routines</h1>
      <div className="row">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New routine name"
        />
        <button className="primary" onClick={create}>Add</button>
      </div>
      <div style={{ marginTop: 12 }}>
        {routines?.map((r) => (
          <div className="card row spread" key={r.id}>
            <Link to={`/routines/${r.id}`} className="routine-name">{r.name}</Link>
            <ConfirmButton
              labelText="Delete routine"
              onConfirm={async () => {
                try {
                  const result = await deleteRoutine(r.id!);
                  toast(result === 'archived' ? 'Routine archived (has history)' : 'Routine deleted');
                } catch {
                  toast("Couldn't delete routine");
                }
              }}
            />
          </div>
        ))}
        {routines?.length === 0 && <p className="muted">No routines yet — add one above.</p>}
      </div>
      <h2 className="section">Exercise library</h2>
      {exercises?.map((e) => <ExerciseLibRow key={e.id} exercise={e} />)}
      {exercises?.length === 0 && (
        <p className="muted">Exercises appear here once you add them to a routine.</p>
      )}
    </div>
  );
}

function ExerciseLibRow({ exercise }: { exercise: Exercise }) {
  const toast = useToast();
  const [name, setName] = useState(exercise.name);
  const [rest, setRest] = useState(String(exercise.defaultRestSeconds));
  const [increment, setIncrement] = useState(
    exercise.incrementLbs === undefined ? '' : String(exercise.incrementLbs),
  );

  async function save() {
    const trimmed = name.trim();
    const restNum = Number(rest);
    if (!trimmed || !Number.isFinite(restNum) || restNum < 0) return;
    // Blank means "use the global default", which is a real choice — not zero.
    const incrementNum = increment.trim() === '' ? undefined : Number(increment);
    if (incrementNum !== undefined && (!Number.isFinite(incrementNum) || incrementNum <= 0)) return;
    try {
      await updateExercise(exercise.id!, {
        name: trimmed,
        defaultRestSeconds: restNum,
        incrementLbs: incrementNum,
      });
    } catch {
      toast("Couldn't save exercise");
    }
  }

  return (
    <div className="card">
      <div className="row spread">
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={save} />
        <ConfirmButton
          labelText="Delete exercise"
          onConfirm={async () => {
            try {
              const result = await deleteExercise(exercise.id!);
              toast(result === 'archived' ? 'Exercise archived (has history)' : 'Exercise deleted');
            } catch {
              toast("Couldn't delete exercise");
            }
          }}
        />
      </div>
      <div className="row small" style={{ marginTop: 8 }}>
        <span>{exercise.type}</span>
        <span>· rest</span>
        <input type="number" value={rest} onChange={(e) => setRest(e.target.value)} onBlur={save} />
        <span>s</span>
        {exercise.type === 'weighted' && (
          <>
            <span>· +</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="5"
              aria-label="Weight added by progression suggestions"
              value={increment}
              onChange={(e) => setIncrement(e.target.value)}
              onBlur={save}
            />
            <span>lb</span>
          </>
        )}
      </div>
      {exercise.type === 'weighted' && <BarSetting exercise={exercise} />}
      <MuscleTags exercise={exercise} />
    </div>
  );
}

/**
 * Whether this lift loads onto a bar, and which bar. Absent is the default and
 * means no plate breakdown — that is the honest answer for dumbbells, cables
 * and machines, where a "per side" figure would be meaningless.
 */
function BarSetting({ exercise }: { exercise: Exercise }) {
  const toast = useToast();
  const defaultBar = useLiveQuery(() => getSetting<number>('barWeightLbs', DEFAULT_BAR_LBS), []);
  const isBarbell = exercise.barLbs !== undefined;

  async function save(barLbs: number | null) {
    try {
      await setExerciseBar(exercise.id!, barLbs);
    } catch {
      toast("Couldn't save bar weight");
    }
  }

  return (
    <div className="row small" style={{ marginTop: 8 }}>
      <label className="row">
        <input
          type="checkbox"
          checked={isBarbell}
          onChange={(e) => void save(e.target.checked ? (defaultBar ?? DEFAULT_BAR_LBS) : null)}
        />
        <span>Barbell</span>
      </label>
      {isBarbell && (
        <>
          <input
            type="number"
            inputMode="decimal"
            aria-label="Bar weight in pounds"
            value={exercise.barLbs}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) void save(n);
            }}
          />
          <span>lb bar — shows plates and a warm-up ramp</span>
        </>
      )}
    </div>
  );
}

function MuscleTags({ exercise }: { exercise: Exercise }) {
  const toast = useToast();
  const selected = exercise.muscleGroups ?? [];

  async function toggle(group: string) {
    const next = selected.includes(group)
      ? selected.filter((g) => g !== group)
      : [...selected, group];
    try {
      await updateExercise(exercise.id!, { muscleGroups: next });
    } catch {
      toast("Couldn't save muscle groups");
    }
  }

  return (
    <div className="row tag-row" style={{ marginTop: 8 }}>
      {MUSCLE_GROUPS.map((g) => (
        <button
          key={g}
          className={`tag${selected.includes(g) ? ' selected' : ''}`}
          aria-pressed={selected.includes(g)}
          onClick={() => toggle(g)}
        >
          {g}
        </button>
      ))}
    </div>
  );
}
