import { useEffect, useRef, useState } from 'react';

export default function RestTimerBar({
  endsAt,
  onAdd30,
  onDismiss,
}: {
  endsAt: number;
  onAdd30: () => void;
  onDismiss: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);

  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));

  useEffect(() => {
    if (remaining === 0 && !fired.current) {
      fired.current = true;
      navigator.vibrate?.([300, 100, 300]);
    }
    if (remaining > 0) fired.current = false;
  }, [remaining]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className={`rest-bar${remaining === 0 ? ' done' : ''}`}>
      <span className="rest-time">
        {remaining === 0 ? 'Go!' : `${mins}:${String(secs).padStart(2, '0')}`}
      </span>
      <button onClick={onAdd30}>+30s</button>
      <button onClick={onDismiss}>{remaining === 0 ? 'OK' : 'Skip'}</button>
    </div>
  );
}
