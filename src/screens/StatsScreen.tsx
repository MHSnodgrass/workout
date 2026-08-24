import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatDaysAgo } from '../lib/format';

export default function StatsScreen() {
  const [q, setQ] = useState('');
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
