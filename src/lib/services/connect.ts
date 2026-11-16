import { authStore } from '$lib/stores/auth.svelte';
import { syncStore } from '$lib/stores/sync.svelte';
import { connectSpreadsheet } from '$lib/storage/sync';

/**
 * Google sign-in plus the "YNBB Budget" sheet. Used by the landing page,
 * the sign-in page and Settings > Data Source, so all three do the same thing.
 * Throws with a readable message on failure (also shown in the sync status).
 */
export async function connectGoogleSheet(): Promise<void> {
  try {
    await authStore.connect();
    const id = await connectSpreadsheet();
    authStore.setSpreadsheetId(id);
    syncStore.setStatus('idle');
    syncStore.setLastSyncedAt(new Date().toISOString());
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Connection failed';
    syncStore.setStatus('error', message);
    throw new Error(message);
  }
}
