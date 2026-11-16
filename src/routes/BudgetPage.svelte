<script lang="ts">
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import { budgetStore } from '$lib/stores/budget.svelte';
  import { formatCents } from '$lib/domain/money';
  import { currentMonth } from '$lib/utils/date';
  import type { Category, CategoryGroup, PayFrequency } from '$lib/domain/types';
  import GroupCard from '$lib/components/budget/GroupCard.svelte';
  import BudgetDonut from '$lib/components/budget/BudgetDonut.svelte';
  import IncomeDialog from '$lib/components/budget/IncomeDialog.svelte';
  import AddCategoryDialog from '$lib/components/budget/AddCategoryDialog.svelte';
  import OrganizeDialog from '$lib/components/budget/OrganizeDialog.svelte';
  import MonthSwitcher from '$lib/components/ui/MonthSwitcher.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { MoreVertical } from 'lucide-svelte';

  const PAY_LABEL: Record<PayFrequency, string> = {
    once_monthly: 'Monthly Pay Schedule',
    twice_monthly: 'Semi-Monthly Pay Schedule',
    biweekly: 'Bi-Weekly Pay Schedule',
    weekly: 'Weekly Pay Schedule'
  };

  let incomeOpen = $state(false);
  let categoryOpen = $state(false);
  let organizeOpen = $state(false);
  let editing = $state<Category | null>(null);
  let search = $state('');
  let filter = $state<'all' | 'budgeted'>('all');
  let menuOpen = $state(false);

  const planned = $derived(budgetStore.planned);
  const budgeted = $derived(budgetStore.budgeted);
  const progress = $derived(budgetStore.progress);
  const plan = $derived(budgetStore.plan);
  const isPlanningAhead = $derived(budgetStore.month > currentMonth());
  const incomeLabel = $derived(
    !plan || plan.mode === 'variable' ? 'Variable income' : PAY_LABEL[plan.frequency]
  );

  const matching = $derived(
    categoriesStore.activeCategories.filter((c) => {
      if (search.trim() && !c.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (filter === 'budgeted') return budgetStore.budgetFor(c.id) > 0;
      return true;
    })
  );
  const budgetedCount = $derived(
    categoriesStore.activeCategories.filter((c) => budgetStore.budgetFor(c.id) > 0).length
  );

  function groupsWithRows(): Array<{ group: CategoryGroup | null; categories: Category[] }> {
    const out: Array<{ group: CategoryGroup | null; categories: Category[] }> = [];
    for (const g of categoriesStore.groups) {
      const categories = matching.filter((c) => c.group_id === g.id);
      if (categories.length > 0 || search.trim() === '') out.push({ group: g, categories });
    }
    const ungrouped = matching.filter((c) => !c.group_id);
    if (ungrouped.length > 0) out.push({ group: null, categories: ungrouped });
    return out;
  }

  const sections = $derived(groupsWithRows());

  function openEdit(c: Category) {
    editing = c;
    categoryOpen = true;
  }

  function openAdd() {
    editing = null;
    categoryOpen = true;
  }
</script>

<header class="page-header">
  <h1>Budget</h1>
  <div class="header-right">
    <MonthSwitcher />
    <div class="menu-wrap">
      <button class="icon-btn" aria-label="Budget options" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)}>
        <MoreVertical size={18} />
      </button>
      {#if menuOpen}
        <div class="menu" role="menu">
          <button role="menuitem" onclick={() => { menuOpen = false; organizeOpen = true; }}>Organize</button>
        </div>
      {/if}
    </div>
  </div>
</header>

{#if isPlanningAhead}
  <div class="banner" role="status">
    <strong>Planning ahead.</strong> Changes take effect when the month arrives.
  </div>
{/if}

<div class="summary">
  <Card>
    <span class="label">Monthly income</span>
    <strong class="big">{formatCents(planned)}</strong>
    <span class="sub">{incomeLabel}</span>
    <div class="card-actions">
      <Button variant="secondary" onclick={() => (incomeOpen = true)}>Update</Button>
    </div>
  </Card>

  <Card>
    <span class="label">Budget progress</span>
    <strong class="big" class:neg={progress.percent > 100}>{progress.percent}%</strong>
    <span class="sub">{formatCents(budgeted)} / {formatCents(planned)}</span>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.min(progress.percent, 100)}>
      <i class:over={progress.percent > 100} style="width:{Math.min(progress.percent, 100)}%"></i>
    </div>
    {#if progress.over > 0}
      <span class="neg">{formatCents(progress.over)} over budget</span>
    {:else}
      <span class="sub">{formatCents(progress.left)} left to budget</span>
    {/if}
  </Card>

  <BudgetDonut />
</div>

<section class="categories" aria-label="Categories">
  <div class="toolbar">
    <input class="search" type="search" bind:value={search} placeholder="Search categories" aria-label="Search categories" />
    <div class="filters" role="group" aria-label="Filter">
      <button class:on={filter === 'all'} onclick={() => (filter = 'all')}>All ({categoriesStore.activeCategories.length})</button>
      <button class:on={filter === 'budgeted'} onclick={() => (filter = 'budgeted')}>Budgeted ({budgetedCount})</button>
    </div>
    <Button onclick={openAdd}>Add Category</Button>
  </div>

  {#if sections.length === 0}
    <p class="empty">No categories yet. Add one with Add Category.</p>
  {/if}

  <div class="groups">
    {#each sections as s (s.group?.id ?? 'ungrouped')}
      <GroupCard group={s.group} categories={s.categories} onedit={openEdit} />
    {/each}
  </div>
</section>

<IncomeDialog open={incomeOpen} onclose={() => (incomeOpen = false)} />
<AddCategoryDialog open={categoryOpen} editCategory={editing} onclose={() => (categoryOpen = false)} />
<OrganizeDialog open={organizeOpen} onclose={() => (organizeOpen = false)} />

<style>
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  h1 {
    margin: 0;
  }
  .header-right {
    display: flex;
    align-items: center;
    gap: var(--space-3);
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
    z-index: 5;
    display: flex;
    flex-direction: column;
    min-width: 10rem;
  }
  .menu button {
    background: none;
    border: none;
    padding: var(--space-2) var(--space-3);
    text-align: left;
    color: var(--color-text);
    cursor: pointer;
    font: inherit;
  }
  .banner {
    background: var(--color-surface-alt);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-sm);
    padding: var(--space-3);
    margin-bottom: var(--space-4);
    font-size: var(--font-size-sm);
  }
  .summary {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
    align-items: start;
  }
  .summary :global(.card) {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .label {
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }
  .big {
    font-size: var(--font-size-xl);
  }
  .sub {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .neg {
    color: var(--color-negative);
    font-size: var(--font-size-sm);
  }
  .card-actions {
    margin-top: var(--space-2);
  }
  .bar {
    height: 8px;
    background: var(--color-surface-alt);
    border-radius: 4px;
    overflow: hidden;
    margin: var(--space-1) 0;
  }
  .bar i {
    display: block;
    height: 100%;
    background: var(--color-positive);
  }
  .bar i.over {
    background: var(--color-negative);
  }
  .toolbar {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: var(--space-3);
  }
  .search {
    flex: 1;
    min-width: 12rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
  }
  .search:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  .filters {
    display: flex;
    gap: var(--space-1);
  }
  .filters button {
    background: none;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 2px var(--space-3);
    color: var(--color-text-secondary);
    cursor: pointer;
    font: inherit;
    font-size: var(--font-size-sm);
  }
  .filters button.on {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
  .groups {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .empty {
    color: var(--color-text-secondary);
  }
  @media (max-width: 901px) {
    .summary {
      grid-template-columns: 1fr;
    }
  }
</style>
