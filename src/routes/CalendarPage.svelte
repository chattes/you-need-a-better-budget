<script lang="ts">
  import { scheduledStore } from '$lib/stores/scheduled.svelte';
  import { transactionsStore } from '$lib/stores/transactions.svelte';
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import { budgetStore } from '$lib/stores/budget.svelte';
  import { formatCents } from '$lib/domain/money';
  import { detectRecurring, expandScheduled, type RecurringSuggestion } from '$lib/domain/scheduled';
  import { monthRange, todayIso, formatMonth } from '$lib/utils/date';
  import MonthSwitcher from '$lib/components/ui/MonthSwitcher.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let dismissed = $state(false);

  const month = $derived(budgetStore.month);
  const range = $derived(monthRange(month));

  const occurrences = $derived(
    expandScheduled(
      scheduledStore.scheduled,
      new Date(range.start + 'T00:00:00Z'),
      new Date(range.end + 'T00:00:00Z')
    )
  );

  // Day-of-month -> entries, for the grid.
  const byDay = $derived.by(() => {
    const map = new Map<number, Array<{ name: string; amount: number }>>();
    for (const o of occurrences) {
      const day = Number(o.date.slice(8, 10));
      const name = categoriesStore.categories.find((c) => c.id === o.category_id)?.name ?? 'Scheduled';
      const list = map.get(day) ?? [];
      list.push({ name, amount: o.amount });
      map.set(day, list);
    }
    return map;
  });

  // Leading blanks so day 1 lands on its weekday (Sunday first).
  const cells = $derived.by(() => {
    const first = new Date(range.start + 'T00:00:00Z');
    const lead = first.getUTCDay();
    const days = Number(range.end.slice(8, 10));
    const out: Array<number | null> = Array(lead).fill(null);
    for (let d = 1; d <= days; d++) out.push(d);
    return out;
  });

  const today = todayIso();
  const next7 = $derived(
    expandScheduled(
      scheduledStore.scheduled,
      new Date(today + 'T00:00:00Z'),
      new Date(new Date(today + 'T00:00:00Z').getTime() + 7 * 86400000)
    ).sort((a, b) => a.date.localeCompare(b.date))
  );

  const suggestions = $derived<RecurringSuggestion[]>(
    dismissed ? [] : detectRecurring(transactionsStore.transactions)
  );

  async function addSuggestion(s: RecurringSuggestion) {
    await scheduledStore.add({
      name: s.description,
      amount: s.amount,
      account_id: s.account_id,
      category_id: s.category_id ?? '',
      cadence: 'monthly',
      next_date: nextMonthly(s.lastDate)
    });
  }

  function nextMonthly(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
    const base = new Date(Date.UTC(y, m, 1));
    const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
    base.setUTCDate(Math.min(d, last));
    return base.toISOString().slice(0, 10);
  }

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
</script>

<header class="page-header">
  <h1>Calendar</h1>
  <MonthSwitcher />
</header>

{#if suggestions.length > 0}
  <div class="banner" role="status">
    <p>{suggestions.length} recurring {suggestions.length === 1 ? 'payment' : 'payments'} found in your transaction history.</p>
    <ul>
      {#each suggestions as s (s.key)}
        <li>
          <span>{s.description} · {formatCents(Math.abs(s.amount))} · {s.months} months</span>
          <Button variant="secondary" onclick={() => void addSuggestion(s)}>Add to repeating</Button>
        </li>
      {/each}
    </ul>
    <button class="link" onclick={() => (dismissed = true)}>Hide for now</button>
  </div>
{/if}

<div class="legend"><span class="pos">■ Income / payday</span><span class="neg">■ Expense</span></div>

<div class="grid" role="grid" aria-label="{formatMonth(month)} scheduled items">
  {#each DOW as d (d)}<div class="dow" role="columnheader">{d}</div>{/each}
  {#each cells as day, i (i)}
    <div class="cell" class:empty={day === null} class:today={day !== null && `${month}-${String(day).padStart(2, '0')}` === today} role="gridcell">
      {#if day !== null}
        <span class="num">{day}</span>
        {#each byDay.get(day) ?? [] as e (e.name + e.amount)}
          <span class="entry" class:pos={e.amount > 0} class:neg={e.amount < 0}>
            {e.amount < 0 ? '−' : '+'}{formatCents(Math.abs(e.amount))} <small>{e.name}</small>
          </span>
        {/each}
      {/if}
    </div>
  {/each}
</div>

<section class="next">
  <h2>Next 7 days</h2>
  {#if next7.length === 0}
    <p class="muted">Nothing scheduled in the next 7 days.</p>
  {:else}
    <ul>
      {#each next7 as o (o.scheduled_id + o.date)}
        <li>
          <span>{o.date}</span>
          <span>{categoriesStore.categories.find((c) => c.id === o.category_id)?.name ?? 'Scheduled'}</span>
          <span class:pos={o.amount > 0} class:neg={o.amount < 0}>{formatCents(o.amount)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

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
    margin: 0 0 var(--space-2);
  }
  .banner {
    background: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-3);
    margin-bottom: var(--space-4);
    font-size: var(--font-size-sm);
  }
  .banner p {
    margin: 0 0 var(--space-2);
  }
  .banner ul {
    list-style: none;
    margin: 0 0 var(--space-2);
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .banner li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .link {
    background: none;
    border: none;
    color: var(--color-primary);
    cursor: pointer;
    padding: 0;
    font: inherit;
  }
  .legend {
    display: flex;
    gap: var(--space-4);
    font-size: var(--font-size-sm);
    margin-bottom: var(--space-2);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: var(--color-surface);
  }
  .dow {
    padding: var(--space-1);
    text-align: center;
    font-size: 0.7rem;
    color: var(--color-text-secondary);
    border-bottom: 1px solid var(--color-border);
  }
  .cell {
    min-height: 6rem;
    padding: var(--space-1);
    border-right: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.7rem;
    overflow: hidden;
  }
  .cell:nth-child(7n) {
    border-right: none;
  }
  .cell.empty {
    background: var(--color-surface-alt);
  }
  .cell.today .num {
    color: var(--color-primary);
    font-weight: 700;
  }
  .num {
    color: var(--color-text-secondary);
  }
  .entry {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .entry small {
    color: var(--color-text-secondary);
  }
  .pos {
    color: var(--color-positive);
  }
  .neg {
    color: var(--color-negative);
  }
  .next {
    margin-top: var(--space-6);
  }
  .next ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--font-size-sm);
  }
  .next li {
    display: grid;
    grid-template-columns: 7rem 1fr auto;
    gap: var(--space-3);
  }
  .muted {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  @media (max-width: 901px) {
    .cell {
      min-height: 4.5rem;
    }
  }
</style>
