import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { COVERAGE_DAYS, muscleCoverage } from '../lib/muscles';

/**
 * Sets per muscle group over the last week. Groups that got nothing stay on
 * the list at zero — the gaps are the reason to look at this at all.
 */
export default function CoverageCard() {
  const coverage = useLiveQuery(async () => {
    const [sets, exercises] = await Promise.all([
      db.setLogs.toArray(),
      db.exercises.toArray(),
    ]);
    const groups = new Map(exercises.map((e) => [e.id!, e.muscleGroups ?? []]));
    const anyTagged = exercises.some((e) => (e.muscleGroups ?? []).length > 0);
    return { ...muscleCoverage(sets, groups, Date.now()), anyTagged };
  }, []);

  if (!coverage) return null;

  if (!coverage.anyTagged) {
    return (
      <div className="card">
        <strong>Muscle coverage</strong>
        <p className="small" style={{ marginBottom: 0 }}>
          Tag your exercises with muscle groups in{' '}
          <Link to="/routines">the exercise library</Link> and this fills in.
        </p>
      </div>
    );
  }

  const max = Math.max(...coverage.counts.map((c) => c.sets), 1);

  return (
    <div className="card">
      <div className="row spread">
        <strong>Muscle coverage</strong>
        <span className="small">last {COVERAGE_DAYS} days</span>
      </div>
      <div className="coverage" style={{ marginTop: 10 }}>
        {coverage.counts.map(({ group, sets }) => (
          <div className="coverage-row" key={group}>
            <span className={`coverage-name${sets === 0 ? ' muted' : ''}`}>{group}</span>
            <span className="coverage-bar">
              <span style={{ width: `${(sets / max) * 100}%` }} />
            </span>
            <span className={`coverage-count${sets === 0 ? ' muted' : ''}`}>{sets}</span>
          </div>
        ))}
      </div>
      {coverage.untaggedSets > 0 && (
        <p className="small" style={{ margin: '10px 0 0' }}>
          {coverage.untaggedSets} {coverage.untaggedSets === 1 ? 'set is' : 'sets are'} from
          untagged exercises and aren't counted —{' '}
          <Link to="/routines">tag them</Link>.
        </p>
      )}
    </div>
  );
}
