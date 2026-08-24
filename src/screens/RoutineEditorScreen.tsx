import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise, type ExerciseType, type RoutineExercise } from '../db/db';
import {
  DuplicateExerciseNameError,
  addExerciseToRoutine,
  createExercise,
  moveRoutineExercise,
  removeRoutineExercise,
  renameRoutine,
  updateRoutineExercise,
} from '../db/mutations';
import { getSetting } from '../db/settings';
import { targetLabel } from '../lib/format';
import ConfirmButton from '../components/ConfirmButton';
import { useToast } from '../components/Toast';

export default function RoutineEditorScreen() {
  const { routineId } = useParams();
  const rid = Number(routineId);
  const toast = useToast();
  const routine = useLiveQuery(() => db.routines.get(rid), [rid]);
  const items = useLiveQuery(async () => {
    const res = await db.routineExercises.where('routineId').equals(rid).sortBy('order');
    const exs = await db.exercises.bulkGet(res.map((r) => r.exerciseId));
    return res
      .map((re, i) => ({ re, exercise: exs[i] }))
      .filter((x): x is { re: RoutineExercise; exercise: Exercise } => x.exercise !== undefined);
  }, [rid]);
  const [showPicker, setShowPicker] = useState(false);
  const [name, setName] = useState<string | null>(null);

  if (!routine || !items) return <div className="screen">Loading…</div>;

  return (
    <div className="screen">
      <input
        style={{ fontSize: 22, fontWeight: 600, width: '100%', marginBottom: 12 }}
        value={name ?? routine.name}
        onChange={(e) => setName(e.target.value)}
        onBlur={async () => {
          if (name && name.trim()) {
            try {
              await renameRoutine(rid, name);
            } catch {
              toast("Couldn't rename routine");
            }
          }
          setName(null);
        }}
      />
      {items.map(({ re, exercise }, i) => (
        <RoutineExerciseRow
          key={re.id}
          re={re}
          exercise={exercise}
          isFirst={i === 0}
          isLast={i === items.length - 1}
        />
      ))}
      {showPicker ? (
        <ExercisePicker
          routineId={rid}
          inRoutine={new Set(items.map((x) => x.re.exerciseId))}
          onDone={() => setShowPicker(false)}
        />
      ) : (
        <button className="big" onClick={() => setShowPicker(true)}>+ Add exercise</button>
      )}
    </div>
  );
}

function RoutineExerciseRow({
  re,
  exercise,
  isFirst,
  isLast,
}: {
  re: RoutineExercise;
  exercise: Exercise;
  isFirst: boolean;
  isLast: boolean;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);

  async function move(direction: -1 | 1) {
    try {
      await moveRoutineExercise(re.routineId, re.id!, direction);
    } catch {
      toast("Couldn't reorder");
    }
  }

  return (
    <div className="card">
      <div className="row spread">
        <strong>{exercise.name}</strong>
        <div className="row">
          <button className="small" disabled={isFirst} onClick={() => move(-1)}>▲</button>
          <button className="small" disabled={isLast} onClick={() => move(1)}>▼</button>
          <button className="small" onClick={() => setEditing((v) => !v)}>Edit</button>
          <ConfirmButton
            onConfirm={async () => {
              try {
                await removeRoutineExercise(re.id!);
              } catch {
                toast("Couldn't remove exercise");
              }
            }}
          />
        </div>
      </div>
      <div className="small">{targetLabel(re, exercise.type)}</div>
      {editing && <TargetEditor re={re} type={exercise.type} onSaved={() => setEditing(false)} />}
    </div>
  );
}

function TargetEditor({
  re,
  type,
  onSaved,
}: {
  re: RoutineExercise;
  type: ExerciseType;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [sets, setSets] = useState(String(re.targetSets));
  const [min, setMin] = useState(String(re.targetRepsMin ?? 8));
  const [max, setMax] = useState(String(re.targetRepsMax ?? 12));
  const [dur, setDur] = useState(String(re.targetDurationSeconds ?? 60));

  async function save() {
    const targetSets = Number(sets);
    if (!Number.isInteger(targetSets) || targetSets < 1) {
      toast('Sets must be at least 1');
      return;
    }
    try {
      if (type === 'timed') {
        await updateRoutineExercise(re.id!, { targetSets, targetDurationSeconds: Number(dur) });
      } else {
        await updateRoutineExercise(re.id!, {
          targetSets,
          targetRepsMin: Number(min),
          targetRepsMax: Number(max),
        });
      }
      onSaved();
    } catch {
      toast("Couldn't save targets");
    }
  }

  return (
    <div className="row" style={{ marginTop: 8 }}>
      <input type="number" value={sets} onChange={(e) => setSets(e.target.value)} />
      <span>sets ×</span>
      {type === 'timed' ? (
        <>
          <input type="number" value={dur} onChange={(e) => setDur(e.target.value)} />
          <span>s</span>
        </>
      ) : (
        <>
          <input type="number" value={min} onChange={(e) => setMin(e.target.value)} />
          <span>–</span>
          <input type="number" value={max} onChange={(e) => setMax(e.target.value)} />
          <span>reps</span>
        </>
      )}
      <button className="primary small" onClick={save}>Save</button>
    </div>
  );
}

function ExercisePicker({
  routineId,
  inRoutine,
  onDone,
}: {
  routineId: number;
  inRoutine: Set<number>;
  onDone: () => void;
}) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ExerciseType>('weighted');
  const globalRest = useLiveQuery(() => getSetting<number>('globalRestSeconds', 90), []);
  const matches = useLiveQuery(async () => {
    const all = await db.exercises.filter((e) => e.archived === 0).toArray();
    const query = q.trim().toLowerCase();
    return all.filter(
      (e) => !inRoutine.has(e.id!) && (query === '' || e.name.toLowerCase().includes(query)),
    );
  }, [q]);

  async function pick(exerciseId: number) {
    try {
      await addExerciseToRoutine(routineId, exerciseId);
      onDone();
    } catch {
      toast("Couldn't add exercise");
    }
  }

  async function createAndAdd() {
    if (!newName.trim()) return;
    try {
      const id = await createExercise(newName, newType, globalRest ?? 90);
      await addExerciseToRoutine(routineId, id);
      onDone();
    } catch (e) {
      toast(
        e instanceof DuplicateExerciseNameError
          ? 'An exercise with that name already exists'
          : "Couldn't create exercise",
      );
    }
  }

  return (
    <div className="card">
      <div className="row spread">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" />
        <button className="small" onClick={onDone}>Cancel</button>
      </div>
      {matches?.map((e) => (
        <div key={e.id} className="row spread" style={{ marginTop: 8 }}>
          <span>
            {e.name} <span className="small">({e.type})</span>
          </span>
          <button className="small primary" onClick={() => pick(e.id!)}>Add</button>
        </div>
      ))}
      {creating ? (
        <div className="row" style={{ marginTop: 12 }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Exercise name"
          />
          <select value={newType} onChange={(e) => setNewType(e.target.value as ExerciseType)}>
            <option value="weighted">Weighted</option>
            <option value="bodyweight">Bodyweight</option>
            <option value="timed">Timed</option>
          </select>
          <button className="primary small" onClick={createAndAdd}>Create</button>
        </div>
      ) : (
        <button className="small" style={{ marginTop: 12 }} onClick={() => setCreating(true)}>
          + New exercise
        </button>
      )}
    </div>
  );
}
