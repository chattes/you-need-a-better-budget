<script lang="ts">
  import { transactionsStore } from '$lib/stores/transactions.svelte';
  import { accountsStore } from '$lib/stores/accounts.svelte';
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import { budgetStore } from '$lib/stores/budget.svelte';
  import {
    budgetTroubleSpots,
    cashFlow,
    earnedSpentSaved,
    spendingBreakdown,
    type BreakdownRow
  } from '$lib/domain/reports';
  import { formatCents } from '$lib/domain/money';
  import type { Period } from '$lib/domain/types';
  import { addMonths, monthRange, formatMonth } from '$lib/utils/date';
  import Card from '$lib/components/ui/Card.svelte';
  import MonthSwitcher from '$lib/components/ui/MonthSwitcher.svelte';
  import CashFlowChart from '$lib/components/reports/CashFlowChart.svelte';

  type PeriodKey = 'month' | '3m' | 'ytd';
  type Tab = 'spending' | 'cashflow';
  let periodKey = $state<PeriodKey>('month');
  let tab = $state<Tab>('spending');
  let groupBy = $state<'group' | 'category'>('group');
  let expanded = $state<Record<string, boolean>>({});

  const month = $derived(budgetStore.month);

  // Current and previous period, both inclusive YYYY-MM-DD ranges.
  const periods = $derived.by((): { current: Period; previous: Period; months: number } => {
    if (periodKey === 'month') {
      return {
        current: monthRange(month),
        previous: monthRange(addMonths(month, -1)),
        months: 1
      };
    }
    if (periodKey === '3m') {
      return {
        current: { start: monthRange(addMonths(month, -2)).start, end: monthRange(month).end },
        previous: {
          start: monthRange(addMonths(month, -5)).start,
          end: monthRange(addMonths(month, -3)).end
        },
        months: 3
      };
    }
    const year = month.slice(0, 4);
    const prevYear = String(Number(year) - 1);
    return {
      current: { start: `${year}-01-01`, end: monthRange(month).end },
      previous: { start: `${prevYear}-01-01`, end: `${prevYear}-${month.slice(5, 7)}-31` },
      months: Number(month.slice(5, 7))
    };
  });

  const txns = $derived(transactionsStore.transactions);
  const accounts = $derived(accountsStore.accounts);
  const current = $derived(earnedSpentSaved(txns, accounts, periods.current));
  const previous = $derived(earnedSpentSaved(txns, accounts, periods.previous));
  const savedPct = $derived(current.earned > 0 ? Math.round((current.saved / current.earned) * 100) : 0);
  const spentChange = $derived(current.spent - previous.spent);
  const spentChangePct = $derived(previous.spent > 0 ? Math.round((spentChange / previous.spent) * 1000) / 10 : 0);

  const breakdown = $derived<BreakdownRow[]>(
    spendingBreakdown(txns, categoriesStore.categories, categoriesStore.groups, periods.current, groupBy)
  );
  const totalSpent = $derived(breakdown.reduce((s, r) => s + r.amount, 0));
  const flow = $derived(cashFlow(txns, accounts, periods.current));
  const troubles = $derived(
    budgetTroubleSpots(categoriesStore.categories, txns, budgetStore.monthBudgets, month, budgetStore.planned)
  );

  const periodLabel = $derived(
    periodKey === 'month'
      ? formatMonth(month)
      : periodKey === '3m'
        ? `${formatMonth(addMonths(month, -2))} – ${formatMonth(month)}`
        : `Year to ${formatMonth(month)}`
  );
</script>

<header class="page-header">
  <h1>Reports</h1>
  <div class="header-right">
    <select bind:value={periodKey} aria-label="Period">
      <option value="month">Month</option>
      <option value="3m">Last 3 months</option>
      <option value="ytd">Year to date</option>
    </select>
    <MonthSwitcher />
  </div>
</header>
<p class="muted">{periodLabel}, compared with the previous period.</p>

<div class="cards">
  <Card>
    <span class="label">Earned</span>
    <strong class="big">{formatCents(current.earned)}</strong>
    <span class="muted">{formatCents(Math.round(current.earned / periods.months))} a month on average</span>
  </Card>
  <Card>
    <span class="label">Spent</span>
    <strong class="big">{formatCents(current.spent)}</strong>
    <span class="muted">{formatCents(spentChange)} ({spentChangePct}%) vs previous</span>
  </Card>
  <Card>
    <span class="label">Saved</span>
    <strong class="big" class:neg={current.saved < 0}>{formatCents(current.saved)}</strong>
    <span class="muted">{savedPct}% of what you earned</span>
  </Card>
</div>

<div class="tabs" role="tablist">
  <button role="tab" aria-selected={tab === 'spending'} class:on={tab === 'spending'} onclick={() => (tab = 'spending')}>Spending breakdown</button>
  <button role="tab" aria-selected={tab === 'cashflow'} class:on={tab === 'cashflow'} onclick={() => (tab = 'cashflow')}>Cash flow</button>
</div>

{#if tab === 'spending'}
  <div class="chips" role="group" aria-label="Group by">
    <button class:on={groupBy === 'group'} onclick={() => (groupBy = 'group')}>Group</button>
    <button class:on={groupBy === 'category'} onclick={() => (groupBy = 'category')}>Category</button>
  </div>
  {#if breakdown.length === 0}
    <p class="muted">No spending in this period.</p>
  {:else}
    <ul class="breakdown">
      {#each breakdown as row (row.id)}
        <li>
          <button class="row" aria-expanded={!!expanded[row.id]} onclick={() => (expanded[row.id] = !expanded[row.id])}>
            <span>{row.name}</span>
            <span>{formatCents(row.amount)} • {totalSpent ? Math.round((row.amount / totalSpent) * 100) : 0}%</span>
          </button>
          {#if expanded[row.id] && row.children}
            <ul class="children">
              {#each row.children as c (c.id)}
                <li><span>{c.name}</span><span>{formatCents(c.amount)}</span></li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  <section>
    <h2>Budget trouble spots ({formatMonth(month)})</h2>
    {#if troubles.length === 0}
      <p class="muted">Nothing over budget</p>
    {:else}
      <ul class="breakdown">
        {#each troubles as t (t.category.id)}
          <li><span>{t.category.name}</span><span class="neg">{formatCents(t.overAmount)} over • {t.percentPast}% past budget</span></li>
        {/each}
      </ul>
    {/if}
  </section>
{:else}
  <CashFlowChart
    labels={flow.map((p) => formatMonth(p.month))}
    income={flow.map((p) => p.income)}
    expense={flow.map((p) => p.expense)}
  />
  <ul class="breakdown">
    {#each flow as p (p.month)}
      <li><span>{formatMonth(p.month)}</span><span>{formatCents(p.income)} in • {formatCents(p.expense)} out • net {formatCents(p.net)}</span></li>
    {/each}
  </ul>
{/if}

<style>
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-1);
  }
  h1 {
    margin: 0;
  }
  h2 {
    font-size: var(--font-size-base);
    margin: var(--space-6) 0 var(--space-2);
  }
  .header-right {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    flex-wrap: wrap;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
    margin: var(--space-4) 0 var(--space-6);
  }
  .cards :global(.card) {
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
  .chips {
    display: flex;
    gap: var(--space-1);
    margin-bottom: var(--space-2);
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
  .breakdown,
  .children {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .breakdown > li {
    border-top: 1px solid var(--color-border);
  }
  .breakdown li > span,
  .row,
  .children li {
    display: flex;
    justify-content: space-between;
    padding: var(--space-2) 0;
    font-size: var(--font-size-sm);
  }
  .row {
    width: 100%;
    background: none;
    border: none;
    color: var(--color-text);
    cursor: pointer;
    font: inherit;
    padding: var(--space-2) 0;
  }
  .children {
    padding-left: var(--space-4);
  }
  .muted {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  .neg {
    color: var(--color-negative);
  }
  @media (max-width: 901px) {
    .cards {
      grid-template-columns: 1fr;
    }
  }
</style>
