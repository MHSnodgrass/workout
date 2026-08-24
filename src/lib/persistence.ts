/**
 * Asking the browser not to throw the data away.
 *
 * Everything this app knows lives in IndexedDB, which by default is "best
 * effort" storage — a browser is free to evict it under storage pressure, with
 * no warning and no way back. `navigator.storage.persist()` upgrades it to
 * "persistent", which browsers only clear on an explicit request from the user.
 *
 * Chrome grants it silently on engagement heuristics and an installed PWA
 * qualifies, so there is no prompt on the device this app is used from.
 */

export type PersistenceState = 'persisted' | 'denied' | 'unsupported';

export interface StorageManagerLike {
  persisted?(): Promise<boolean>;
  persist?(): Promise<boolean>;
  estimate?(): Promise<{ usage?: number; quota?: number }>;
}

export async function ensurePersisted(
  storage: StorageManagerLike | undefined,
): Promise<PersistenceState> {
  if (!storage?.persist || !storage.persisted) return 'unsupported';
  try {
    // Asking again when it is already granted is harmless but pointless, and
    // in Firefox it is a second permission prompt.
    if (await storage.persisted()) return 'persisted';
    return (await storage.persist()) ? 'persisted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

const UNITS = [
  { limit: 1e9, suffix: 'GB', divisor: 1e9 },
  { limit: 1e6, suffix: 'MB', divisor: 1e6 },
];

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return 'unknown';
  for (const { limit, suffix, divisor } of UNITS) {
    if (bytes >= limit) return `${Math.round((bytes / divisor) * 10) / 10} ${suffix}`;
  }
  return `${Math.round(bytes / 1000)} kB`;
}
