import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, ChevronUp, Link2, Pencil, Unlink2 } from 'lucide-react';
import { db, type Exercise, type ExerciseType, type Routine, type RoutineExercise } from '../db/db';
import {
  DuplicateExerciseNameError,
  addExerciseToRoutine,
  createExercise,
  linkSuperset,
  moveRoutineExercise,
  removeRoutineExercise,
  renameRoutine,
  setRoutineWeekdays,
  unlinkSuperset,
  updateRoutineExercise,
} from '../db/mutations';
import { getSetting } from '../db/settings';
import { retryChunk } from '../lib/chunkRetry';
import { targetLabel } from '../lib/format';
import { WEEKDAYS, scheduleLabel } from '../lib/schedule';
import { DEFAULT_BAR_LBS } from '../lib/plates';
import {
  mapSeedMuscles,
  searchSeed,
  seedType,
  usesBarbell,
  type SeedExercise,
} from '../lib/seedLibrary';
import { groupBlocks } from '../lib/supersets';
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
      <WeekdayPicker routine={routine} />
      {groupBlocks(items.map(({ re, exercise }) => ({ ...re, re, exercise }))).map(
        (block, blockIndex, blocks) => {
          const rows = block.map(({ re, exercise }, memberIndex) => (
            <RoutineExerciseRow
              key={re.id}
              re={re}
              exercise={exercise}
              isFirst={blockIndex === 0}
              isLast={blockIndex === blocks.length - 1}
              // Reordering moves whole blocks, so a pair gets one set of arrows,
              // on its first member — not two that do the same thing.
              canMove={memberIndex === 0}
              paired={block.length > 1}
            />
          ));
          return block.length === 1 ? (
            rows
          ) : (
            <div className="superset-block" key={block[0].re.id}>
              <div className="row spread">
                <span className="eyebrow">Superset</span>
                <span className="small">one rest after each round</span>
              </div>
              {rows}
            </div>
          );
        },
      )}
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

function WeekdayPicker({ routine }: { routine: Routine }) {
  const toast = useToast();
  const selected = routine.weekdays ?? [];

  async function toggle(index: number) {
    const next = selected.includes(index)
      ? selected.filter((d) => d !== index)
      : [...selected, index];
    try {
      await setRoutineWeekdays(routine.id!, next);
    } catch {
      toast("Couldn't save schedule");
    }
  }

  return (
    <div className="card">
      <div className="row spread">
        <strong>Scheduled</strong>
        <span className="small">{scheduleLabel(selected) || 'any day'}</span>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        {WEEKDAYS.map((d) => (
          <button
            key={d.index}
            className={`day-chip${selected.includes(d.index) ? ' selected' : ''}`}
            aria-label={d.short}
            aria-pressed={selected.includes(d.index)}
            onClick={() => toggle(d.index)}
          >
            {d.initial}
          </button>
        ))}
      </div>
      <p className="small">Highlights this routine on Home. You can still run it any day.</p>
    </div>
  );
}

function RoutineExerciseRow({
  re,
  exercise,
  isFirst,
  isLast,
  canMove,
  paired,
}: {
  re: RoutineExercise;
  exercise: Exercise;
  isFirst: boolean;
  isLast: boolean;
  canMove: boolean;
  paired: boolean;
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

  async function toggleLink() {
    try {
      if (paired) await unlinkSuperset(re.routineId, re.id!);
      else await linkSuperset(re.routineId, re.id!);
    } catch {
      toast("Couldn't change the superset");
    }
  }

  return (
    <div className="card">
      <div className="row spread">
        <strong>{exercise.name}</strong>
        <div className="row">
          {canMove && (
            <>
              <button
                className="small icon-btn"
                aria-label="Move up"
                disabled={isFirst}
                onClick={() => move(-1)}
              >
                <ChevronUp size={16} />
              </button>
              <button
                className="small icon-btn"
                aria-label="Move down"
                disabled={isLast}
                onClick={() => move(1)}
              >
                <ChevronDown size={16} />
              </button>
            </>
          )}
          <button
            className="small icon-btn"
            // Only ever links upward, so the first row has nothing to pair with.
            aria-label={paired ? 'Break up superset' : 'Superset with the exercise above'}
            disabled={!paired && isFirst}
            onClick={toggleLink}
          >
            {paired ? <Unlink2 size={16} /> : <Link2 size={16} />}
          </button>
          <button
            className="small icon-btn"
            aria-label="Edit targets"
            aria-pressed={editing}
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil size={16} />
          </button>
          <ConfirmButton
            labelText="Remove exercise"
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
  const mine = useLiveQuery(async () => {
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

  async function createAndAdd(
    name: string,
    type: ExerciseType,
    extras: { muscleGroups?: string[]; barLbs?: number } = {},
  ): Promise<void> {
    if (!name.trim()) return;
    try {
      const id = await createExercise(name, type, globalRest ?? 90, extras);
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
      {mine?.map((e) => (
        <div key={e.id} className="row spread" style={{ marginTop: 8 }}>
          <span>
            {e.name} <span className="small">({e.type})</span>
          </span>
          <button className="small primary" onClick={() => pick(e.id!)}>Add</button>
        </div>
      ))}
      {mine?.length === 0 && <p className="small">Nothing of yours matches.</p>}
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
          <button className="primary small" onClick={() => createAndAdd(newName, newType)}>
            Create
          </button>
        </div>
      ) : (
        <button className="small" style={{ marginTop: 12 }} onClick={() => setCreating(true)}>
          + New exercise
        </button>
      )}
      <SeedResults query={q} onAdd={createAndAdd} />
    </div>
  );
}

/**
 * The seeded library, below your own exercises — yours are what you actually
 * train, so they stay on top. The dataset is imported on open rather than at
 * boot: it is ~100 kB of JSON that the logging path has no use for.
 */
function SeedResults({
  query,
  onAdd,
}: {
  query: string;
  onAdd: (
    name: string,
    type: ExerciseType,
    extras?: { muscleGroups?: string[]; barLbs?: number },
  ) => Promise<void>;
}) {
  const [library, setLibrary] = useState<SeedExercise[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pickedType, setPickedType] = useState<ExerciseType>('weighted');
  const barLbs = useLiveQuery(() => getSetting<number>('barWeightLbs', DEFAULT_BAR_LBS), []);
  // Excludes by name, matching what createExercise would reject, so the picker
  // never offers something that can only fail.
  const taken = useLiveQuery(async () => {
    const all = await db.exercises.filter((e) => e.archived === 0).toArray();
    return new Set(all.map((e) => e.name.toLowerCase()));
  }, []);

  useEffect(() => {
    let alive = true;
    // Same exposure as the lazy routes: a deploy while the page was open
    // deletes the chunk this build is asking for. See lib/chunkRetry.ts.
    void retryChunk(() => import('../data/seedExercises')).then((m) => {
      if (alive) setLibrary(m.SEED_EXERCISES);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (library === null || taken === undefined) return null;
  const { results, total } = searchSeed(library, query, { exclude: taken });

  return (
    <>
      <div className="row spread seed-head">
        <span className="eyebrow">From the library</span>
        <span className="small">
          {total === 0
            ? 'no matches'
            : results.length < total
              ? `${results.length} of ${total}`
              : `${total}`}
        </span>
      </div>
      {total === 0 && <p className="small">Nothing in the library matches — name it yourself.</p>}
      {results.map((e) => {
        const groups = mapSeedMuscles(e.primaryMuscles);
        const bar = usesBarbell(e) ? (barLbs ?? DEFAULT_BAR_LBS) : undefined;
        const isOpen = expanded === e.name;
        return (
          <div key={e.name} style={{ marginTop: 8 }}>
            <div className="row spread">
              <span>
                {e.name}{' '}
                <span className="small">
                  ({groups.length > 0 ? groups.join(' · ') : 'untagged'}
                  {bar !== undefined && ' · barbell'})
                </span>
              </span>
              <button
                className="small"
                aria-expanded={isOpen}
                onClick={() => {
                  setExpanded(isOpen ? null : e.name);
                  setPickedType(seedType(e));
                }}
              >
                {isOpen ? 'Cancel' : 'Add'}
              </button>
            </div>
            {isOpen && (
              <div className="row" style={{ marginTop: 6 }}>
                {/* Type can't be changed once an exercise exists, so it is
                    confirmed here rather than guessed silently. */}
                <select
                  aria-label="Exercise type"
                  value={pickedType}
                  onChange={(ev) => setPickedType(ev.target.value as ExerciseType)}
                >
                  <option value="weighted">Weighted</option>
                  <option value="bodyweight">Bodyweight</option>
                  <option value="timed">Timed</option>
                </select>
                <button
                  className="primary small"
                  onClick={() => void onAdd(e.name, pickedType, { muscleGroups: groups, barLbs: bar })}
                >
                  Add {e.name}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
