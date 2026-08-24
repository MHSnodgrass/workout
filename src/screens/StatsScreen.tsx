import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { getBodyWeights } from '../db/bodyWeights';
import { describeTrend, weightTrend } from '../lib/bodyWeight';
import { formatDaysAgo, round1 } from '../lib/format';
import { buildHeatmap } from '../lib/heatmap';
import CoverageCard from '../components/CoverageCard';
import Heatmap from '../components/Heatmap';

export default function StatsScreen() {
  const [q, setQ] = useState('');
  const weights = useLiveQuery(getBodyWeights, []);
  const trend = weights ? weightTrend(weights, Date.now()) : null;
  const heatmap = useLiveQuery(async () => {
    const logs = await db.setLogs.toArray();
    return buildHeatmap(logs, Date.now());
  }, []);
  const list = useLiveQuery(async () => {
    const exercises = await db.exercises.filter((e) => e.archived === 0).toArray();
    const withLast = await Promise.all(
      exercises.map(async (e) => {
        const logs = await db.setLogs.where('exerciseId').equals(e.id!).toArray();
        const lastAt = logs.length > 0 ? Math.max(...logs.map((l) => l.loggedAt)) : 0;
        return { exercise: e, lastAt };
      }),
    );
    return withLast.sort((a, b) => b.lastAt - a.lastAt);
  }, []);
  const filtered = list?.filter((x) =>
    x.exercise.name.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div className="screen">
      <h1>Stats</h1>
      {heatmap && <Heatmap data={heatmap} />}
      <CoverageCard />
      <Link to="/stats/body-weight">
        <div className="card row spread">
          <strong>Body weight</strong>
          <span className="small">
            {weights && weights.length > 0
              ? `${round1(weights[weights.length - 1].weightLbs)} lb${
                  trend ? ` · ${describeTrend(trend)}` : ''
                }`
              : 'not logged yet'}
          </span>
        </div>
      </Link>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" />
      <div style={{ marginTop: 12 }}>
        {filtered?.map(({ exercise, lastAt }) => (
          <Link key={exercise.id} to={`/stats/${exercise.id}`}>
            <div className="card row spread">
              <strong>{exercise.name}</strong>
              <span className="small">
                {lastAt > 0 ? `trained ${formatDaysAgo(lastAt)}` : 'never trained'}
              </span>
            </div>
          </Link>
        ))}
        {filtered?.length === 0 && <p className="muted">No exercises match.</p>}
      </div>
    </div>
  );
}
