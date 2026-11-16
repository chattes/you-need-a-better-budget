<script lang="ts">
  import type { Transaction } from '$lib/domain/types';
  import { accountsStore } from '$lib/stores/accounts.svelte';
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import { formatCents } from '$lib/domain/money';
  import { isSplitParent } from '$lib/domain/splits';
  import { X } from 'lucide-svelte';

  let {
    transaction,
    splitCount = 0,
    onremove
  }: { transaction: Transaction; splitCount?: number; onremove: (t: Transaction) => void } = $props();

  const account = $derived(accountsStore.accounts.find((a) => a.id === transaction.account_id));
  const category = $derived(categoriesStore.categories.find((c) => c.id === transaction.category_id));
  const isChild = $derived(Boolean(transaction.split_parent_id));

  // Spec §3.3: expense red with minus, income green with plus, transfer neutral with no sign.
  const sign = $derived(
    transaction.type === 'transfer' ? '' : transaction.amount < 0 ? '−' : '+'
  );
  const tone = $derived(
    transaction.type === 'transfer' ? 'neutral' : transaction.amount < 0 ? 'neg' : 'pos'
  );
  const label = $derived.by(() => {
    if (transaction.type === 'transfer') return 'Transfer';
    if (isSplitParent(transaction)) return `${splitCount} splits`;
    return category?.name ?? 'No category';
  });
</script>

<li class="row" class:child={isChild}>
  <span class="date">{transaction.date}</span>
  <span class="desc">
    {transaction.description || '—'}
    <small class="cat">{label}</small>
  </span>
  <span class="chip">{account?.name ?? '—'}</span>
  <span class="amount {tone}">{sign}{formatCents(Math.abs(transaction.amount))}</span>
  {#if !isChild}
    <button class="remove" aria-label="Delete transaction" onclick={() => onremove(transaction)}><X size={14} /></button>
  {:else}
    <span></span>
  {/if}
</li>

<style>
  .row {
    display: grid;
    grid-template-columns: 6.5rem 1fr 9rem 7.5rem 1.5rem;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-2) 0;
    border-top: 1px solid var(--color-border);
    list-style: none;
    font-size: var(--font-size-sm);
  }
  .row.child {
    padding-left: var(--space-6);
    color: var(--color-text-secondary);
  }
  .date {
    color: var(--color-text-secondary);
  }
  .desc {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .cat {
    color: var(--color-text-secondary);
  }
  .chip {
    font-size: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 1px var(--space-2);
    justify-self: start;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .amount {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .amount.pos {
    color: var(--color-positive);
  }
  .amount.neg {
    color: var(--color-negative);
  }
  .amount.neutral {
    color: var(--color-text);
  }
  .remove {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: 0;
  }
  @media (max-width: 600px) {
    .row {
      grid-template-columns: 1fr auto;
    }
    .date,
    .chip,
    .remove {
      display: none;
    }
  }
</style>
