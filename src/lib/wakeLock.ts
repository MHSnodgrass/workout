/**
 * Keeps the screen awake while a workout is in progress.
 *
 * Deliberately framed as a plain controller rather than a hook so the awkward
 * part is testable in the node environment: the OS silently drops the sentinel
 * every time the page hides, so staying awake means re-requesting on every
 * return to visibility, not just once.
 */

export interface WakeLockSentinelLike {
  release(): Promise<void>;
}

export interface NavigatorLike {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinelLike>;
  };
}

export interface DocumentLike {
  visibilityState: string;
  addEventListener(type: 'visibilitychange', fn: () => unknown): void;
  removeEventListener(type: 'visibilitychange', fn: () => unknown): void;
}

export interface WakeLock {
  enable(): Promise<void>;
  disable(): Promise<void>;
}

export function createWakeLock(nav: NavigatorLike, doc: DocumentLike): WakeLock {
  let sentinel: WakeLockSentinelLike | null = null;
  let wanted = false;

  async function acquire(): Promise<void> {
    if (!wanted || sentinel !== null || nav.wakeLock === undefined) return;
    try {
      const next = await nav.wakeLock.request('screen');
      // A disable() may have landed while the request was in flight.
      if (wanted) sentinel = next;
      else await next.release();
    } catch {
      // Unsupported, denied, or the page lost focus mid-request. Not
      // actionable by the user, so stay silent rather than interrupt logging.
    }
  }

  const onVisibilityChange = () => {
    if (doc.visibilityState === 'visible') return acquire();
    // Hiding the page releases the lock at the OS level, so the sentinel we
    // are holding is already dead — drop it or acquire() will think we're set.
    sentinel = null;
  };

  return {
    async enable() {
      if (wanted) return;
      wanted = true;
      doc.addEventListener('visibilitychange', onVisibilityChange);
      await acquire();
    },

    async disable() {
      if (!wanted) return;
      wanted = false;
      doc.removeEventListener('visibilitychange', onVisibilityChange);
      const held = sentinel;
      sentinel = null;
      try {
        await held?.release();
      } catch {
        // Already released by the OS; nothing left to do.
      }
    },
  };
}
