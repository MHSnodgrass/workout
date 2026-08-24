/**
 * Telling you rest is up when you've switched away from the app.
 *
 * **What this can and cannot do.** While the app is merely backgrounded — you
 * are in another app, the screen is still on — a timer scheduled for the exact
 * end of the rest fires within about a second, and a service-worker
 * notification reaches you. That is the case this exists for.
 *
 * It is *not* an alarm. Once the phone has been locked for several minutes the
 * browser throttles background timers to roughly one wakeup a minute, and with
 * no push server there is nothing to wake the app on time. Don't rely on it for
 * a heavy set — the Settings copy says so too.
 *
 * The timer is scheduled rather than watched because the rest bar's 250 ms
 * interval is throttled to a crawl in a hidden tab, so it would notice the end
 * of a rest long after it happened.
 */

export const REST_TAG = 'rest-over';
export const REST_TITLE = 'Rest is up';
export const REST_BODY = 'Back to it.';

export interface AlertState {
  enabled: boolean;
  /** `Notification.permission`. */
  permission: string;
  pageHidden: boolean;
}

export function shouldNotify(state: AlertState): boolean {
  // Not when the app is on screen: the rest bar is already saying "Go!" and
  // vibrating, and a notification on top of that is noise.
  return state.enabled && state.permission === 'granted' && state.pageHidden;
}

export interface RestAlertDeps {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (handle: number) => void;
  fire: () => void;
}

export interface RestAlert {
  /** Schedule the alert for `endsAt`, replacing any alert already pending. */
  arm(endsAt: number): void;
  disarm(): void;
}

export function createRestAlert(deps: RestAlertDeps): RestAlert {
  let handle: number | null = null;

  function disarm(): void {
    if (handle === null) return;
    deps.clearTimeout(handle);
    handle = null;
  }

  return {
    arm(endsAt: number) {
      disarm();
      handle = deps.setTimeout(() => {
        handle = null;
        deps.fire();
      }, Math.max(0, endsAt - deps.now()));
    },
    disarm,
  };
}
