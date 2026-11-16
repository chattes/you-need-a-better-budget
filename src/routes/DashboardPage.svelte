<script lang="ts">
  import { accountsStore } from '$lib/stores/accounts.svelte';
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import { budgetStore } from '$lib/stores/budget.svelte';
  import { transactionsStore } from '$lib/stores/transactions.svelte';
  import { scheduledStore } from '$lib/stores/scheduled.svelte';
  import { formatCents } from '$lib/domain/money';
  import { overBudget, receivedIncome, spentInMonth } from '$lib/domain/budget';
  import { expandScheduled } from '$lib/domain/scheduled';
  import { addMonths, todayIso, monthRange, formatMonth } from '$lib/utils/date';
  import Donut, { type Segment } from '$lib/components/ui/Donut.svelte';
  import MonthSwitcher from '$lib/components/ui/MonthSwitcher.svelte';
  import OnboardingCard from '$lib/components/layout/OnboardingCard.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import type { Category } from '$lib/domain/types';

  type Tab = 'all' | 'on' | 'off' | 'rollover' | 'funds';
  type Window = 'week' | 'month';

  let tab = $state<Tab>('all');
  let upcomingWindow = $state<Window>('week');
  let explainerOpen = $state(false);

  const month = $derived(budgetStore.month);
  const categories = $derived(categoriesStore.activeCategories);
  const groupName = (c: Category) =>
    categoriesStore.groups.find((g) => g.id === c.group_id)?.name ?? '';

  interface Row {
    category: Category;
    budget: number;
    spent: number;
    available: number;
    over: boolean;
    fundsGroup: boolean;
  }

  const rows = $derived<Row[]>(
    categories.map((c) => {
      const available = budgetStore.availableFor(c.id);
      return {
        category: c,
        budget: budgetStore.budgetFor(c.id),
        spent: budgetStore.spentFor(c.id),
        available,
        over: available < 0,
        fundsGroup: groupName(c).toLowerCase() === 'funds'
      };
    })
  );

  const visibleRows = $derived(
    rows.filter((r) => {
      if (tab === 'on') return !r.over;
      if (tab === 'off') return r.over;
      if (tab === 'rollover') return r.category.rollover_mode === 'rolls_over';
      if (tab === 'funds') return r.fundsGroup;
      return true;
    })
  );

  // Actual Spending donut: spent by category, largest first, top 6 then "Other".
  const spendSegments = $derived.by<Segment[]>(() => {
    const palette = ['#d32f2f', '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#0097a7'];
    const spending = rows.filter((r) => r.spent > 0).sort((a, b) => b.spent - a.spent);
    const top = spending.slice(0, 6);
    const rest = spending.slice(6).reduce((s, r) => s + r.spent, 0);
    const out: Segment[] = top.map((r, i) => ({
      label: r.category.name,
      value: r.spent,
      color: palette[i % palette.length]!
    }));
    if (rest > 0) out.push({ label: 'Other', value: rest, color: '#9e9e9e' });
    return out;
  });

  const troubleSpots = $derived(
    rows
      .filter((r) => r.over)
      .map((r) => ({ ...r, ...overBudget(r.budget, r.spent) }))
      .sort((a, b) => b.amount - a.amount)
  );

  const unbudgeted = $derived(rows.filter((r) => r.budget === 0 && r.spent > 0));

  // Income vs Expenses: last six months, ending at the shown month.
  const monthly = $derived.by(() => {
    const out: Array<{ month: string; income: number; out: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const m = addMonths(month, -i);
      out.push({
        month: m,
        income: receivedIncome(transactionsStore.transactions, m),
        out: spentInMonth(transactionsStore.transactions, m)
      });
    }
    return out;
  });
  const monthlyMax = $derived(Math.max(1, ...monthly.map((m) => Math.max(m.income, m.out))));

  // Upcoming Expenses: scheduled rows due in the next 7 days or this month.
  const upcoming = $derived.by(() => {
    const today = todayIso();
    const from = new Date(today + 'T00:00:00Z');
    let to: Date;
    if (upcomingWindow === 'week') {
      to = new Date(from);
      to.setUTCDate(to.getUTCDate() + 7);
    } else {
      const end = monthRange(month).end;
      to = new Date(end + 'T00:00:00Z');
    }
    return expandScheduled(scheduledStore.scheduled, from, to).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  });

  const accountName = (id: string) => accountsStore.accounts.find((a) => a.id === id)?.name ?? '';
  const categoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? 'Uncategorized';

  const planned = $derived(budgetStore.planned);
  const received = $derived(budgetStore.received);
  const spent = $derived(budgetStore.spent);
  const aside = $derived(budgetStore.setAside);
  const remaining = $derived(budgetStore.remaining);
  const asideCount = $derived(
    categories.filter(
      (c) => c.rollover_mode === 'rolls_over' && budgetStore.budgetFor(c.id) > budgetStore.spentFor(c.id)
    ).length
  );
  const extra = $derived(received - planned);
</script>

<header class="page-header">
  <h1>Dashboard</h1>
  <MonthSwitcher />
</header>

<OnboardingCard />

<section class="stat-cards" aria-label="Summary">
  <article class="stat">
    <span class="label">Income</span>
    <strong class="value">{formatCents(planned)}</strong>
    <span class="sub">
      {#if extra > 0}
        {formatCents(extra)} more than planned
      {:else if extra < 0}
        {formatCents(-extra)} less than planned
      {:else}
        Income received {formatCents(received)}
      {/if}
    </span>
  </article>
  <article class="stat">
    <span class="label">Spent</span>
    <strong class="value">{formatCents(spent)}</strong>
    <span class="sub">Received {formatCents(received)}</span>
  </article>
  <button class="stat stat-button" onclick={() => (explainerOpen = true)}>
    <span class="label">Remaining</span>
    <strong class="value" class:neg={remaining < 0}>{formatCents(remaining)}</strong>
    <span class="sub">{formatCents(aside)} set aside this month</span>
  </button>
</section>

<div class="grid">
  <section class="card">
    <h2>Actual spending</h2>
    {#if spendSegments.length === 0}
      <p class="muted">No spending this month yet.</p>
    {:else}
      <Donut segments={spendSegments} centerLabel="Spent" centerValue={formatCents(spent)} />
      <ul class="legend">
        {#each spendSegments as s (s.label)}
          <li><i style="background:{s.color}"></i>{s.label}<span>{formatCents(s.value)}</span></li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="card">
    <h2>Category breakdown</h2>
    <div class="tabs" role="tablist">
      {#each [['all', `All (${rows.length})`], ['on', 'On track'], ['off', 'Off track'], ['rollover', 'Rollover'], ['funds', 'Funds']] as [key, label] (key)}
        <button role="tab" aria-selected={tab === key} class:on={tab === key} onclick={() => (tab = key as Tab)}>{label}</button>
      {/each}
    </div>
    {#if visibleRows.length === 0}
      <p class="muted">No categories here.</p>
    {:else}
      <ul class="rows">
        {#each visibleRows as r (r.category.id)}
          <li>
            <span class="name">{r.category.name}{#if r.over}<em class="over-tag">OVER</em>{/if}</span>
            <span class="nums">{formatCents(r.budget)} / {formatCents(r.spent)} / <b class:neg={r.available < 0}>{formatCents(r.available)}</b></span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="card">
    <h2>Trouble spots</h2>
    {#if troubleSpots.length === 0}
      <p class="muted">Nothing over budget</p>
    {:else}
      <ul class="rows">
        {#each troubleSpots as t (t.category.id)}
          <li>
            <span class="name">{t.category.name}</span>
            <span class="neg">{formatCents(t.amount)} over · {t.percent}% past budget</span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="card">
    <h2>Unbudgeted spending</h2>
    {#if unbudgeted.length === 0}
      <p class="muted">Every category with spending has a budget.</p>
    {:else}
      <ul class="rows">
        {#each unbudgeted as r (r.category.id)}
          <li>
            <span class="name">{r.category.name}</span>
            <span>{formatCents(r.spent)} <a href="#/budget">+ Allocate to budget</a></span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="card">
    <h2>Income vs expenses</h2>
    <p class="muted">This month: {formatCents(received)} in • {formatCents(spent)} out</p>
    <ul class="bars">
      {#each monthly as m (m.month)}
        <li>
          <span class="bar-label">{formatMonth(m.month)}</span>
          <span class="bar-track"><i class="in" style="width:{(m.income / monthlyMax) * 100}%"></i></span>
          <span class="bar-track"><i class="out" style="width:{(m.out / monthlyMax) * 100}%"></i></span>
          <span class="bar-amount">{formatCents(m.income)} / {formatCents(m.out)}</span>
        </li>
      {/each}
    </ul>
  </section>

  <section class="card">
    <h2>Upcoming expenses</h2>
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected={upcomingWindow === 'week'} class:on={upcomingWindow === 'week'} onclick={() => (upcomingWindow = 'week')}>Next 7 days</button>
      <button role="tab" aria-selected={upcomingWindow === 'month'} class:on={upcomingWindow === 'month'} onclick={() => (upcomingWindow = 'month')}>This month</button>
    </div>
    {#if upcoming.length === 0}
      <p class="muted">Nothing due.</p>
    {:else}
      <ul class="rows">
        {#each upcoming as u (u.scheduled_id + u.date)}
          <li>
            <span class="name">{categoryName(u.category_id)} <small class="muted">{u.date}</small></span>
            <span class:pos={u.amount > 0} class:neg={u.amount < 0}>{formatCents(u.amount)}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="card">
    <h2>Accounts</h2>
    {#if accountsStore.accounts.length === 0}
      <p class="muted">No accounts yet</p>
    {:else}
      <ul class="rows">
        {#each accountsStore.accounts as a (a.id)}
          <li>
            <a href="#/accounts/{a.id}">{accountName(a.id)}</a>
            <span class:neg={a.balance < 0}>{formatCents(a.balance)}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<Dialog open={explainerOpen} title="How Remaining is calculated" onclose={() => (explainerOpen = false)}>
  <dl class="explainer">
    <dt>Your budget (planned income)</dt><dd>{formatCents(planned)}</dd>
    <dt>Received</dt><dd>{formatCents(received)}</dd>
    <dt>Spent</dt><dd>−{formatCents(spent)}</dd>
    <dt>Set aside ({asideCount} {asideCount === 1 ? 'category' : 'categories'})</dt><dd>−{formatCents(aside)}</dd>
    <dt><strong>Remaining</strong></dt><dd><strong>{formatCents(remaining)}</strong></dd>
  </dl>
</Dialog>

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
  h2 {
    font-size: var(--font-size-base);
    margin: 0 0 var(--space-3);
  }
  .stat-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }
  .stat,
  .card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    text-align: left;
    color: var(--color-text);
    font: inherit;
  }
  .stat-button {
    cursor: pointer;
  }
  .label {
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }
  .value {
    font-size: var(--font-size-xl);
  }
  .sub {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
    align-items: start;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    margin-bottom: var(--space-3);
  }
  .tabs button {
    background: none;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 2px var(--space-3);
    color: var(--color-text-secondary);
    cursor: pointer;
    font: inherit;
    font-size: var(--font-size-sm);
  }
  .tabs button.on {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
  .rows,
  .legend {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .rows li,
  .legend li {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
  }
  .legend li i {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 2px;
    margin-right: var(--space-2);
  }
  .nums {
    white-space: nowrap;
    color: var(--color-text-secondary);
  }
  .over-tag {
    margin-left: var(--space-2);
    font-style: normal;
    font-size: 0.65rem;
    color: #fff;
    background: var(--color-negative);
    border-radius: 4px;
    padding: 0 4px;
  }
  .bars {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .bars li {
    display: grid;
    grid-template-columns: 4rem 1fr 1fr auto;
    gap: var(--space-2);
    align-items: center;
    font-size: var(--font-size-sm);
  }
  .bar-track {
    background: var(--color-surface-alt);
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
  }
  .bar-track i {
    display: block;
    height: 100%;
  }
  .bar-track .in {
    background: var(--color-positive);
  }
  .bar-track .out {
    background: var(--color-negative);
  }
  .bar-amount {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }
  .neg {
    color: var(--color-negative);
  }
  .pos {
    color: var(--color-positive);
  }
  .muted {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  .explainer {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-2) var(--space-4);
    min-width: min(360px, 90vw);
    margin: 0;
  }
  .explainer dd {
    margin: 0;
    text-align: right;
  }
  @media (max-width: 901px) {
    .stat-cards {
      grid-template-columns: 1fr;
    }
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
