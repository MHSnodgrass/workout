import { useLiveQuery } from 'dexie-react-hooks';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { deleteBodyWeight, getBodyWeights } from '../db/bodyWeights';
import { getSetting, setSetting } from '../db/settings';
import {
  AVERAGE_WINDOW_DAYS,
  buildWeightSeries,
  describeTrend,
  weightTrend,
} from '../lib/bodyWeight';
import { formatDate, formatShortDate, round1 } from '../lib/format';
import { DEFAULT_ACCENT_ID, resolveAccent } from '../lib/theme';
import BodyWeightInput from '../components/BodyWeightInput';
import ConfirmButton from '../components/ConfirmButton';
import { useToast } from '../components/Toast';

const RECENT_SHOWN = 14;

export default function BodyWeightScreen() {
  const entries = useLiveQuery(getBodyWeights, []);
  const goal = useLiveQuery(() => getSetting<number | null>('bodyWeightGoalLbs', null), []);
  const accentId = useLiveQuery(() => getSetting<string>('accent', DEFAULT_ACCENT_ID), []);

  if (entries === undefined) return <div className="screen">Loading…</div>;

  const accent = resolveAccent(accentId).value;
  const series = buildWeightSeries(entries);
  const trend = weightTrend(entries, Date.now());
  const latest = series.length > 0 ? series[series.length - 1] : null;
  const data = series.map((p) => ({
    label: formatShortDate(p.at),
    weightLbs: round1(p.weightLbs),
    average: round1(p.average),
  }));

  return (
    <div className="screen">
      <h1>Body weight</h1>
      <BodyWeightInput hideHeading />
      {series.length === 0 ? (
        <p className="muted">Log a weight above and it'll chart from there.</p>
      ) : (
        <>
          <div className="card" style={{ paddingLeft: 0 }}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data}>
                <CartesianGrid stroke="#2d333b" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#8b949e" />
                <YAxis stroke="#8b949e" domain={['auto', 'auto']} width={44} />
                <Tooltip
                  contentStyle={{ background: '#1c2128', border: '1px solid #2d333b' }}
                  formatter={(v, name) => [
                    `${String(v)} lb`,
                    name === 'average' ? `${AVERAGE_WINDOW_DAYS}-day avg` : 'weighed',
                  ]}
                />
                {goal !== null && goal !== undefined && (
                  // extendDomain so the goal is on screen even when it's well
                  // outside the range you've actually weighed. No label on it:
                  // the goal sits low in the chart, where any label lands on
                  // top of the date axis — and the card below already names it.
                  <ReferenceLine
                    y={goal}
                    stroke="#f5a623"
                    strokeDasharray="4 4"
                    ifOverflow="extendDomain"
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="weightLbs"
                  stroke="#8b949e"
                  strokeWidth={1}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="average"
                  stroke={accent}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            {latest && (
              <div>
                Latest: <strong>{round1(latest.weightLbs)} lb</strong>{' '}
                <span className="small">
                  ({AVERAGE_WINDOW_DAYS}-day avg {round1(latest.average)})
                </span>
              </div>
            )}
            {trend && <div className="small">{describeTrend(trend)}</div>}
            {goal !== null && goal !== undefined && latest && (
              <div className="small">
                {round1(Math.abs(latest.average - goal))} lb {latest.average > goal ? 'above' : 'below'}{' '}
                your {goal} lb goal
              </div>
            )}
          </div>
        </>
      )}
      <GoalCard goal={goal ?? null} />
      {series.length > 0 && <RecentList entries={entries.slice(-RECENT_SHOWN).reverse()} />}
    </div>
  );
}

function GoalCard({ goal }: { goal: number | null }) {
  return (
    <div className="card">
      <strong>Goal weight</strong>
      <div className="row" style={{ marginTop: 8 }}>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          aria-label="Goal weight in pounds"
          placeholder="none"
          value={goal ?? ''}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              void setSetting('bodyWeightGoalLbs', null);
              return;
            }
            const n = Number(raw);
            if (Number.isFinite(n) && n > 0) void setSetting('bodyWeightGoalLbs', n);
          }}
        />
        <span className="small">lb — drawn on the chart. Leave blank for none.</span>
      </div>
    </div>
  );
}

function RecentList({ entries }: { entries: { id?: number; at: number; weightLbs: number }[] }) {
  const toast = useToast();
  return (
    <>
      <h1>Recent</h1>
      <div className="card">
        {entries.map((w) => (
          <div className="set-row" key={w.id}>
            <span style={{ flex: 1 }}>
              {formatDate(w.at)}: {round1(w.weightLbs)} lb
            </span>
            <ConfirmButton
              labelText="Delete reading"
              onConfirm={async () => {
                try {
                  await deleteBodyWeight(w.id!);
                } catch {
                  toast("Couldn't delete reading");
                }
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
}
