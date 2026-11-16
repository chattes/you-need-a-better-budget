<script lang="ts">
  import { accountsStore } from '$lib/stores/accounts.svelte';
  import { formatCents, parseToCents } from '$lib/domain/money';
  import type { AccountType } from '$lib/domain/types';
  import Button from '../ui/Button.svelte';
  import Field from '../ui/Field.svelte';

  const TYPES: Array<{ value: AccountType; label: string }> = [
    { value: 'chequing', label: 'Chequing' },
    { value: 'savings', label: 'Savings' },
    { value: 'cash', label: 'Cash' },
    { value: 'credit_card', label: 'Credit card' }
  ];

  let name = $state('');
  let type = $state<AccountType>('chequing');
  let balance = $state('');
  let error = $state('');

  async function add() {
    error = '';
    if (!name.trim()) {
      error = 'Enter an account name.';
      return;
    }
    const cents = parseToCents(balance || '0');
    if (cents === null) {
      error = 'Enter a balance, or leave it blank.';
      return;
    }
    await accountsStore.add({ name, type, balance: cents });
    name = '';
    balance = '';
  }
</script>

<section class="accounts">
  <h2>Accounts</h2>
  <p class="muted">Manual accounts only. Transactions are entered by hand or imported from CSV.</p>
  {#if accountsStore.accounts.length === 0}
    <p class="muted">No accounts yet.</p>
  {:else}
    <ul>
      {#each accountsStore.accounts as a (a.id)}
        <li><span>{a.name}</span><span class="muted">{a.type.replace('_', ' ')}</span><span>{formatCents(a.balance)}</span></li>
      {/each}
    </ul>
  {/if}
  <form
    class="add"
    onsubmit={(e) => {
      e.preventDefault();
      void add();
    }}
  >
    <Field label="Name"><input bind:value={name} required /></Field>
    <Field label="Type">
      <select bind:value={type}>
        {#each TYPES as t (t.value)}
          <option value={t.value}>{t.label}</option>
        {/each}
      </select>
    </Field>
    <Field label="Starting balance"><input inputmode="decimal" bind:value={balance} placeholder="0.00" /></Field>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <Button type="submit">Add Account</Button>
  </form>
</section>

<style>
  .accounts {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  h2 {
    font-size: var(--font-size-base);
    margin: 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  li {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: var(--space-3);
  }
  .add {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-width: 24rem;
  }
  .muted {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    margin: 0;
  }
  .error {
    color: var(--color-negative);
    margin: 0;
  }
</style>
