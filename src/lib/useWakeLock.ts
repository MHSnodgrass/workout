import { useEffect } from 'react';
import { createWakeLock } from './wakeLock';

/** Holds a screen wake lock for as long as `enabled` stays true. */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const wakeLock = createWakeLock(navigator, document);
    void wakeLock.enable();
    return () => {
      void wakeLock.disable();
    };
  }, [enabled]);
}
