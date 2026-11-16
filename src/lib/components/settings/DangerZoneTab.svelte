<script lang="ts">
  import Card from '../ui/Card.svelte';
  import Button from '../ui/Button.svelte';
  import Dialog from '../ui/Dialog.svelte';

  let confirmOpen = $state(false);
  let confirmText = $state('');
  let error = $state('');

  async function clearLocalData() {
    if (confirmText !== 'DELETE') {
      error = 'Type DELETE to confirm.';
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('ynbb');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve(); // reload will complete the reset
    });
    localStorage.clear();
    location.reload();
  }
</script>

<Card>
  <h2>Danger zone</h2>
  <div class="row">
    <div>
      <h3>Clear local data</h3>
      <p class="muted">
        Deletes every account, category, transaction and setting stored in this browser.
        Data already synced to your Google Sheet is not touched. This cannot be undone.
      </p>
    </div>
    <Button variant="danger" onclick={() => { confirmOpen = true; confirmText = ''; error = ''; }}>
      Clear local data
    </Button>
  </div>
</Card>

<Dialog open={confirmOpen} title="Clear all local data?" onclose={() => (confirmOpen = false)}>
  <p>This wipes the offline copy of your budget in this browser. Type <strong>DELETE</strong> to confirm.</p>
  <input bind:value={confirmText} aria-label="Type DELETE to confirm" />
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <div class="actions">
    <Button variant="danger" onclick={() => void clearLocalData()}>Clear everything</Button>
  </div>
</Dialog>

<style>
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-4);
  }
  .row h3 {
    margin: 0 0 var(--space-1);
    font-size: var(--font-size-base);
  }
  .muted {
    color: var(--color-text-secondary);
    margin: 0;
  }
  .error {
    color: var(--color-negative);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--space-4);
  }
  input {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface);
    color: var(--color-text);
  }
</style>
