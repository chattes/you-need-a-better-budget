<script lang="ts">
  import { accountsStore } from '$lib/stores/accounts.svelte';
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import { transactionsStore } from '$lib/stores/transactions.svelte';
  import { formatCents } from '$lib/domain/money';
  import type { Transaction } from '$lib/domain/types';
  import Button from '$lib/components/ui/Button.svelte';
  import AddTransactionDialog from '$lib/components/transactions/AddTransactionDialog.svelte';
  import { ArrowLeft, Plus } from 'lucide-svelte';

  let { params }: { params: { id: string } } = $props();

  let addOpen = $state(false);

  let account = $derived(accountsStore.accounts.find((a) => a.id === params.id));

  // Split children are hidden — the parent row carries the full amount.
  let rows = $derived(
    transactionsStore.transactions
      .filter((t) => t.account_id === params.id && !t.split_parent_id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
  );

  // Running balance: start from the derived starting balance (current balance
  // minus all live transactions), then accumulate in date order.
  let balanceAfter = $derived.by(() => {
    const map = new Map<string, number>();
    if (!account) return map;
    const start = account.balance - rows.reduce((sum, t) => sum + t.amount, 0);
    let running = start;
    for (const t of rows) {
      running += t.amount;
      map.set(t.id, running);
    }
    return map;
  });

  let displayRows = $derived([...rows].reverse());

  function categoryName(t: Transaction): string {
    if (t.type === 'transfer') return 'Transfer';
    if (!t.category_id) return '—';
    return categoriesStore.categories.find((c) => c.id === t.category_id)?.name ?? '—';
  }

  async function toggleCleared(t: Transaction): Promise<void> {
    await transactionsStore.update(t.id, { cleared: !t.cleared });
  }
</script>

{#if !account}
  <header class="page-header"><h1>Account not found</h1></header>
  <p><a href="#/">← Back to dashboard</a></p>
{:else}
  <header class="page-header">
    <div>
      <a class="back" href="#/" aria-label="Back to dashboard"><ArrowLeft size={16} /> Dashboard</a>
      <h1>{account.name}</h1>
      <span class="meta">{account.type} · {account.is_budget_account ? 'in budget' : 'tracking'}</span>
    </div>
    <div class="header-right">
      <strong class:neg={account.balance < 0} class="balance">
        {formatCents(account.balance, account.currency)}
      </strong>
      <Button onclick={() => (addOpen = true)}><Plus size={16} /> Add transaction</Button>
    </div>
  </header>

  {#if displayRows.length === 0}
    <p class="muted">No transactions yet for this account.</p>
  {:else}
    <table class="register">
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th>Category</th>
          <th class="num">Amount</th>
          <th class="num">Balance</th>
          <th>Cleared</th>
        </tr>
      </thead>
      <tbody>
        {#each displayRows as t (t.id)}
          <tr class:cleared={t.cleared}>
            <td>{t.date}</td>
            <td>{t.description || (t.type === 'transfer' ? 'Transfer' : '—')}</td>
            <td>{categoryName(t)}</td>
            <td class="num" class:neg={t.amount < 0}>{formatCents(t.amount, account.currency)}</td>
            <td class="num">{formatCents(balanceAfter.get(t.id) ?? 0, account.currency)}</td>
            <td>
              <input
                type="checkbox"
                checked={t.cleared}
                onchange={() => void toggleCleared(t)}
                aria-label="Cleared"
              />
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  <AddTransactionDialog open={addOpen} onclose={() => (addOpen = false)} presetAccountId={account.id} />
{/if}

<style>
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--space-4);
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .page-header h1 {
    margin: var(--space-1) 0 0;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    text-decoration: none;
  }
  .meta {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .header-right {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }
  .balance {
    font-size: var(--font-size-xl);
    font-variant-numeric: tabular-nums;
  }
  .neg {
    color: var(--color-negative);
  }
  .muted {
    color: var(--color-text-secondary);
  }
  .register {
    width: 100%;
    border-collapse: collapse;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .register th,
  .register td {
    text-align: left;
    padding: var(--space-2) var(--space-3);
    border-top: 1px solid var(--color-border);
    min-height: 44px;
  }
  .register thead th {
    border-top: none;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .register .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .register tr.cleared td {
    color: var(--color-text-secondary);
  }
  @media (max-width: 768px) {
    .register th:nth-child(3),
    .register td:nth-child(3) {
      display: none;
    }
  }
</style>
