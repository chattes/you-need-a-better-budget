<script lang="ts">
  import { budgetStore } from '$lib/stores/budget.svelte';
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import { formatCents } from '$lib/domain/money';
  import Donut, { type Segment } from '../ui/Donut.svelte';
  import Card from '../ui/Card.svelte';

  const PALETTE = ['#d32f2f', '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#0097a7', '#c2185b', '#5d4037'];

  const segments = $derived.by<Segment[]>(() => {
    const rows = categoriesStore.activeCategories
      .map((c) => ({ name: c.name, value: budgetStore.budgetFor(c.id) }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
    const top = rows.slice(0, 7);
    const rest = rows.slice(7).reduce((s, r) => s + r.value, 0);
    const out: Segment[] = top.map((r, i) => ({ label: r.name, value: r.value, color: PALETTE[i % PALETTE.length]! }));
    if (rest > 0) out.push({ label: 'Other', value: rest, color: '#9e9e9e' });
    return out;
  });

  const budgeted = $derived(budgetStore.budgeted);
  const over = $derived(Math.max(0, budgeted - budgetStore.planned));
</script>

<Card>
  <h2 class="title">Budget breakdown</h2>
  {#if segments.length === 0}
    <p class="muted">No budgets yet. Add a category to start.</p>
  {:else}
    <Donut
      {segments}
      centerLabel="Total budget"
      centerValue={formatCents(budgeted)}
      centerTone={over > 0 ? 'neg' : ''}
    />
    {#if over > 0}
      <p class="over">{formatCents(over)} over budget</p>
    {/if}
    <ul class="legend">
      {#each segments as s (s.label)}
        <li><i style="background:{s.color}"></i><span>{s.label}</span><span>{formatCents(s.value)}</span></li>
      {/each}
    </ul>
  {/if}
</Card>

<style>
  .title {
    font-size: var(--font-size-base);
    margin: 0 0 var(--space-3);
  }
  .muted {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  .over {
    text-align: center;
    color: var(--color-negative);
    margin: var(--space-2) 0 0;
    font-size: var(--font-size-sm);
  }
  .legend {
    list-style: none;
    margin: var(--space-3) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--font-size-sm);
  }
  .legend li {
    display: grid;
    grid-template-columns: 12px 1fr auto;
    gap: var(--space-2);
    align-items: center;
  }
  .legend i {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
</style>
