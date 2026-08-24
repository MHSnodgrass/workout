import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise, type RoutineExercise, type Session } from '../db/db';
import { detectSessionPRs, getLastTime } from '../db/queries';
import { deleteSet, finishSession, logSet, updateSessionNote } from '../db/mutations';
import { formatDate, formatDuration, formatSet, metricLabel, round1, targetLabel } from '../lib/format';
import ConfirmButton from '../components/ConfirmButton';
import RestTimerBar from '../components/RestTimerBar';
import { useToast } from '../components/Toast';

export default function LoggingScreen() {
  const { sessionId } = useParams();
  const id = Number(sessionId);
  const session = useLiveQuery(() => db.sessions.get(id), [id]);

  if (!session) return <div className="screen">Loading…</div>;
  return session.finishedAt === null ? (
    <ActiveWorkout session={session} />
  ) : (
    <SessionSummary session={session} />
  );
}

function SessionSummary({ session }: { session: Session }) {
  const navigate = useNavigate();
  const toast = useToast();
  const prs = useLiveQuery(() => detectSessionPRs(session.id!), [session.id]);
  const setCount = useLiveQuery(
    () => db.setLogs.where('sessionId').equals(session.id!).count(),
    [session.id],
  );
  const [note, setNote] = useState(session.note ?? '');
  const durationSec = Math.round(
    ((session.finishedAt ?? session.startedAt) - session.startedAt) / 1000,
  );

  async function saveAndClose() {
    try {
      if (note.trim() !== (session.note ?? '')) await updateSessionNote(session.id!, note.trim());
      navigate('/');
    } catch {
      toast("Couldn't save note");
    }
  }

  return (
    <div className="screen">
      <h1>Workout complete</h1>
      <p>
        {setCount ?? 0} sets · {formatDuration(durationSec)}
      </p>
      {prs && prs.length > 0 && (
        <div className="card pr-card">
          <strong>New PRs 🎉</strong>
          <ul>
            {prs.map((p) => (
              <li key={p.exerciseId}>
                {p.exerciseName}: {metricLabel(p.metric)} {round1(p.value)}
                {p.previousBest !== null ? ` (was ${round1(p.previousBest)})` : ' (first time)'}
              </li>
            ))}
          </ul>
        </div>
      )}
      <textarea
        placeholder="Session note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button className="primary big" onClick={saveAndClose}>Done</button>
    </div>
  );
}

function ActiveWorkout({ session }: { session: Session }) {
  const toast = useToast();
  const items = useLiveQuery(async () => {
    const res = await db.routineExercises
      .where('routineId')
      .equals(session.routineId)
      .sortBy('order');
    const exs = await db.exercises.bulkGet(res.map((re) => re.exerciseId));
    return res
      .map((re, i) => ({ re, exercise: exs[i] }))
      .filter((x): x is { re: RoutineExercise; exercise: Exercise } => x.exercise !== undefined);
  }, [session.routineId]);

  const [autoRest, setAutoRest] = useState(true);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);

  function onSetLogged(restSeconds: number) {
    if (autoRest) setRestEndsAt(Date.now() + restSeconds * 1000);
  }

  async function finish() {
    try {
      await finishSession(session.id!);
    } catch {
      toast("Couldn't finish workout");
    }
  }

  return (
    <div className="screen">
      <header className="row spread">
        <h1>Workout</h1>
        <label className="row small">
          <input
            type="checkbox"
            checked={autoRest}
            onChange={(e) => setAutoRest(e.target.checked)}
          />
          Auto rest timer
        </label>
      </header>
      {items?.map(({ re, exercise }) => (
        <ExerciseCard
          key={re.id}
          session={session}
          re={re}
          exercise={exercise}
          onSetLogged={onSetLogged}
        />
      ))}
      <button className="primary big" onClick={finish}>Finish workout</button>
      {restEndsAt !== null && (
        <RestTimerBar
          endsAt={restEndsAt}
          onAdd30={() => setRestEndsAt((t) => (t ?? Date.now()) + 30_000)}
          onDismiss={() => setRestEndsAt(null)}
        />
      )}
    </div>
  );
}

interface PendingRow {
  weight: string;
  amount: string; // reps, or seconds for timed exercises
}

function ExerciseCard({
  session,
  re,
  exercise,
  onSetLogged,
}: {
  session: Session;
  re: RoutineExercise;
  exercise: Exercise;
  onSetLogged: (restSeconds: number) => void;
}) {
  const toast = useToast();
  const logged = useLiveQuery(
    () =>
      db.setLogs
        .where('sessionId')
        .equals(session.id!)
        .and((s) => s.exerciseId === exercise.id)
        .sortBy('setNumber'),
    [session.id, exercise.id],
  );
  const lastTime = useLiveQuery(
    () => getLastTime(exercise.id!, session.id),
    [exercise.id, session.id],
  );
  const [pending, setPending] = useState<PendingRow[] | null>(null);

  if (logged === undefined || lastTime === undefined) return null;
  const loggedSets = logged;

  const rows =
    pending ??
    Array.from({ length: Math.max(re.targetSets - loggedSets.length, 0) }, (_, i) => ({
      weight: String(lastTime?.sets[loggedSets.length + i]?.weightLbs ?? ''),
      amount: '',
    }));

  function updateRow(i: number, patch: Partial<PendingRow>) {
    setPending(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function logRow(i: number) {
    const row = rows[i];
    const weight = row.weight.trim() === '' ? undefined : Number(row.weight);
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast(exercise.type === 'timed' ? 'Enter seconds' : 'Enter reps');
      return;
    }
    if (weight !== undefined && !Number.isFinite(weight)) {
      toast('Weight must be a number');
      return;
    }
    if (exercise.type === 'weighted' && weight === undefined) {
      toast('Enter a weight');
      return;
    }
    try {
      await logSet({
        sessionId: session.id!,
        exerciseId: exercise.id!,
        setNumber: loggedSets.length + 1,
        weightLbs: weight,
        reps: exercise.type === 'timed' ? undefined : amount,
        durationSeconds: exercise.type === 'timed' ? amount : undefined,
      });
      setPending(rows.filter((_, j) => j !== i));
      onSetLogged(exercise.defaultRestSeconds);
    } catch {
      toast("Couldn't save — set not recorded");
    }
  }

  return (
    <div className="card">
      <div className="row spread">
        <strong>{exercise.name}</strong>
        <span className="small">{targetLabel(re, exercise.type)}</span>
      </div>
      <div className="last-time">
        {lastTime
          ? `Last: ${lastTime.sets.map((s) => formatSet(s, exercise.type)).join(', ')} — ${formatDate(
              lastTime.session.startedAt,
            )}`
          : 'First time!'}
      </div>
      {loggedSets.map((s) => (
        <div className="set-row logged" key={s.id}>
          <span style={{ flex: 1 }}>
            Set {s.setNumber}: {formatSet(s, exercise.type)}
          </span>
          <ConfirmButton
            onConfirm={async () => {
              try {
                await deleteSet(s.id!);
              } catch {
                toast("Couldn't delete set");
              }
            }}
          />
        </div>
      ))}
      {rows.map((row, i) => (
        <div className="set-row" key={`pending-${i}`}>
          <input
            type="number"
            inputMode="decimal"
            placeholder="lb"
            value={row.weight}
            onChange={(e) => updateRow(i, { weight: e.target.value })}
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder={exercise.type === 'timed' ? 'sec' : 'reps'}
            value={row.amount}
            onChange={(e) => updateRow(i, { amount: e.target.value })}
          />
          <button className="primary" onClick={() => logRow(i)}>✓</button>
          <button className="small" onClick={() => setPending(rows.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button
        className="small"
        style={{ marginTop: 8 }}
        onClick={() => setPending([...rows, { weight: '', amount: '' }])}
      >
        + Add set
      </button>
    </div>
  );
}
