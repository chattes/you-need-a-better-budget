// Google Identity Services token-client wrapper. Never stores tokens in
// localStorage; access token is held in memory with its expiry in IndexedDB.

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

let gisLoaded: Promise<void> | null = null;

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type: string }) => void;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface GoogleAccounts {
  accounts: {
    oauth2: {
      initTokenClient(config: TokenClientConfig): TokenClient;
      revoke(token: string, done: () => void): void;
    };
  };
}

function getGoogle(): GoogleAccounts {
  const g = (globalThis as { google?: GoogleAccounts }).google;
  if (!g) throw new Error('Google Identity Services not loaded');
  return g;
}

export function loadGis(): Promise<void> {
  if (!gisLoaded) {
    gisLoaded = new Promise((resolve, reject) => {
      if ((globalThis as { google?: unknown }).google) return resolve();
      const script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    });
  }
  return gisLoaded;
}

export interface TokenState {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let tokenClient: TokenClient | null = null;
let tokenState: TokenState | null = null;
let refreshInFlight: Promise<TokenState> | null = null;

function requestToken(prompt: '' | 'consent'): Promise<TokenState> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject(new Error('Token client not initialized'));
    tokenClient = getGoogle().accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? 'No access token'));
          return;
        }
        tokenState = {
          accessToken: response.access_token,
          expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000
        };
        resolve(tokenState);
      },
      error_callback: (error) => reject(new Error(error.type))
    });
    tokenClient.requestAccessToken({ prompt });
  });
}

let clientId = '';

export function initAuth(id: string): void {
  clientId = id;
}

export function getTokenState(): TokenState | null {
  return tokenState;
}

/** Interactive sign-in (user clicks Connect). */
export async function signIn(): Promise<TokenState> {
  await loadGis();
  return requestToken('consent');
}

/**
 * Returns a valid access token, silently refreshing when expired (or within
 * 5 minutes of expiry). Throws when a silent refresh is impossible — the UI
 * should then show the Reconnect banner.
 */
export async function getValidToken(): Promise<string> {
  if (tokenState && tokenState.expiresAt - 5 * 60 * 1000 > Date.now()) {
    return tokenState.accessToken;
  }
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      await loadGis();
      return requestToken('');
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  const state = await refreshInFlight;
  return state.accessToken;
}

export function signOut(): void {
  if (tokenState) {
    try {
      getGoogle().accounts.oauth2.revoke(tokenState.accessToken, () => undefined);
    } catch {
      // best effort
    }
  }
  tokenState = null;
}

/** Fetch helper that retries once after refreshing the token on 401. */
export async function googleFetch(
  url: string,
  init: RequestInit = {},
  retried = false
): Promise<Response> {
  const token = await getValidToken();
  const response = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` }
  });
  if (response.status === 401 && !retried) {
    tokenState = null;
    return googleFetch(url, init, true);
  }
  return response;
}
