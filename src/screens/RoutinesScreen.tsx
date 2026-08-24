import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise } from '../db/db';
import { createRoutine, deleteExercise, deleteRoutine, updateExercise } from '../db/mutations';
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
            <Link to={`/routines/${r.id}`}><strong>{r.name}</strong></Link>
            <ConfirmButton
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
      <h1>Exercise library</h1>
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

  async function save() {
    const trimmed = name.trim();
    const restNum = Number(rest);
    if (!trimmed || !Number.isFinite(restNum) || restNum < 0) return;
    try {
      await updateExercise(exercise.id!, { name: trimmed, defaultRestSeconds: restNum });
    } catch {
      toast("Couldn't save exercise");
    }
  }

  return (
    <div className="card">
      <div className="row spread">
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={save} />
        <ConfirmButton
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
      </div>
    </div>
  );
}
