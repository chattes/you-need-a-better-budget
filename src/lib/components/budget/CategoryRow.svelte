<script lang="ts">
  import { budgetStore } from '$lib/stores/budget.svelte';
  import { formatCents } from '$lib/domain/money';
  import type { Category, CategoryCadence } from '$lib/domain/types';
  import { MoreHorizontal } from 'lucide-svelte';

  let {
    category,
    onedit
  }: { category: Category; onedit: (c: Category) => void } = $props();

  const CADENCE_LABEL: Record<CategoryCadence, string> = {
    monthly: 'Monthly',
    weekly: 'Weekly',
    biweekly: 'Every 2 weeks',
    semimonthly: 'Twice a month',
    bimonthly: 'Every 2 months',
    quarterly: 'Quarterly',
    yearly: 'Yearly'
  };

  const budget = $derived(budgetStore.budgetFor(category.id));
  const planned = $derived(budgetStore.planned);
  const carried = $derived(budgetStore.carriedFor(category.id));
  const available = $derived(budgetStore.availableFor(category.id));
  const pct = $derived(planned > 0 ? Math.round((budget / planned) * 100) : 0);

  const subline = $derived.by(() => {
    const parts: string[] = [];
    if (category.target_percent != null) parts.push(`${category.target_percent}% of income`);
    else parts.push(CADENCE_LABEL[category.cadence]);
    if (category.due_day != null) parts.push(`Due ${category.due_day}`);
    if (category.target_percent == null && pct > 0) parts.push(`${pct}% of income`);
    if (category.rollover_mode === 'rolls_over') parts.push(`Rolls over • Balance: ${formatCents(carried)}`);
    return parts.join(', ');
  });
</script>

<li class="row">
  <div class="main">
    <span class="name">{category.name}</span>
    <span class="sub">{subline}</span>
  </div>
  <span class="amount">
    {#if budget === 0 && category.monthly_target == null && category.target_percent == null}
      <em>Not budgeted</em>
    {:else}
      {formatCents(budget)}/mo
    {/if}
  </span>
  <span class="avail" class:neg={available < 0}>{formatCents(available)}</span>
  <button class="more" aria-label="More options for {category.name}" onclick={() => onedit(category)}>
    <MoreHorizontal size={16} />
  </button>
</li>

<style>
  .row {
    display: grid;
    grid-template-columns: 1fr auto 6rem auto;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-top: 1px solid var(--color-border);
    list-style: none;
  }
  .main {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name {
    font-weight: 500;
  }
  .sub {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .amount {
    white-space: nowrap;
  }
  .avail {
    text-align: right;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .neg {
    color: var(--color-negative);
  }
  .more {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: var(--space-1);
  }
  @media (max-width: 600px) {
    .row {
      grid-template-columns: 1fr auto auto;
    }
    .avail {
      display: none;
    }
  }
</style>
