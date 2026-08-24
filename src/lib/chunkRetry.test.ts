import { describe, expect, it, vi } from 'vitest';
import { createChunkRetry } from './chunkRetry';

function harness(startReloaded = false) {
  let reloaded = startReloaded;
  const reload = vi.fn();
  const retry = createChunkRetry({
    hasReloaded: () => reloaded,
    setReloaded: (v) => {
      reloaded = v;
    },
    reload,
  });
  return { retry, reload, wasMarked: () => reloaded };
}

describe('createChunkRetry', () => {
  it('passes a successful load straight through', async () => {
    const h = harness();
    await expect(h.retry(() => Promise.resolve('chunk'))).resolves.toBe('chunk');
    expect(h.reload).not.toHaveBeenCalled();
  });

  it('reloads once when a chunk has gone missing', async () => {
    // The deployed build replaced the file this build points at, so the page
    // is running code that no longer matches the server. Reloading is the only
    // cure — there is no newer chunk this bundle knows the name of.
    const h = harness();
    let settled = false;
    void h.retry(() => Promise.reject(new Error('failed to fetch dynamically imported module')))
      .then(() => (settled = true))
      .catch(() => (settled = true));
    await Promise.resolve();
    await Promise.resolve();
    expect(h.reload).toHaveBeenCalledTimes(1);
    expect(h.wasMarked()).toBe(true);
    // Deliberately never settles: the reload is taking over the page, and
    // resolving would flash an error the user can do nothing about.
    expect(settled).toBe(false);
  });

  it('gives up rather than reloading forever', async () => {
    const h = harness(true);
    await expect(
      h.retry(() => Promise.reject(new Error('failed to fetch dynamically imported module'))),
    ).rejects.toThrow('failed to fetch');
    expect(h.reload).not.toHaveBeenCalled();
  });

  it('clears the mark once a load succeeds, so a later deploy can retry', async () => {
    const h = harness(true);
    await expect(h.retry(() => Promise.resolve('chunk'))).resolves.toBe('chunk');
    expect(h.wasMarked()).toBe(false);
  });

  it('survives storage that refuses to answer', async () => {
    // Private windows and locked-down browsers throw on sessionStorage. A
    // failure to remember must not become a failure to load.
    const retry = createChunkRetry({
      hasReloaded: () => {
        throw new Error('denied');
      },
      setReloaded: () => {
        throw new Error('denied');
      },
      reload: () => {},
    });
    await expect(retry(() => Promise.resolve('chunk'))).resolves.toBe('chunk');
  });
});
