import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';

export default function ConfirmButton({
  label = <Trash2 size={16} />,
  // Stays words on purpose: the armed state is a question, and an icon can't ask one.
  confirmLabel = 'Sure?',
  onConfirm,
  className = 'danger small icon-btn',
  labelText = 'Delete',
}: {
  label?: ReactNode;
  confirmLabel?: ReactNode;
  onConfirm: () => void;
  className?: string;
  /** Accessible name — the icon alone leaves the button unnamed. */
  labelText?: string;
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
    <button
      className={className}
      onClick={click}
      aria-label={armed ? `Confirm ${labelText.toLowerCase()}` : labelText}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
