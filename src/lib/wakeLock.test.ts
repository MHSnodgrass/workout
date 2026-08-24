import { describe, expect, it } from 'vitest';
import { createWakeLock, type NavigatorLike, type WakeLockSentinelLike } from './wakeLock';

class FakeSentinel implements WakeLockSentinelLike {
  released = false;
  async release(): Promise<void> {
    this.released = true;
  }
}

function fakeNavigator(): NavigatorLike & { sentinels: FakeSentinel[] } {
  const sentinels: FakeSentinel[] = [];
  return {
    sentinels,
    wakeLock: {
      async request() {
        const s = new FakeSentinel();
        sentinels.push(s);
        return s;
      },
    },
  };
}

function fakeDocument() {
  const handlers: Array<() => unknown> = [];
  return {
    visibilityState: 'visible' as 'visible' | 'hidden',
    addEventListener(_type: 'visibilitychange', fn: () => unknown) {
      handlers.push(fn);
    },
    removeEventListener(_type: 'visibilitychange', fn: () => unknown) {
      const i = handlers.indexOf(fn);
      if (i >= 0) handlers.splice(i, 1);
    },
    handlerCount: () => handlers.length,
    async dispatch() {
      await Promise.all(handlers.map((h) => h()));
    },
  };
}

describe('createWakeLock', () => {
  it('requests a screen wake lock when enabled', async () => {
    const nav = fakeNavigator();
    const wl = createWakeLock(nav, fakeDocument());

    await wl.enable();

    expect(nav.sentinels).toHaveLength(1);
    expect(nav.sentinels[0].released).toBe(false);
  });

  it('releases the wake lock when disabled', async () => {
    const nav = fakeNavigator();
    const wl = createWakeLock(nav, fakeDocument());

    await wl.enable();
    await wl.disable();

    expect(nav.sentinels[0].released).toBe(true);
  });

  it('does not stack sentinels when enabled twice', async () => {
    const nav = fakeNavigator();
    const wl = createWakeLock(nav, fakeDocument());

    await wl.enable();
    await wl.enable();

    expect(nav.sentinels).toHaveLength(1);
  });

  it('re-acquires the lock when the page becomes visible again', async () => {
    const nav = fakeNavigator();
    const doc = fakeDocument();
    const wl = createWakeLock(nav, doc);
    await wl.enable();

    // The OS drops the sentinel whenever the page hides.
    doc.visibilityState = 'hidden';
    await doc.dispatch();
    doc.visibilityState = 'visible';
    await doc.dispatch();

    expect(nav.sentinels).toHaveLength(2);
    expect(nav.sentinels[1].released).toBe(false);
  });

  it('does not re-acquire after being disabled', async () => {
    const nav = fakeNavigator();
    const doc = fakeDocument();
    const wl = createWakeLock(nav, doc);
    await wl.enable();
    await wl.disable();

    doc.visibilityState = 'visible';
    await doc.dispatch();

    expect(nav.sentinels).toHaveLength(1);
  });

  it('stops listening for visibility changes once disabled', async () => {
    const doc = fakeDocument();
    const wl = createWakeLock(fakeNavigator(), doc);

    await wl.enable();
    await wl.disable();

    expect(doc.handlerCount()).toBe(0);
  });

  it('no-ops on browsers without the Wake Lock API', async () => {
    const wl = createWakeLock({}, fakeDocument());

    await expect(wl.enable()).resolves.toBeUndefined();
    await expect(wl.disable()).resolves.toBeUndefined();
  });

  it('swallows a rejected request so logging is never interrupted', async () => {
    const nav: NavigatorLike = {
      wakeLock: {
        request: () => Promise.reject(new Error('NotAllowedError')),
      },
    };
    const wl = createWakeLock(nav, fakeDocument());

    await expect(wl.enable()).resolves.toBeUndefined();
  });
});
