<script lang="ts">
  import { accountsStore } from '$lib/stores/accounts.svelte';
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import { transactionsStore } from '$lib/stores/transactions.svelte';
  import { parseCsv, type CsvRow } from '$lib/utils/csv';
  import { formatCents } from '$lib/domain/money';
  import Dialog from '../ui/Dialog.svelte';
  import Button from '../ui/Button.svelte';
  import Field from '../ui/Field.svelte';

  let { open, onclose }: { open: boolean; onclose: () => void } = $props();

  let rows = $state<CsvRow[]>([]);
  let errors = $state<string[]>([]);
  let missing = $state<string[]>([]);
  let defaultAccountId = $state('');
  let imported = $state<number | null>(null);
  let working = $state(false);
  let lastOpen = false;

  $effect(() => {
    if (open && !lastOpen) {
      rows = [];
      errors = [];
      missing = [];
      imported = null;
      defaultAccountId = accountsStore.accounts[0]?.id ?? '';
    }
    lastOpen = open;
  });

  const accounts = $derived(accountsStore.accounts);
  const existingIds = $derived(new Set(transactionsStore.transactions.map((t) => t.import_id)));
  const duplicates = $derived(rows.filter((r) => existingIds.has(r.import_id)).length);
  const newCategories = $derived(
    [...new Set(rows.map((r) => r.category).filter((c) => c && !categoriesStore.categories.some((x) => x.name.toLowerCase() === c.toLowerCase())))]
  );

  async function onFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    const parsed = parseCsv(await file.text());
    rows = parsed.rows;
    errors = parsed.errors;
    missing = parsed.missingColumns;
  }

  function accountIdFor(name: string): string {
    const match = accounts.find((a) => a.name.toLowerCase() === name.toLowerCase());
    return match?.id ?? defaultAccountId;
  }

  async function categoryIdFor(name: string, group: string): Promise<string | null> {
    if (!name) return null;
    const existing = categoriesStore.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    let groupId: string | null = null;
    if (group) {
      const g = categoriesStore.groups.find((x) => x.name.toLowerCase() === group.toLowerCase());
      groupId = g ? g.id : (await categoriesStore.addGroup(group)).id;
    }
    const created = await categoriesStore.add({ group_id: groupId, name, monthly_target: null });
    return created.id;
  }

  async function runImport() {
    working = true;
    const inputs = [];
    for (const r of rows) {
      if (existingIds.has(r.import_id)) continue;
      const accountId = accountIdFor(r.account);
      const categoryId = r.type === 'expense' || r.type === 'income' ? await categoryIdFor(r.category, r.group) : null;
      inputs.push({
        date: r.date,
        amount: r.amount,
        account_id: accountId,
        category_id: categoryId,
        type: r.type,
        description: r.description,
        notes: r.notes,
        tags: r.tags,
        excluded_from_budget: r.excluded,
        import_id: r.import_id
      });
    }
    imported = await transactionsStore.importRows(inputs);
    working = false;
  }
</script>

<Dialog {open} title="Import transactions from CSV" {onclose}>
  <div class="form">
    <p class="muted">
      Same columns as the export. Required: <code>Date</code>, <code>Amount</code>, <code>Description</code>.
      Rows already in YNBB (same date, amount, description and account) are skipped.
    </p>
    <Field label="CSV file"><input type="file" accept=".csv,text/csv" onchange={onFile} /></Field>

    {#if missing.length > 0}
      <p class="error" role="alert">Missing column(s): {missing.join(', ')}</p>
    {/if}

    {#if rows.length > 0}
      <Field label="Account for rows without an account name">
        <select bind:value={defaultAccountId}>
          {#each accounts as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
        </select>
      </Field>
      <p>
        {rows.length} rows read. <strong>{duplicates}</strong> already imported (will be skipped).
        {#if newCategories.length > 0}
          <br />New categories to create: {newCategories.join(', ')}.
        {/if}
      </p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {#each rows.slice(0, 50) as r (r.import_id + r.date)}
              <tr>
                <td>{r.date}</td>
                <td>{r.description}</td>
                <td>{r.category || '—'}</td>
                <td class:neg={r.amount < 0}>{formatCents(r.amount)}</td>
                <td>{existingIds.has(r.import_id) ? 'Duplicate' : 'New'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if rows.length > 50}<p class="muted">Showing the first 50 rows.</p>{/if}
    {/if}

    {#if errors.length > 0}
      <ul class="errors">{#each errors.slice(0, 5) as e (e)}<li>{e}</li>{/each}</ul>
    {/if}

    {#if imported !== null}
      <p class="ok">Imported {imported} transactions.</p>
    {/if}

    <div class="actions">
      <Button variant="secondary" onclick={onclose}>Close</Button>
      <Button onclick={() => void runImport()} disabled={rows.length === 0 || missing.length > 0 || working}>
        Import {rows.length - duplicates} transactions
      </Button>
    </div>
  </div>
</Dialog>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: min(640px, 92vw);
  }
  .table-wrap {
    overflow-x: auto;
    max-height: 320px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-sm);
  }
  th,
  td {
    padding: var(--space-1) var(--space-2);
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
  }
  .neg {
    color: var(--color-negative);
  }
  .muted {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    margin: 0;
  }
  .error {
    color: var(--color-negative);
  }
  .ok {
    color: var(--color-positive);
  }
  .errors {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
