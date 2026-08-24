import { useEffect } from 'react';
import { REST_BODY, REST_TAG, REST_TITLE, createRestAlert, shouldNotify } from './restAlert';

/** Whether this browser can notify at all, and whether it has been allowed to. */
export function notificationPermission(): string {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

/** Asks once, on a tap. Never call this on load — an unprompted prompt is spam. */
export async function requestNotificationPermission(): Promise<string> {
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

async function showRestNotification(): Promise<void> {
  const options: NotificationOptions = {
    body: REST_BODY,
    // One rest at a time: a new alert replaces the last rather than stacking.
    tag: REST_TAG,
    icon: `${import.meta.env.BASE_URL}icon-192.png`,
  };
  try {
    // Through the service worker first — Android Chrome throws on the
    // Notification constructor and only supports this path.
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) await registration.showNotification(REST_TITLE, options);
    else new Notification(REST_TITLE, options);
  } catch {
    // Blocked, unsupported, or the registration went away. Nothing the user can
    // act on mid-set, so stay silent — the rest bar is still counting down.
  }
}

async function clearRestNotifications(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const open = (await registration?.getNotifications({ tag: REST_TAG })) ?? [];
    for (const notification of open) notification.close();
  } catch {
    // Nothing to clear, or the browser won't say. Harmless either way.
  }
}

/**
 * Fires a notification when the rest running until `endsAt` ends, if you have
 * switched away by then. Passing null means no rest is running.
 */
export function useRestAlert(endsAt: number | null, enabled: boolean): void {
  useEffect(() => {
    if (endsAt === null || !enabled) return;
    const alert = createRestAlert({
      now: () => Date.now(),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      clearTimeout: (handle) => window.clearTimeout(handle),
      fire: () => {
        const state = {
          enabled,
          permission: notificationPermission(),
          pageHidden: document.visibilityState === 'hidden',
        };
        if (shouldNotify(state)) void showRestNotification();
      },
    });
    alert.arm(endsAt);

    // Coming back to the app answers the question the notification was asking,
    // so it shouldn't be left sitting in the shade.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void clearRestNotifications();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alert.disarm();
      document.removeEventListener('visibilitychange', onVisible);
      void clearRestNotifications();
    };
  }, [endsAt, enabled]);
}
