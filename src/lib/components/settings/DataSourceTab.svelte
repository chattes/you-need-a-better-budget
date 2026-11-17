<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { syncStore } from '$lib/stores/sync.svelte';
  import { syncNow } from '$lib/storage/sync';
  import { connectGoogleSheet } from '$lib/services/connect';
  import Card from '../ui/Card.svelte';
  import Button from '../ui/Button.svelte';
  import Field from '../ui/Field.svelte';
  import { sampleStore } from '$lib/stores/sample.svelte';
  import { cleanClientId } from '$lib/config/client-id';

  let working = $state(false);
  let message = $state('');
  let conflicts = $state<Array<{ entity: string; id: string; kept: string }>>([]);
  let clientIdInput = $state('');
  let clientIdMessage = $state('');

  onMount(() => {
    clientIdInput = authStore.clientId;
    void authStore.load();
  });

  function saveClientId() {
    clientIdMessage = '';
    const raw = clientIdInput.trim();
    if (raw && !cleanClientId(raw)) {
      clientIdMessage =
        'That does not look like a Google client ID. It ends in .apps.googleusercontent.com and has no spaces.';
      return;
    }
    if (!authStore.setClientId(raw)) {
      clientIdMessage = 'Could not save. Browser storage may be blocked.';
      return;
    }
    clientIdMessage = raw ? 'Saved on this device.' : 'Cleared on this device.';
  }

  async function handleConnect() {
    if (sampleStore.active) {
      message = 'Sample data is loaded. Clear it first, then connect Google Sheets.';
      return;
    }
    working = true;
    message = '';
    try {
      await connectGoogleSheet();
      message = 'Connected. Created the “YNBB Budget” spreadsheet in your Drive.';
    } catch (e) {
      message = e instanceof Error ? e.message : 'Connection failed';
    } finally {
      working = false;
    }
  }

  async function handleSync() {
    working = true;
    message = '';
    conflicts = [];
    syncStore.setStatus('syncing');
    try {
      const result = await syncNow((c) => (conflicts = [...conflicts, c]));
      syncStore.setStatus('idle');
      syncStore.setLastSyncedAt(new Date().toISOString());
      message = `Synced. Pulled ${result.pulled}, pushed ${result.pushed}.`;
      await syncStore.refreshPending();
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Sync failed';
      message = text;
      syncStore.setStatus('error', text);
      if (/401|token|auth/i.test(text)) authStore.markNeedsReconnect();
    } finally {
      working = false;
    }
  }
</script>

<Card>
  <h2>Google client ID</h2>
  {#if authStore.clientIdSource === 'runtime'}
    <p class="muted">
      Self-hosters set the <code>GOOGLE_CLIENT_ID</code> environment variable on the Docker container
      (see <a href="docs/self-hosting.md">docs/self-hosting.md</a>); or paste the ID in the field here.
    </p>
  {:else if authStore.clientIdSource === 'build'}
    <p class="muted">Set at build time (VITE_GOOGLE_CLIENT_ID). Change it there. At Docker runtime the container reads <code>GOOGLE_CLIENT_ID</code>.</p>
  {:else}
    <p class="muted">
      Needed only for Google Sheets sync. The value is saved in this browser only.
      <a
        href="https://github.com/chattes/you-need-a-better-budget/blob/main/docs/google-client-id.md"
        target="_blank"
        rel="noopener noreferrer">How to get a client ID</a
      >
    </p>
    <Field label="Client ID">
      <input
        bind:value={clientIdInput}
        placeholder="123456789-abc.apps.googleusercontent.com"
        autocomplete="off"
        spellcheck="false"
      />
    </Field>
    <div class="actions">
      <Button onclick={saveClientId}>Save client ID</Button>
    </div>
  {/if}
  {#if clientIdMessage}<p class="message">{clientIdMessage}</p>{/if}
</Card>

<Card>
  <h2>Data source</h2>
  {#if !authStore.configured}
    <Button disabled>Connect Google Sheets</Button>
    <p class="muted">Sync not set up. Add a Google client ID above to enable it.</p>
  {:else if !authStore.spreadsheetId}
    <p class="muted">
      Your budget lives in a Google Sheet you own. Connect to create it, or keep working
      offline — nothing leaves this browser until you connect.
    </p>
    <Button onclick={() => void handleConnect()} disabled={working || sampleStore.active}>
      Connect Google Sheet
    </Button>
    {#if sampleStore.active}
      <p class="muted">Sample data is loaded, so connecting is paused. Clear sample data below first.</p>
    {/if}
  {:else}
    <dl class="details">
      <dt>Spreadsheet</dt>
      <dd><code>{authStore.spreadsheetId}</code></dd>
      <dt>Pending changes</dt>
      <dd>{syncStore.pendingCount}</dd>
    </dl>
    {#if authStore.needsReconnect}
      <p class="warning" role="alert">Your Google session expired. Reconnect to resume sync.</p>
    {/if}
    <div class="actions">
      <Button onclick={() => void handleSync()} disabled={working || authStore.needsReconnect}>
        Sync now
      </Button>
      <Button variant="secondary" onclick={() => void handleConnect()} disabled={working}>
        Reconnect
      </Button>
    </div>
  {/if}
  {#if message}<p class="message">{message}</p>{/if}
  {#each conflicts as conflict (conflict.entity + conflict.id)}
    <p class="conflict" role="alert">
      Conflict on {conflict.entity} ({conflict.id.slice(0, 8)}…). Used the cloud version.
    </p>
  {/each}
</Card>

<style>
  .details {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-2) var(--space-4);
    margin: 0 0 var(--space-4);
  }
  .details dt {
    color: var(--color-text-secondary);
  }
  .details dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .muted {
    color: var(--color-text-secondary);
  }
  .warning {
    color: var(--color-warning);
  }
  .message {
    margin-top: var(--space-3);
  }
  .conflict {
    color: var(--color-warning);
  }
  .actions {
    display: flex;
    gap: var(--space-2);
  }
</style>
