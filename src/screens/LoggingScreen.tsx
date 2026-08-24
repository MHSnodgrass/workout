import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Timer, Trophy, X } from 'lucide-react';
import { db, type Exercise, type RoutineExercise, type Session, type SetLog } from '../db/db';
import { detectSessionPRs, getExerciseHistory } from '../db/queries';
import { deleteSet, finishSession, logSet, updateSessionNote } from '../db/mutations';
import { getSetting } from '../db/settings';
import {
  elapsedSeconds,
  formatClock,
  formatDate,
  formatDuration,
  formatSet,
  metricLabel,
  round1,
  targetLabel,
} from '../lib/format';
import { MAX_RIR, parseRir } from '../lib/effort';
import { DEFAULT_STALL_SESSIONS, suggestNext } from '../lib/progression';
import { blockRestSeconds, groupBlocks, roundCompleted, totalRounds } from '../lib/supersets';
import { useRestAlert } from '../lib/useRestAlert';
import { useWakeLock } from '../lib/useWakeLock';
import ConfirmButton from '../components/ConfirmButton';
import RestTimerBar from '../components/RestTimerBar';
import SetValue from '../components/SetValue';
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
      <div className="card row spread">
        <div>
          <div className="stat">{setCount ?? 0}</div>
          <div className="eyebrow">sets</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="stat">{formatDuration(durationSec)}</div>
          <div className="eyebrow">on the clock</div>
        </div>
      </div>
      {prs && prs.length > 0 && (
        <div className="card pr-card">
          <strong className="row">
            <Trophy size={18} /> New PRs
          </strong>
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
  const keepAwake = useLiveQuery(() => getSetting<boolean>('keepAwake', true), []);
  useWakeLock(keepAwake === true);
  const defaultIncrement = useLiveQuery(() => getSetting<number>('defaultIncrementLbs', 5), []);
  const trackRir = useLiveQuery(() => getSetting<boolean>('trackRir', false), []);
  const stallSessions = useLiveQuery(
    () => getSetting<number>('stallSessions', DEFAULT_STALL_SESSIONS),
    [],
  );
  const restAlert = useLiveQuery(() => getSetting<boolean>('restAlert', false), []);
  useRestAlert(restEndsAt, restAlert === true);

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
      {items &&
        groupBlocks(items.map(({ re, exercise }) => ({ ...re, re, exercise }))).map((block) => (
          <WorkoutBlock
            key={block[0].re.id}
            session={session}
            members={block}
            defaultIncrementLbs={defaultIncrement ?? 5}
            stallSessions={stallSessions ?? DEFAULT_STALL_SESSIONS}
            trackRir={trackRir === true}
            onRest={onSetLogged}
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
  rir: string;
  // Timed exercises only: wall-clock start of the in-set work timer. Stored as
  // a timestamp rather than an accumulated count so backgrounding the app (or
  // any missed tick) can't lose time.
  runningSince?: number;
}

interface Member {
  re: RoutineExercise;
  exercise: Exercise;
}

/**
 * One card's worth of work: a single exercise, or a superset of two or more.
 *
 * The two layouts share all their state because they only differ in two ways —
 * how the rows are arranged, and when rest starts. A lone exercise rests after
 * every set; a superset rests after every round. `roundCompleted` collapses
 * both into one question, and answers `true` every time for a lone exercise,
 * which is precisely the behaviour this screen had before supersets existed.
 */
function WorkoutBlock({
  session,
  members,
  defaultIncrementLbs,
  stallSessions,
  trackRir,
  onRest,
}: {
  session: Session;
  members: Member[];
  defaultIncrementLbs: number;
  stallSessions: number;
  trackRir: boolean;
  onRest: (restSeconds: number) => void;
}) {
  const toast = useToast();
  const exerciseIds = members.map((m) => m.exercise.id!);
  const idKey = exerciseIds.join(',');
  const logged = useLiveQuery(async () => {
    const all = await db.setLogs.where('sessionId').equals(session.id!).toArray();
    return exerciseIds.map((id) =>
      all.filter((s) => s.exerciseId === id).sort((a, b) => a.setNumber - b.setNumber),
    );
  }, [session.id, idKey]);
  // The whole history, not just last time: stall detection reads back through
  // it. getExerciseHistory only returns finished sessions, so the one being
  // logged right now is already excluded.
  const histories = useLiveQuery(() => Promise.all(exerciseIds.map(getExerciseHistory)), [idKey]);
  // Keyed by exercise id; a missing key means "untouched, derive the defaults".
  const [pending, setPending] = useState<Record<number, PendingRow[]>>({});
  const [now, setNow] = useState(() => Date.now());

  // Only rows the user has touched can hold a running timer, so `pending`
  // alone decides this — and it's available before the loading guard below.
  const timerRunning = Object.values(pending).some((rows) =>
    rows.some((r) => r.runningSince !== undefined),
  );
  useEffect(() => {
    if (!timerRunning) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [timerRunning]);

  if (logged === undefined || histories === undefined) return null;

  const state = members.map((member, i) => {
    const history = histories[i];
    const lastTime = history.length > 0 ? history[history.length - 1] : null;
    const suggestion = suggestNext(
      history,
      member.re,
      member.exercise,
      member.exercise.incrementLbs ?? defaultIncrementLbs,
      stallSessions,
    );
    const loggedSets = logged[i];
    const rows: PendingRow[] =
      pending[member.exercise.id!] ??
      Array.from({ length: Math.max(member.re.targetSets - loggedSets.length, 0) }, (_, r) => ({
        // The suggested load applies to every set; fall back to what was
        // actually done set-for-set when there's nothing to suggest.
        weight: String(
          suggestion?.weightLbs ?? lastTime?.sets[loggedSets.length + r]?.weightLbs ?? '',
        ),
        amount: '',
        rir: '',
      }));
    return { ...member, lastTime, suggestion, loggedSets, rows };
  });

  function setRows(memberIndex: number, rows: PendingRow[]) {
    setPending((p) => ({ ...p, [members[memberIndex].exercise.id!]: rows }));
  }

  function updateRow(memberIndex: number, i: number, patch: Partial<PendingRow>) {
    setRows(
      memberIndex,
      state[memberIndex].rows.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    );
  }

  function toggleTimer(memberIndex: number, i: number) {
    const { runningSince } = state[memberIndex].rows[i];
    if (runningSince === undefined) {
      updateRow(memberIndex, i, { runningSince: Date.now() });
      setNow(Date.now());
    } else {
      updateRow(memberIndex, i, {
        amount: String(elapsedSeconds(runningSince, Date.now())),
        runningSince: undefined,
      });
    }
  }

  async function logRow(memberIndex: number, i: number) {
    const { exercise, loggedSets, rows } = state[memberIndex];
    const row = rows[i];
    const weight = row.weight.trim() === '' ? undefined : Number(row.weight);
    // Logging a still-running set stops the timer and uses its value, so the
    // user doesn't have to stop and then confirm.
    const amount =
      row.runningSince !== undefined
        ? elapsedSeconds(row.runningSince, Date.now())
        : Number(row.amount);
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
    const effort = parseRir(row.rir);
    if (!effort.ok) {
      toast(effort.error);
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
        rir: effort.value,
      });
      setRows(
        memberIndex,
        rows.filter((_, j) => j !== i),
      );
      // Counted from before the write, which is what roundCompleted expects.
      const progress = state.map((s) => ({
        targetSets: s.re.targetSets,
        loggedSets: s.loggedSets.length,
      }));
      if (roundCompleted(progress, memberIndex)) {
        onRest(blockRestSeconds(members.map((m) => m.exercise.defaultRestSeconds)));
      }
    } catch {
      toast("Couldn't save — set not recorded");
    }
  }

  async function removeSet(setLogId: number) {
    try {
      await deleteSet(setLogId);
    } catch {
      toast("Couldn't delete set");
    }
  }

  function pendingRow(memberIndex: number, i: number) {
    const { exercise, rows } = state[memberIndex];
    const row = rows[i];
    return (
      <div className="set-row" key={`pending-${exercise.id}-${i}`}>
        <input
          type="number"
          inputMode="decimal"
          placeholder="lb"
          value={row.weight}
          onChange={(e) => updateRow(memberIndex, i, { weight: e.target.value })}
        />
        <input
          type="number"
          inputMode="numeric"
          placeholder={exercise.type === 'timed' ? 'sec' : 'reps'}
          value={
            row.runningSince !== undefined
              ? String(elapsedSeconds(row.runningSince, now))
              : row.amount
          }
          onChange={(e) => updateRow(memberIndex, i, { amount: e.target.value })}
          readOnly={row.runningSince !== undefined}
        />
        {trackRir && (
          <input
            className="rir-input"
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_RIR}
            placeholder="RIR"
            aria-label="Reps in reserve"
            value={row.rir}
            onChange={(e) => updateRow(memberIndex, i, { rir: e.target.value })}
          />
        )}
        {exercise.type === 'timed' && (
          <button
            className={`small timer-btn${row.runningSince !== undefined ? ' running' : ''}`}
            onClick={() => toggleTimer(memberIndex, i)}
            aria-label={row.runningSince !== undefined ? 'Stop work timer' : 'Start work timer'}
          >
            {row.runningSince !== undefined ? (
              formatClock(elapsedSeconds(row.runningSince, now))
            ) : (
              <Timer size={16} />
            )}
          </button>
        )}
        <button
          className="primary icon-btn"
          aria-label={`Log set — ${exercise.name}`}
          onClick={() => logRow(memberIndex, i)}
        >
          <Check size={18} />
        </button>
        <button
          className="small icon-btn"
          aria-label="Discard set"
          onClick={() =>
            setRows(
              memberIndex,
              rows.filter((_, j) => j !== i),
            )
          }
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  function loggedLine(memberIndex: number, set: SetLog) {
    return (
      <div className="set-line" key={set.id}>
        <span className="set-index">{String(set.setNumber).padStart(2, '0')}</span>
        <SetValue set={set} type={state[memberIndex].exercise.type} />
        <ConfirmButton labelText="Delete set" onConfirm={() => removeSet(set.id!)} />
      </div>
    );
  }

  const headers = state.map((s, i) => (
    <div key={s.exercise.id} className={i > 0 ? 'member-head' : undefined}>
      <div className="row spread">
        <strong>{s.exercise.name}</strong>
        <span className="small">{targetLabel(s.re, s.exercise.type)}</span>
      </div>
      <div className="last-time">
        {s.lastTime
          ? `Last: ${s.lastTime.sets.map((x) => formatSet(x, s.exercise.type)).join(', ')} — ${formatDate(
              s.lastTime.session.startedAt,
            )}`
          : 'First time!'}
      </div>
      {s.suggestion && (
        <div className={`suggestion${s.suggestion.deload ? ' deload' : ''}`}>
          {s.suggestion.note}
        </div>
      )}
    </div>
  ));

  if (members.length === 1) {
    return (
      <div className="card">
        {headers}
        {state[0].loggedSets.map((set) => loggedLine(0, set))}
        {state[0].rows.map((_, i) => pendingRow(0, i))}
        <button
          className="small"
          style={{ marginTop: 8 }}
          onClick={() => setRows(0, [...state[0].rows, { weight: '', amount: '', rir: '' }])}
        >
          + Add set
        </button>
      </div>
    );
  }

  // Rounds are what you actually perform, so they order the card. A member
  // simply stops appearing once it is out of sets, which is what makes pairing
  // 3×bench with 4×rows need no reconciliation at all.
  const rounds = totalRounds(
    state.map((s) => ({
      targetSets: s.re.targetSets,
      loggedSets: s.loggedSets.length + s.rows.length,
    })),
  );

  return (
    <div className="card superset">
      <div className="row spread">
        <span className="eyebrow">Superset</span>
        <span className="small">one rest after each round</span>
      </div>
      {headers}
      {Array.from({ length: rounds }, (_, round) => (
        <div className="round" key={round}>
          <span className="eyebrow round-label">Round {round + 1}</span>
          {state.map((s, i) => {
            const set = s.loggedSets[round];
            const rowIndex = round - s.loggedSets.length;
            const body = set
              ? loggedLine(i, set)
              : rowIndex >= 0 && rowIndex < s.rows.length
                ? pendingRow(i, rowIndex)
                : null;
            if (body === null) return null;
            return (
              // Named even once logged: the set index restarts per exercise, so
              // two "01"s sit side by side in a round and read as a duplicate.
              <div key={s.exercise.id}>
                <div className="small member-label">{s.exercise.name}</div>
                {body}
              </div>
            );
          })}
        </div>
      ))}
      <button
        className="small"
        style={{ marginTop: 8 }}
        onClick={() =>
          setPending((p) => {
            const next = { ...p };
            state.forEach((s) => {
              next[s.exercise.id!] = [...s.rows, { weight: '', amount: '', rir: '' }];
            });
            return next;
          })
        }
      >
        + Add round
      </button>
    </div>
  );
}
