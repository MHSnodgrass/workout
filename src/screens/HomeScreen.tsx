import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { X } from 'lucide-react';
import { db } from '../db/db';
import { getActiveSession, getLastFinishedSessionDate } from '../db/queries';
import { startSession } from '../db/mutations';
import { getSetting } from '../db/settings';
import { backupNudge, sessionsSinceExport } from '../lib/backupHealth';
import { formatDaysAgo } from '../lib/format';
import { isScheduledToday, scheduleLabel } from '../lib/schedule';
import BodyWeightInput from '../components/BodyWeightInput';
import { useToast } from '../components/Toast';

export default function HomeScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const routines = useLiveQuery(() => db.routines.filter((r) => r.archived === 0).toArray(), []);
  const active = useLiveQuery(getActiveSession, []);
  const lastDone = useLiveQuery(async () => {
    const all = await db.routines.filter((r) => r.archived === 0).toArray();
    const entries = await Promise.all(
      all.map(async (r) => [r.id!, await getLastFinishedSessionDate(r.id!)] as const),
    );
    return new Map(entries);
  }, []);
  // Measured in sessions, not days: time since the last export nags after a
  // month off, when nothing is at risk, and stays silent through a month of
  // hard training. See lib/backupHealth.ts.
  const backupWarning = useLiveQuery(async () => {
    const finished = await db.sessions.toArray();
    const last = await getSetting<number | null>('lastExportAt', null);
    return backupNudge(
      sessionsSinceExport(
        finished.filter((s) => s.finishedAt !== null).map((s) => s.finishedAt!),
        last,
      ),
    );
  }, []);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  // Today's routines float up; everything else keeps the order it was created
  // in, so the list doesn't reshuffle from day to day beyond the promotion.
  const sorted = routines && [...routines].sort((a, b) => {
    const rank = (r: typeof a) => (isScheduledToday(r.weekdays, Date.now()) ? 0 : 1);
    return rank(a) - rank(b);
  });

  async function start(routineId: number) {
    try {
      const id = await startSession(routineId);
      navigate(`/log/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't start workout");
    }
  }

  return (
    <div className="screen">
      <h1>Workout</h1>
      {backupWarning && !nudgeDismissed && (
        <div className="banner">
          <span className="small">{backupWarning}</span>
          <div className="row">
            <Link to="/settings"><button className="small">Export</button></Link>
            <button
              className="small icon-btn"
              aria-label="Dismiss backup reminder"
              onClick={() => setNudgeDismissed(true)}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      {active && (
        <div className="banner">
          <span>Workout in progress</span>
          <button className="primary" onClick={() => navigate(`/log/${active.id}`)}>Resume</button>
        </div>
      )}
      {sorted?.map((r) => {
        const last = lastDone?.get(r.id!);
        const today = isScheduledToday(r.weekdays, Date.now());
        return (
          <button
            key={r.id}
            className={`card big${today ? ' scheduled' : ''}`}
            style={{ textAlign: 'left' }}
            disabled={!!active}
            onClick={() => start(r.id!)}
          >
            <span className="row spread">
              <span className="routine-name">{r.name}</span>
              {today && <span className="badge">Today</span>}
            </span>
            <div className="small">
              {last ? `Last done ${formatDaysAgo(last)}` : 'Never done'}
              {!today && scheduleLabel(r.weekdays) !== '' && ` · ${scheduleLabel(r.weekdays)}`}
            </div>
          </button>
        );
      })}
      {routines?.length === 0 && (
        <p className="muted">Create a routine in the Routines tab to get started.</p>
      )}
      <BodyWeightInput />
    </div>
  );
}
