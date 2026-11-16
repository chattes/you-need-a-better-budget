import { getOutbox } from '$lib/storage/indexeddb';

export type SyncStatus = 'offline' | 'idle' | 'syncing' | 'error' | 'conflict';

function createSyncStore() {
  let status = $state<SyncStatus>('idle');
  let pendingCount = $state(0);
  let lastSyncedAt = $state<string | null>(null);
  let lastMessage = $state('');

  async function refreshPending() {
    const outbox = await getOutbox();
    pendingCount = outbox.length;
  }

  return {
    get status() {
      return status;
    },
    get pendingCount() {
      return pendingCount;
    },
    get lastSyncedAt() {
      return lastSyncedAt;
    },
    get lastMessage() {
      return lastMessage;
    },
    setStatus(next: SyncStatus, message = '') {
      status = next;
      lastMessage = message;
    },
    setLastSyncedAt(value: string) {
      lastSyncedAt = value;
    },
    refreshPending
  };
}

export const syncStore = createSyncStore();
