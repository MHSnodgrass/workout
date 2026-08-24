import { describe, expect, it, vi } from 'vitest';
import { ensurePersisted, formatBytes } from './persistence';

describe('ensurePersisted', () => {
  it('does not ask again when storage is already protected', async () => {
    const persist = vi.fn();
    await expect(
      ensurePersisted({ persisted: () => Promise.resolve(true), persist }),
    ).resolves.toBe('persisted');
    expect(persist).not.toHaveBeenCalled();
  });

  it('asks once when it is not', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    await expect(
      ensurePersisted({ persisted: () => Promise.resolve(false), persist }),
    ).resolves.toBe('persisted');
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('reports a refusal as denied, not as an error', async () => {
    await expect(
      ensurePersisted({ persisted: () => Promise.resolve(false), persist: () => Promise.resolve(false) }),
    ).resolves.toBe('denied');
  });

  it('says unsupported when the browser has no storage manager', async () => {
    await expect(ensurePersisted(undefined)).resolves.toBe('unsupported');
    await expect(ensurePersisted({})).resolves.toBe('unsupported');
  });

  it('treats a throwing implementation as unsupported rather than crashing', async () => {
    // Some privacy modes reject outright. Losing the guarantee must not lose
    // the app.
    await expect(
      ensurePersisted({
        persisted: () => Promise.reject(new Error('denied')),
        persist: () => Promise.reject(new Error('denied')),
      }),
    ).resolves.toBe('unsupported');
  });
});

describe('formatBytes', () => {
  it('scales to something readable', () => {
    expect(formatBytes(0)).toBe('0 kB');
    expect(formatBytes(2048)).toBe('2 kB');
    expect(formatBytes(5_400_000)).toBe('5.4 MB');
    expect(formatBytes(1_200_000_000)).toBe('1.2 GB');
  });

  it('has an answer when the browser will not say', () => {
    expect(formatBytes(undefined)).toBe('unknown');
  });
});
