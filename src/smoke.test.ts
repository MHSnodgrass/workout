import { describe, expect, it } from 'vitest';

describe('test pipeline', () => {
  it('runs with fake-indexeddb available', () => {
    expect(globalThis.indexedDB).toBeDefined();
  });
});
