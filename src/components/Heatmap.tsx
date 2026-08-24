import { useEffect, useMemo, useRef } from 'react';
import { monthLabels, type Heatmap as HeatmapData } from '../lib/heatmap';
import { formatDate } from '../lib/format';

export default function Heatmap({ data }: { data: HeatmapData }) {
  const scroller = useRef<HTMLDivElement>(null);
  const months = useMemo(() => monthLabels(data.weeks), [data.weeks]);

  // A year doesn't fit a phone, so open on the most recent weeks.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [data]);

  const summary =
    data.workouts === 0
      ? 'No workouts logged in the last year'
      : `${data.workouts} ${data.workouts === 1 ? 'workout' : 'workouts'} · ${data.totalSets} sets in the last year`;

  return (
    <div className="card">
      <div className="heatmap-scroll" ref={scroller}>
        <div className="heatmap-months" aria-hidden="true">
          {months.map(({ weekIndex, label }) => (
            <span key={weekIndex} style={{ gridColumn: weekIndex + 1 }}>
              {label}
            </span>
          ))}
        </div>
        <div className="heatmap" role="img" aria-label={summary}>
          {data.weeks.map((week) => (
            <div className="heatmap-week" key={week[0].date}>
              {week.map((d) => (
                <div
                  key={d.date}
                  className={`heatmap-day level-${d.level}`}
                  title={`${d.count} ${d.count === 1 ? 'set' : 'sets'} on ${formatDate(d.date)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="small" style={{ margin: '10px 0 0' }}>
        {summary}
      </p>
    </div>
  );
}
