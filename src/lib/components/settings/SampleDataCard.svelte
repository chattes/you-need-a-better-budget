<script lang="ts">
  import { sampleStore } from '$lib/stores/sample.svelte';
  import Card from '../ui/Card.svelte';
  import Button from '../ui/Button.svelte';

  let working = $state(false);
  let message = $state('');

  async function load() {
    working = true;
    message = '';
    try {
      await sampleStore.load();
      message = 'Sample data loaded. Clear it here when you are done.';
    } catch (e) {
      message = e instanceof Error ? e.message : 'Could not load sample data.';
    } finally {
      working = false;
    }
  }

  async function clear() {
    working = true;
    message = '';
    try {
      await sampleStore.clear();
      message = 'Sample data cleared. Your own data was not touched.';
    } catch (e) {
      message = e instanceof Error ? e.message : 'Could not clear sample data.';
    } finally {
      working = false;
    }
  }
</script>

<Card>
  <h2>Test mode</h2>
  <p class="muted">
    Load a realistic demo budget (three accounts, ten categories, transactions with a split, a transfer and a card payment, two goals) to try every feature. Nothing is sent to Google while sample data is loaded.
  </p>
  {#if sampleStore.active}
    <p class="note">Sample data is loaded. Google Sheets connect and sync are paused until you clear it.</p>
    <Button variant="danger" onclick={() => void clear()} disabled={working}>Clear sample data</Button>
  {:else}
    <Button variant="secondary" onclick={() => void load()} disabled={working}>Try with sample data</Button>
  {/if}
  {#if message}<p class="message" role="status">{message}</p>{/if}
</Card>

<style>
  h2 {
    font-size: var(--font-size-base);
    margin: 0 0 var(--space-2);
  }
  .muted,
  .message {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  .note {
    color: var(--color-warning);
    font-size: var(--font-size-sm);
  }
</style>
