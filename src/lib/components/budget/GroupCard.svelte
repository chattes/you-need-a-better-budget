<script lang="ts">
  import { budgetStore } from '$lib/stores/budget.svelte';
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import { groupBudget } from '$lib/domain/budget';
  import { formatCents } from '$lib/domain/money';
  import type { Category, CategoryGroup } from '$lib/domain/types';
  import CategoryRow from './CategoryRow.svelte';
  import { ChevronDown } from 'lucide-svelte';

  let {
    group,
    categories,
    onedit
  }: { group: CategoryGroup | null; categories: Category[]; onedit: (c: Category) => void } = $props();

  let collapsed = $state(false);

  const title = $derived(group ? group.name : 'Ungrouped');
  const total = $derived(
    group
      ? groupBudget(group, categoriesStore.categories, budgetStore.month, budgetStore.monthBudgets, budgetStore.planned)
      : categories.reduce((s, c) => s + budgetStore.budgetFor(c.id), 0)
  );
  const pct = $derived(budgetStore.planned > 0 ? Math.round((total / budgetStore.planned) * 100) : 0);
</script>

<section class="group">
  <button class="header" aria-expanded={!collapsed} onclick={() => (collapsed = !collapsed)}>
    <span class="title"><span class="chev" class:closed={collapsed}><ChevronDown size={16} /></span>{title}</span>
    <span class="totals">{formatCents(total)}/mo • {pct}% of income</span>
  </button>
  {#if !collapsed}
    <ul class="rows">
      {#each categories as c (c.id)}
        <CategoryRow category={c} {onedit} />
      {/each}
    </ul>
  {/if}
</section>

<style>
  .group {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4);
  }
  .header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
    background: none;
    border: none;
    padding: var(--space-1) 0;
    color: var(--color-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
  }
  .title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .chev {
    display: inline-flex;
    transition: transform 0.15s;
  }
  .chev.closed {
    transform: rotate(-90deg);
  }
  .totals {
    font-weight: 400;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
  }
  .rows {
    margin: 0;
    padding: 0;
  }
</style>
