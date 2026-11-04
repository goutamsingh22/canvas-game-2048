import { describe, expect, it } from 'vitest';
import {
  BEST_KEY,
  SESSION_KEY,
  createStorage,
  isValidBoard,
  isValidSession
} from '../src/storage.js';

function memoryBackend(initial = {}) {
  const data = new Map(Object.entries(initial));

  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
}

function validSnapshot() {
  return {
    version: 1,
    size: 4,
    board: [
      [2, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    score: 32,
    status: 'playing',
    keepPlaying: false
  };
}

describe('storage validation', () => {
  it('accepts square boards of zeroes and powers of two', () => {
    expect(isValidBoard(validSnapshot().board)).toBe(true);
  });

  it('rejects malformed boards', () => {
    expect(isValidBoard(null)).toBe(false);
    expect(isValidBoard([[2, 2], [2]])).toBe(false);
    expect(isValidBoard([[3, 0], [0, 0]])).toBe(false);
    expect(isValidBoard([[2, -2], [0, 0]])).toBe(false);
  });

  it('rejects incomplete session snapshots', () => {
    expect(isValidSession(null)).toBe(false);
    expect(isValidSession({ ...validSnapshot(), score: -1 })).toBe(false);
    expect(isValidSession({ ...validSnapshot(), score: 1.5 })).toBe(false);
    expect(isValidSession({ ...validSnapshot(), status: 'paused' })).toBe(false);
    expect(isValidSession({ ...validSnapshot(), size: 3 })).toBe(false);
  });
});

describe('persistence adapter', () => {
  it('round-trips a session snapshot', () => {
    const backend = memoryBackend();
    const storage = createStorage(backend);

    expect(storage.saveSession(validSnapshot())).toBe(true);
    expect(storage.loadSession()).toEqual(validSnapshot());
    expect(backend.data.has(SESSION_KEY)).toBe(true);
  });

  it('discards corrupted session JSON', () => {
    const storage = createStorage(memoryBackend({ [SESSION_KEY]: '{not json' }));

    expect(storage.loadSession()).toBeNull();
  });

  it('discards invalid session payloads', () => {
    const storage = createStorage(
      memoryBackend({ [SESSION_KEY]: JSON.stringify({ board: [[1]], score: 0, status: 'playing' }) })
    );

    expect(storage.loadSession()).toBeNull();
  });

  it('refuses to save an invalid snapshot', () => {
    const backend = memoryBackend();
    const storage = createStorage(backend);

    expect(storage.saveSession({ ...validSnapshot(), status: 'broken' })).toBe(false);
    expect(backend.data.has(SESSION_KEY)).toBe(false);
  });

  it('stores and loads the best score', () => {
    const backend = memoryBackend();
    const storage = createStorage(backend);

    expect(storage.loadBest()).toBe(0);
    expect(storage.saveBest(1234.9)).toBe(true);
    expect(storage.loadBest()).toBe(1234);
    expect(backend.data.get(BEST_KEY)).toBe('1234');
  });

  it('ignores invalid best scores', () => {
    const storage = createStorage(memoryBackend({ [BEST_KEY]: 'not-a-number' }));

    expect(storage.loadBest()).toBe(0);
    expect(storage.saveBest(Number.NaN)).toBe(false);
    expect(storage.saveBest(-5)).toBe(false);
  });

  it('works without a backend available', () => {
    const storage = createStorage(null);

    expect(storage.loadSession()).toBeNull();
    expect(storage.loadBest()).toBe(0);
    expect(storage.saveSession(validSnapshot())).toBe(false);
    expect(storage.saveBest(10)).toBe(false);
    expect(() => storage.clear()).not.toThrow();
  });

  it('survives a backend that throws', () => {
    const storage = createStorage({
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
      removeItem() {
        throw new Error('blocked');
      }
    });

    expect(storage.loadSession()).toBeNull();
    expect(storage.loadBest()).toBe(0);
    expect(storage.saveBest(10)).toBe(false);
    expect(storage.saveSession(validSnapshot())).toBe(false);
    expect(() => storage.clear()).not.toThrow();
  });

  it('clears both keys', () => {
    const backend = memoryBackend({
      [SESSION_KEY]: JSON.stringify(validSnapshot()),
      [BEST_KEY]: '99'
    });
    const storage = createStorage(backend);

    storage.clear();

    expect(backend.data.size).toBe(0);
  });
});
