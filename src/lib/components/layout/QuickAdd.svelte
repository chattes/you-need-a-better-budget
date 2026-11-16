<script lang="ts">
  import { accountsStore } from '$lib/stores/accounts.svelte';
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import { transactionsStore } from '$lib/stores/transactions.svelte';
  import { parseToCents } from '$lib/domain/money';
  import { todayIso } from '$lib/utils/date';
  import Dialog from '../ui/Dialog.svelte';
  import Button from '../ui/Button.svelte';
  import Field from '../ui/Field.svelte';
  import AddTransactionDialog from '../transactions/AddTransactionDialog.svelte';

  let { open, onclose }: { open: boolean; onclose: () => void } = $props();

  let kind = $state<'expense' | 'income'>('expense');
  let amount = $state('');
  let description = $state('');
  let categoryId = $state('');
  let accountId = $state('');
  let date = $state(todayIso());
  let error = $state('');
  let moreOpen = $state(false);

  let accounts = $derived(accountsStore.accounts.filter((a) => !a.deleted_at && !a.is_closed));
  let categories = $derived(categoriesStore.activeCategories);

  async function save() {
    error = '';
    const cents = parseToCents(amount);
    if (cents === null || cents <= 0) {
      error = 'Enter an amount greater than 0.';
      return;
    }
    if (!accountId) {
      error = 'Pick an account.';
      return;
    }
    await transactionsStore.add({
      date,
      amount: kind === 'expense' ? -cents : cents,
      account_id: accountId,
      category_id: kind === 'expense' ? categoryId || null : null,
      type: kind,
      description
    });
    amount = '';
    description = '';
    onclose();
  }
</script>

<Dialog {open} title="Quick add" {onclose}>
  <form
    class="quick-add"
    onsubmit={(e) => {
      e.preventDefault();
      void save();
    }}
  >
    <div class="chips" role="group" aria-label="Type">
      <button type="button" class:on={kind === 'expense'} onclick={() => (kind = 'expense')}>Expense</button>
      <button type="button" class:on={kind === 'income'} onclick={() => (kind = 'income')}>Income</button>
    </div>
    <Field label="Amount"><input inputmode="decimal" bind:value={amount} placeholder="0.00" required /></Field>
    <Field label="Description"><input bind:value={description} placeholder="Payee or note" /></Field>
    {#if kind === 'expense'}
      <Field label="Category">
        <select bind:value={categoryId}>
          <option value="">No category</option>
          {#each categories as c (c.id)}
            <option value={c.id}>{c.name}</option>
          {/each}
        </select>
      </Field>
    {/if}
    <Field label="Account">
      <select bind:value={accountId} required>
        <option value="">Choose…</option>
        {#each accounts as a (a.id)}
          <option value={a.id}>{a.name}</option>
        {/each}
      </select>
    </Field>
    <Field label="Date"><input type="date" bind:value={date} /></Field>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="actions">
      <Button variant="secondary" onclick={() => (moreOpen = true)}>More options</Button>
      <Button type="submit">Add</Button>
    </div>
  </form>
</Dialog>

<AddTransactionDialog open={moreOpen} onclose={() => (moreOpen = false)} />

<style>
  .quick-add {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: min(360px, 90vw);
  }
  .chips {
    display: flex;
    gap: var(--space-2);
  }
  .chips button {
    flex: 1;
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
  }
  .chips button.on {
    border-color: var(--color-primary);
    color: var(--color-primary);
    font-weight: 600;
  }
  .actions {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .error {
    color: var(--color-negative);
    margin: 0;
  }
</style>
