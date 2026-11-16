import { describe, expect, it } from 'vitest';
import {
  CLIENT_ID_STORAGE_KEY,
  cleanClientId,
  readRuntimeClientId,
  readStoredClientId,
  resolveGoogleClientId,
  writeStoredClientId
} from '$lib/config/client-id';

const RUNTIME = '111-runtime.apps.googleusercontent.com';
const BUILD = '222-build.apps.googleusercontent.com';
const STORED = '333-settings.apps.googleusercontent.com';

class MemoryStore {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

class ThrowingStore {
  getItem(): string | null {
    throw new Error('blocked');
  }
  setItem(): void {
    throw new Error('blocked');
  }
  removeItem(): void {
    throw new Error('blocked');
  }
}

describe('resolveGoogleClientId', () => {
  it('prefers the runtime config over build env and Settings', () => {
    expect(resolveGoogleClientId({ runtime: RUNTIME, build: BUILD, stored: STORED })).toEqual({
      id: RUNTIME,
      source: 'runtime'
    });
  });

  it('uses the build env when runtime config is empty', () => {
    expect(resolveGoogleClientId({ runtime: '', build: BUILD, stored: STORED })).toEqual({
      id: BUILD,
      source: 'build'
    });
  });

  it('uses the Settings value when neither runtime nor build is set', () => {
    expect(resolveGoogleClientId({ runtime: undefined, build: '', stored: STORED })).toEqual({
      id: STORED,
      source: 'settings'
    });
  });

  it('returns none when nothing is set', () => {
    expect(resolveGoogleClientId({})).toEqual({ id: '', source: 'none' });
  });

  it('skips an invalid runtime value and falls through to build', () => {
    expect(
      resolveGoogleClientId({ runtime: 'not a client id!', build: BUILD, stored: STORED })
    ).toEqual({ id: BUILD, source: 'build' });
  });
});

describe('cleanClientId', () => {
  it('trims whitespace from a valid ID', () => {
    expect(cleanClientId(`  ${RUNTIME}\n`)).toBe(RUNTIME);
  });

  it('rejects non-strings, empty values, spaces and markup characters', () => {
    expect(cleanClientId(undefined)).toBe('');
    expect(cleanClientId(null)).toBe('');
    expect(cleanClientId(42)).toBe('');
    expect(cleanClientId('   ')).toBe('');
    expect(cleanClientId('abc def')).toBe('');
    expect(cleanClientId('abc"</script><script>')).toBe('');
  });

  it('rejects values longer than 200 characters', () => {
    expect(cleanClientId('a'.repeat(201))).toBe('');
    expect(cleanClientId('a'.repeat(200))).toBe('a'.repeat(200));
  });
});

describe('readRuntimeClientId', () => {
  it('reads googleClientId from window.__YNBB_CONFIG__', () => {
    const win = { __YNBB_CONFIG__: { googleClientId: RUNTIME } } as unknown as Window;
    expect(readRuntimeClientId(win)).toBe(RUNTIME);
  });

  it('returns empty when config is missing or the window is undefined', () => {
    expect(readRuntimeClientId({} as Window)).toBe('');
    expect(readRuntimeClientId(undefined)).toBe('');
  });
});

describe('stored client ID', () => {
  it('writes, reads and clears the value', () => {
    const store = new MemoryStore();
    expect(writeStoredClientId(` ${STORED} `, store)).toBe(true);
    expect(store.data.get(CLIENT_ID_STORAGE_KEY)).toBe(STORED);
    expect(readStoredClientId(store)).toBe(STORED);
    expect(writeStoredClientId('', store)).toBe(true);
    expect(readStoredClientId(store)).toBe('');
  });

  it('refuses to store an invalid value', () => {
    const store = new MemoryStore();
    writeStoredClientId(STORED, store);
    writeStoredClientId('bad value', store);
    expect(store.data.has(CLIENT_ID_STORAGE_KEY)).toBe(false);
  });

  it('treats blocked or missing storage as empty and never throws', () => {
    expect(readStoredClientId(new ThrowingStore())).toBe('');
    expect(readStoredClientId(null)).toBe('');
    expect(writeStoredClientId(STORED, new ThrowingStore())).toBe(false);
    expect(writeStoredClientId(STORED, null)).toBe(false);
  });
});
