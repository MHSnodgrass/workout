import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { db, type ExerciseType, type SetLog } from '../db/db';
import { getExerciseHistory, type SessionSets } from '../db/queries';
import {
  availableMetricsFor,
  bestOccurrence,
  buildSeries,
  defaultMetricFor,
  type MetricKey,
  type SessionPoint,
} from '../lib/metrics';
import { getSetting } from '../db/settings';
import { DEFAULT_ACCENT_ID, resolveAccent } from '../lib/theme';
import { deleteSession, deleteSet, updateSet } from '../db/mutations';
import { formatDate, formatSet, formatShortDate, metricLabel, round1 } from '../lib/format';
import ConfirmButton from '../components/ConfirmButton';
import { useToast } from '../components/Toast';

export default function ExerciseStatsScreen() {
  const { exerciseId } = useParams();
  const eid = Number(exerciseId);
  const exercise = useLiveQuery(() => db.exercises.get(eid), [eid]);
  const history = useLiveQuery(() => getExerciseHistory(eid), [eid]);
  const accentId = useLiveQuery(() => getSetting<string>('accent', DEFAULT_ACCENT_ID), []);
  const [metricOverride, setMetricOverride] = useState<MetricKey | null>(null);

  if (!exercise || history === undefined) return <div className="screen">Loading…</div>;

  // Recharts takes concrete colours, so the accent is resolved here rather
  // than inherited from the CSS token the rest of the UI uses.
  const accent = resolveAccent(accentId).value;

  const metric = metricOverride ?? defaultMetricFor(exercise.type);
  const series = buildSeries(history, metric);
  const data = series.map((p) => ({ ...p, label: formatShortDate(p.date) }));

  return (
    <div className="screen">
      <h1>{exercise.name}</h1>
      <div className="row">
        {availableMetricsFor(exercise.type).map((m) => (
          <button
            key={m}
            className={`small${m === metric ? ' primary' : ''}`}
            onClick={() => setMetricOverride(m)}
          >
            {metricLabel(m)}
          </button>
        ))}
      </div>
      {series.length === 0 ? (
        <p className="muted" style={{ marginTop: 12 }}>No logged sessions yet.</p>
      ) : (
        <>
          <div className="card" style={{ paddingLeft: 0, marginTop: 12 }}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data}>
                <CartesianGrid stroke="#2d333b" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#8b949e" />
                <YAxis stroke="#8b949e" domain={['auto', 'auto']} width={44} />
                <Tooltip
                  contentStyle={{ background: '#1c2128', border: '1px solid #2d333b' }}
                  formatter={(v) => [String(round1(Number(v))), metricLabel(metric)]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={accent}
                  dot={<PRDot accent={accent} />}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Records history={history} type={exercise.type} />
          <HistoryList history={history} type={exercise.type} />
        </>
      )}
    </div>
  );
}

function PRDot(props: { cx?: number; cy?: number; payload?: SessionPoint; accent?: string }) {
  const { cx, cy, payload, accent } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={payload.isPR ? 5 : 3}
      fill={payload.isPR ? '#f5a623' : (accent ?? '#4f8ef7')}
    />
  );
}

function Records({ history, type }: { history: SessionSets[]; type: ExerciseType }) {
  return (
    <div className="card small">
      {availableMetricsFor(type).map((m) => {
        const best = bestOccurrence(m, history);
        if (best === null) return null;
        return (
          <div key={m}>
            Best {metricLabel(m)}: <strong>{round1(best.value)}</strong>{' '}
            <span className="best-set">
              — {best.set ? `${formatSet(best.set, type)} on ` : ''}
              {formatDate(best.session.startedAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function HistoryList({ history, type }: { history: SessionSets[]; type: ExerciseType }) {
  const toast = useToast();
  const newestFirst = [...history].reverse();
  return (
    <>
      <h1>History</h1>
      {newestFirst.map(({ session, sets }) => (
        <div className="card" key={session.id}>
          <div className="row spread">
            <strong>{formatDate(session.startedAt)}</strong>
            <ConfirmButton
              labelText="Delete session"
              confirmLabel="Delete session?"
              onConfirm={async () => {
                try {
                  await deleteSession(session.id!);
                } catch {
                  toast("Couldn't delete session");
                }
              }}
            />
          </div>
          {session.note && <div className="small">“{session.note}”</div>}
          {sets.map((s) => (
            <SetHistoryRow key={s.id} set={s} type={type} />
          ))}
        </div>
      ))}
    </>
  );
}

function SetHistoryRow({ set, type }: { set: SetLog; type: ExerciseType }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState(String(set.weightLbs ?? ''));
  const [amount, setAmount] = useState(
    String(type === 'timed' ? set.durationSeconds ?? '' : set.reps ?? ''),
  );

  async function save() {
    const w = weight.trim() === '' ? undefined : Number(weight);
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) {
      toast(type === 'timed' ? 'Enter seconds' : 'Enter reps');
      return;
    }
    try {
      await updateSet(set.id!, {
        weightLbs: w,
        reps: type === 'timed' ? undefined : a,
        durationSeconds: type === 'timed' ? a : undefined,
      });
      setEditing(false);
    } catch {
      toast("Couldn't save set");
    }
  }

  if (!editing) {
    return (
      <div className="set-row">
        <span style={{ flex: 1 }}>
          Set {set.setNumber}: {formatSet(set, type)}
        </span>
        <button className="small" onClick={() => setEditing(true)}>Edit</button>
        <ConfirmButton
          labelText="Delete set"
          onConfirm={async () => {
            try {
              await deleteSet(set.id!);
            } catch {
              toast("Couldn't delete set");
            }
          }}
        />
      </div>
    );
  }
  return (
    <div className="set-row">
      <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="lb" />
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={type === 'timed' ? 'sec' : 'reps'}
      />
      <button className="primary small" onClick={save}>Save</button>
    </div>
  );
}
