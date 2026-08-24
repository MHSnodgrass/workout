/**
 * Recovering when a lazy chunk has been deployed out from under the page.
 *
 * The app is a PWA whose service worker precaches `index.html` and every hashed
 * chunk. After a deploy the old chunk names are gone from both the cache and
 * the server, but a page that was already open is still running the old
 * `index.html` — so the first lazy route it visits fetches a file that 404s.
 *
 * Without this, that rejection propagates through React.lazy and unmounts the
 * whole tree: a blank screen with no tab bar, on a screen that worked
 * yesterday. Reloading is the only real cure, because the running bundle has no
 * knowledge of what the new chunk is called.
 *
 * The one-shot guard matters as much as the reload: if the chunk is missing for
 * any *other* reason — offline mid-flight, a bad deploy — reloading on every
 * attempt would spin forever instead of showing an error someone can act on.
 */

export interface ChunkRetryDeps {
  hasReloaded(): boolean;
  setReloaded(value: boolean): void;
  reload(): void;
}

export function createChunkRetry(deps: ChunkRetryDeps) {
  // Storage throws outright in some privacy modes. Failing to *remember*
  // must never become failing to load.
  const hasReloaded = () => {
    try {
      return deps.hasReloaded();
    } catch {
      return false;
    }
  };
  const setReloaded = (value: boolean) => {
    try {
      deps.setReloaded(value);
    } catch {
      // Nothing to do; the worst case is one extra reload.
    }
  };

  return async function retry<T>(load: () => Promise<T>): Promise<T> {
    try {
      const loaded = await load();
      // Back in sync — let a future deploy have its own retry.
      if (hasReloaded()) setReloaded(false);
      return loaded;
    } catch (error) {
      if (hasReloaded()) throw error;
      setReloaded(true);
      deps.reload();
      // Deliberately never settles. The reload is already taking over the page,
      // and resolving here would flash an error nobody can act on.
      return new Promise<T>(() => {});
    }
  };
}

const STORAGE_KEY = 'chunk-reloaded';

/** The browser-backed retry used by the real routes. */
export const retryChunk = createChunkRetry({
  hasReloaded: () => sessionStorage.getItem(STORAGE_KEY) !== null,
  setReloaded: (value) => {
    if (value) sessionStorage.setItem(STORAGE_KEY, '1');
    else sessionStorage.removeItem(STORAGE_KEY);
  },
  reload: () => {
    window.location.reload();
  },
});
