import { useEffect, useRef, useState } from 'react';

export default function ConfirmButton({
  label = '✕',
  confirmLabel = 'Sure?',
  onConfirm,
  className = 'danger small',
}: {
  label?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function click() {
    if (armed) {
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timer.current = window.setTimeout(() => setArmed(false), 2500);
  }

  return (
    <button className={className} onClick={click}>
      {armed ? confirmLabel : label}
    </button>
  );
}
