import { getTokenState, initAuth, signIn, signOut } from '$lib/storage/auth';
import { getSpreadsheetId } from '$lib/storage/sync';
import {
  resolveFromEnvironment,
  writeStoredClientId,
  type ClientIdSource
} from '$lib/config/client-id';

function createAuthStore() {
  let connected = $state(false);
  let spreadsheetId = $state<string | null>(null);
  let needsReconnect = $state(false);
  let busy = $state(false);

  const initial = resolveFromEnvironment();
  let clientId = $state(initial.id);
  let clientIdSource = $state<ClientIdSource>(initial.source);
  initAuth(clientId);

  /** Saves a Settings value. Ignored when the build or runtime config already sets an ID. */
  function setClientId(value: string): boolean {
    if (clientIdSource === 'runtime' || clientIdSource === 'build') return false;
    if (!writeStoredClientId(value)) return false;
    const next = resolveFromEnvironment();
    clientId = next.id;
    clientIdSource = next.source;
    initAuth(clientId);
    return true;
  }

  async function load() {
    spreadsheetId = await getSpreadsheetId();
    connected = Boolean(getTokenState());
  }

  async function connect(): Promise<void> {
    busy = true;
    try {
      await signIn();
      connected = true;
      needsReconnect = false;
    } finally {
      busy = false;
    }
  }

  function disconnect(): void {
    signOut();
    connected = false;
  }

  function markNeedsReconnect(): void {
    needsReconnect = true;
    connected = false;
  }

  return {
    get configured() {
      return Boolean(clientId);
    },
    get clientId() {
      return clientId;
    },
    get clientIdSource() {
      return clientIdSource;
    },
    setClientId,
    get connected() {
      return connected;
    },
    get spreadsheetId() {
      return spreadsheetId;
    },
    get needsReconnect() {
      return needsReconnect;
    },
    get busy() {
      return busy;
    },
    setSpreadsheetId(id: string | null) {
      spreadsheetId = id;
    },
    load,
    connect,
    disconnect,
    markNeedsReconnect
  };
}

export const authStore = createAuthStore();
