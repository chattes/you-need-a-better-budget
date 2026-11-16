// Google OAuth client ID resolution.
//
// Order (first valid value wins):
//   1. window.__YNBB_CONFIG__.googleClientId  (public/config.js, written at container start)
//   2. import.meta.env.VITE_GOOGLE_CLIENT_ID  (build time, e.g. Vercel or .env.local)
//   3. value pasted in Settings, kept in localStorage on this device only

export const CLIENT_ID_STORAGE_KEY = 'ynbb.googleClientId';

export type ClientIdSource = 'runtime' | 'build' | 'settings' | 'none';

export interface ResolvedClientId {
  id: string;
  source: ClientIdSource;
}

declare global {
  interface Window {
    __YNBB_CONFIG__?: { googleClientId?: unknown };
  }
}

const MAX_LENGTH = 200;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

/** Returns the trimmed client ID, or '' when the value is missing or not shaped like a client ID. */
export function cleanClientId(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_LENGTH) return '';
  return CLIENT_ID_PATTERN.test(trimmed) ? trimmed : '';
}

export interface ClientIdInputs {
  runtime?: unknown;
  build?: unknown;
  stored?: unknown;
}

/** Pure resolver: runtime config, then build-time env, then the Settings value. */
export function resolveGoogleClientId(inputs: ClientIdInputs): ResolvedClientId {
  const runtime = cleanClientId(inputs.runtime);
  if (runtime) return { id: runtime, source: 'runtime' };
  const build = cleanClientId(inputs.build);
  if (build) return { id: build, source: 'build' };
  const stored = cleanClientId(inputs.stored);
  if (stored) return { id: stored, source: 'settings' };
  return { id: '', source: 'none' };
}

/** Reads window.__YNBB_CONFIG__ safely. Returns '' when missing. */
export function readRuntimeClientId(win: Window | undefined = globalThis.window): string {
  try {
    return cleanClientId(win?.__YNBB_CONFIG__?.googleClientId);
  } catch {
    return '';
  }
}

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Reads the Settings value. Blocked or missing storage counts as empty. */
export function readStoredClientId(store: KeyValueStore | null = defaultStore()): string {
  try {
    return cleanClientId(store?.getItem(CLIENT_ID_STORAGE_KEY));
  } catch {
    return '';
  }
}

/** Saves the Settings value. Returns false when the value is invalid or storage fails. */
export function writeStoredClientId(
  value: string,
  store: KeyValueStore | null = defaultStore()
): boolean {
  const cleaned = cleanClientId(value);
  try {
    if (!store) return false;
    if (cleaned) {
      store.setItem(CLIENT_ID_STORAGE_KEY, cleaned);
    } else {
      store.removeItem(CLIENT_ID_STORAGE_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

/** Resolves the ID for this page load using the real runtime, build env and localStorage. */
export function resolveFromEnvironment(): ResolvedClientId {
  return resolveGoogleClientId({
    runtime: readRuntimeClientId(),
    build: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    stored: readStoredClientId()
  });
}
