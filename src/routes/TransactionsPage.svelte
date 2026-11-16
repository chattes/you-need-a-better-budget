<script lang="ts">
  import { transactionsStore } from '$lib/stores/transactions.svelte';
  import { scheduledStore } from '$lib/stores/scheduled.svelte';
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import { budgetStore } from '$lib/stores/budget.svelte';
  import TransactionRow from '$lib/components/transactions/TransactionRow.svelte';
  import AddTransactionDialog from '$lib/components/transactions/AddTransactionDialog.svelte';
  import ImportPreview from '$lib/components/transactions/ImportPreview.svelte';
  import MonthSwitcher from '$lib/components/ui/MonthSwitcher.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { monthRange, formatMonth } from '$lib/utils/date';
  import { isSplitParent } from '$lib/domain/splits';
  import { formatCents } from '$lib/domain/money';
  import type { Transaction } from '$lib/domain/types';
  import { MoreVertical, Upload, Plus } from 'lucide-svelte';

  type Tab = 'transactions' | 'repeating';
  type Kind = 'all' | 'expense' | 'income' | 'transfer' | 'other';

  let tab = $state<Tab>('transactions');
  let kind = $state<Kind>('all');
  let search = $state('');
  let addOpen = $state(false);
  let importOpen = $state(false);
  let menuOpen = $state(false);

  const month = $derived(budgetStore.month);
  const range = $derived(monthRange(month));

  const visible = $derived(
    transactionsStore.transactions.filter((t) => {
      if (t.deleted_at) return false;
      if (t.date < range.start || t.date > range.end) return false;
      if (kind === 'expense' && t.type !== 'expense') return false;
      if (kind === 'income' && t.type !== 'income') return false;
      if (kind === 'transfer' && t.type !== 'transfer') return false;
      if (kind === 'other' && (t.type === 'expense' || t.type === 'income' || t.type === 'transfer')) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const cat = categoriesStore.categories.find((c) => c.id === t.category_id)?.name ?? '';
        if (!t.description.toLowerCase().includes(q) && !cat.toLowerCase().includes(q)) return false;
      }
      return true;
    })
  );

  // Parents first; split children are listed right below their parent.
  const list = $derived.by(() => {
    const out: Array<{ t: Transaction; splitCount: number }> = [];
    const parents = visible.filter((t) => !t.split_parent_id);
    for (const p of parents) {
      const children = visible.filter((c) => c.split_parent_id === p.id);
      out.push({ t: p, splitCount: children.length });
      for (const c of children) out.push({ t: c, splitCount: 0 });
    }
    return out;
  });

  const totals = $derived.by(() => {
    let spent = 0;
    let income = 0;
    for (const t of visible) {
      if (isSplitParent(t)) continue;
      if (t.type === 'expense') spent += -t.amount;
      if (t.type === 'income') income += t.amount;
    }
    return { spent, income };
  });

  const repeating = $derived(scheduledStore.active);
  const cadenceLabel: Record<string, string> = {
    weekly: 'Weekly',
    biweekly: 'Every 2 weeks',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    yearly: 'Yearly',
    custom: 'Custom'
  };

  async function remove(t: Transaction) {
    const label = t.description || formatCents(Math.abs(t.amount));
    if (!window.confirm(`Delete “${label}”? Account balances will be adjusted.`)) return;
    await transactionsStore.remove(t.id);
  }
</script>

<header class="page-header">
  <h1>Activity</h1>
  <div class="header-right">
    <MonthSwitcher />
    <Button variant="secondary" onclick={() => (importOpen = true)}><Upload size={16} /> Import</Button>
    <Button onclick={() => (addOpen = true)}><Plus size={16} /> Add Transaction</Button>
    <div class="menu-wrap">
      <button class="icon-btn" aria-label="More actions" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)}>
        <MoreVertical size={18} />
      </button>
      {#if menuOpen}
        <div class="menu" role="menu">
          <button role="menuitem" onclick={() => { menuOpen = false; tab = 'repeating'; }}>Repeating</button>
          <a role="menuitem" href="#/settings" onclick={() => (menuOpen = false)}>Export CSV (Settings)</a>
        </div>
      {/if}
    </div>
  </div>
</header>

<div class="tabs" role="tablist">
  <button role="tab" aria-selected={tab === 'transactions'} class:on={tab === 'transactions'} onclick={() => (tab = 'transactions')}>Transactions</button>
  <button role="tab" aria-selected={tab === 'repeating'} class:on={tab === 'repeating'} onclick={() => (tab = 'repeating')}>Repeating</button>
</div>

{#if tab === 'transactions'}
  <div class="toolbar">
    <input class="search" type="search" bind:value={search} placeholder="Search payees, categories" aria-label="Search transactions" />
    <div class="chips" role="group" aria-label="Type">
      {#each [['all', 'All'], ['expense', 'Expense'], ['income', 'Income'], ['transfer', 'Transfer'], ['other', 'Other']] as [key, label] (key)}
        <button class:on={kind === key} onclick={() => (kind = key as Kind)}>{label}</button>
      {/each}
    </div>
  </div>

  <p class="summary">{formatMonth(month)}: {formatCents(totals.income)} in • {formatCents(totals.spent)} out</p>

  {#if list.length === 0}
    <div class="empty">
      <p>No transactions yet.</p>
      <Button onclick={() => (addOpen = true)}>Add Transaction</Button>
    </div>
  {:else}
    <ul class="list">
      {#each list as item (item.t.id)}
        <TransactionRow transaction={item.t} splitCount={item.splitCount} onremove={remove} />
      {/each}
    </ul>
  {/if}
{:else}
  {#if repeating.length === 0}
    <div class="empty">
      <p>No repeating transactions. Turn on Repeat when adding an expense or income and it will show up here with its next date.</p>
    </div>
  {:else}
    <ul class="list">
      {#each repeating as r (r.id)}
        <li class="row">
          <span class="desc">{r.name}</span>
          <span class="muted">{cadenceLabel[r.cadence] ?? r.cadence}</span>
          <span class="muted">Next {r.next_date}</span>
          <span class:neg={r.amount < 0} class:pos={r.amount > 0} class="amount">{r.amount < 0 ? '−' : '+'}{formatCents(Math.abs(r.amount))}</span>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<AddTransactionDialog open={addOpen} onclose={() => (addOpen = false)} />
<ImportPreview open={importOpen} onclose={() => (importOpen = false)} />

<style>
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  h1 {
    margin: 0;
  }
  .header-right {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .icon-btn {
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-1);
    color: var(--color-text);
    cursor: pointer;
    display: inline-flex;
  }
  .menu-wrap {
    position: relative;
  }
  .menu {
    position: absolute;
    right: 0;
    top: 100%;
    margin-top: var(--space-1);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    display: flex;
    flex-direction: column;
    min-width: 12rem;
    z-index: 5;
  }
  .menu button,
  .menu a {
    background: none;
    border: none;
    padding: var(--space-2) var(--space-3);
    text-align: left;
    color: var(--color-text);
    text-decoration: none;
    font: inherit;
    cursor: pointer;
  }
  .tabs {
    display: flex;
    gap: var(--space-4);
    border-bottom: 1px solid var(--color-border);
    margin-bottom: var(--space-3);
  }
  .tabs button {
    background: none;
    border: none;
    padding: var(--space-2) 0;
    color: var(--color-text-secondary);
    cursor: pointer;
    font: inherit;
    border-bottom: 2px solid transparent;
  }
  .tabs button.on {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    margin-bottom: var(--space-2);
  }
  .search {
    flex: 1;
    min-width: 12rem;
  }
  .chips {
    display: flex;
    gap: var(--space-1);
    flex-wrap: wrap;
  }
  .chips button {
    background: none;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 2px var(--space-3);
    color: var(--color-text-secondary);
    cursor: pointer;
    font: inherit;
    font-size: var(--font-size-sm);
  }
  .chips button.on {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
  .summary {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 8rem 8rem 7rem;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-2) 0;
    border-top: 1px solid var(--color-border);
    font-size: var(--font-size-sm);
  }
  .muted {
    color: var(--color-text-secondary);
  }
  .amount {
    text-align: right;
  }
  .pos {
    color: var(--color-positive);
  }
  .neg {
    color: var(--color-negative);
  }
  .empty {
    text-align: center;
    padding: var(--space-8) var(--space-4);
    color: var(--color-text-secondary);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
  }
</style>
