<script lang="ts">
  import { transactionsStore } from '$lib/stores/transactions.svelte';
  import { accountsStore } from '$lib/stores/accounts.svelte';
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import { downloadTextFile, transactionsToCsv } from '$lib/utils/csv';
  import { todayIso } from '$lib/utils/date';
  import ImportPreview from '../transactions/ImportPreview.svelte';
  import Card from '../ui/Card.svelte';
  import Button from '../ui/Button.svelte';

  let importOpen = $state(false);

  function exportCsv() {
    const csv = transactionsToCsv(transactionsStore.transactions, {
      accounts: accountsStore.accounts,
      categories: categoriesStore.categories,
      groups: categoriesStore.groups
    });
    downloadTextFile(`ynbb-transactions-${todayIso()}.csv`, csv);
  }
</script>

<Card>
  <h2>Import & export</h2>
  <div class="row">
    <div>
      <h3>Import</h3>
      <p class="muted">Import a CSV in the same format as the export. You see a preview first, and duplicates are skipped.</p>
    </div>
    <Button variant="secondary" onclick={() => (importOpen = true)}>Import CSV</Button>
  </div>
  <div class="row">
    <div>
      <h3>Export</h3>
      <p class="muted">Download all transactions as CSV (columns as in the spec §7 header).</p>
    </div>
    <Button
      variant="secondary"
      onclick={exportCsv}
      disabled={transactionsStore.transactions.length === 0}
    >
      Export CSV
    </Button>
  </div>
</Card>

<ImportPreview open={importOpen} onclose={() => (importOpen = false)} />

<style>
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3) 0;
    border-top: 1px solid var(--color-border);
  }
  .row:first-of-type {
    border-top: none;
  }
  .row h3 {
    margin: 0 0 var(--space-1);
    font-size: var(--font-size-base);
  }
  .muted {
    color: var(--color-text-secondary);
    margin: 0;
  }
</style>
