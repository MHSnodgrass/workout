import { describe, expect, it, vi } from 'vitest';
import { createRestAlert, shouldNotify } from './restAlert';

describe('shouldNotify', () => {
  const granted = { enabled: true, permission: 'granted', pageHidden: true };

  it('notifies when rest ends and you are looking at something else', () => {
    expect(shouldNotify(granted)).toBe(true);
  });

  it('stays quiet while the app is on screen', () => {
    // The rest bar is right there saying "Go!" and already vibrating. A
    // notification on top of it is noise, not information.
    expect(shouldNotify({ ...granted, pageHidden: false })).toBe(false);
  });

  it('stays quiet when the setting is off', () => {
    expect(shouldNotify({ ...granted, enabled: false })).toBe(false);
  });

  it('stays quiet without permission, including when it was never asked', () => {
    expect(shouldNotify({ ...granted, permission: 'denied' })).toBe(false);
    expect(shouldNotify({ ...granted, permission: 'default' })).toBe(false);
  });
});

describe('createRestAlert', () => {
  function harness(startAt = 1_000) {
    let now = startAt;
    const timers = new Map<number, { fn: () => void; at: number }>();
    let nextHandle = 1;
    const fire = vi.fn();
    const alert = createRestAlert({
      now: () => now,
      setTimeout: (fn, ms) => {
        const handle = nextHandle++;
        timers.set(handle, { fn, at: now + ms });
        return handle;
      },
      clearTimeout: (handle) => {
        timers.delete(handle);
      },
      fire,
    });
    return {
      alert,
      fire,
      pending: () => [...timers.values()].map((t) => t.at),
      advanceTo(t: number) {
        now = t;
        for (const [handle, timer] of [...timers]) {
          if (timer.at <= now) {
            timers.delete(handle);
            timer.fn();
          }
        }
      },
    };
  }

  it('fires when the rest actually ends, not when the interval happens to tick', () => {
    // The whole point: a hidden tab throttles the 250 ms interval, so the alert
    // is scheduled for the exact remaining time instead of watching a clock.
    const h = harness();
    h.alert.arm(1_000 + 90_000);
    expect(h.pending()).toEqual([91_000]);
    h.advanceTo(90_999);
    expect(h.fire).not.toHaveBeenCalled();
    h.advanceTo(91_000);
    expect(h.fire).toHaveBeenCalledTimes(1);
  });

  it('replaces an earlier alert rather than stacking one on top of it', () => {
    const h = harness();
    h.alert.arm(1_000 + 60_000);
    h.alert.arm(1_000 + 90_000); // +30s pressed
    expect(h.pending()).toEqual([91_000]);
    h.advanceTo(200_000);
    expect(h.fire).toHaveBeenCalledTimes(1);
  });

  it('does not fire once disarmed', () => {
    const h = harness();
    h.alert.arm(1_000 + 60_000);
    h.alert.disarm();
    h.advanceTo(200_000);
    expect(h.fire).not.toHaveBeenCalled();
    expect(h.pending()).toEqual([]);
  });

  it('fires immediately for a rest that already ended', () => {
    const h = harness(50_000);
    h.alert.arm(49_000);
    expect(h.pending()).toEqual([50_000]);
    h.advanceTo(50_000);
    expect(h.fire).toHaveBeenCalledTimes(1);
  });
});
