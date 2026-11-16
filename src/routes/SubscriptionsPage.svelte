<script lang="ts">
  import { subscriptionsStore } from '$lib/stores/subscriptions.svelte';
  import { formatCents, parseToCents } from '$lib/domain/money';
  import { annualTotal, upcomingCharges } from '$lib/domain/subscriptions';
  import { todayIso } from '$lib/utils/date';
  import type { SubscriptionCadence } from '$lib/domain/types';
  import Button from '$lib/components/ui/Button.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import Card from '$lib/components/ui/Card.svelte';

  const CADENCES: Array<{ value: SubscriptionCadence; label: string }> = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' }
  ];

  let addOpen = $state(false);
  let merchant = $state('');
  let amount = $state('');
  let cadence = $state<SubscriptionCadence>('monthly');
  let nextDate = $state(todayIso());
  let error = $state('');

  const today = todayIso();
  const weekEnd = $derived.by(() => {
    const d = new Date(today + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const strip = $derived(upcomingCharges(subscriptionsStore.subscriptions, today, weekEnd));
  const annual = $derived(annualTotal(subscriptionsStore.subscriptions));

  async function save() {
    error = '';
    const cents = parseToCents(amount);
    if (!merchant.trim() || cents === null || cents <= 0) {
      error = 'Enter a merchant and an amount greater than 0.';
      return;
    }
    await subscriptionsStore.add({ merchant_name: merchant, amount: cents, cadence, next_charge_date: nextDate });
    merchant = '';
    amount = '';
    addOpen = false;
  }
</script>

<header class="page-header">
  <h1>Subscriptions</h1>
  <Button onclick={() => (addOpen = true)}>Add subscription</Button>
</header>

<div class="top">
  <Card>
    <span class="label">Annual total</span>
    <strong class="big">{formatCents(annual)}</strong>
    <span class="muted">Based on {subscriptionsStore.subscriptions.length} tracked</span>
  </Card>
  <Card>
    <span class="label">Upcoming charges (next 7 days)</span>
    {#if strip.length === 0}
      <p class="muted">No charges this week.</p>
    {:else}
      <ul>
        {#each strip as s (s.id)}
          <li><span>{s.merchant_name}</span><span>{s.next_charge_date} · {formatCents(s.amount)}</span></li>
        {/each}
      </ul>
    {/if}
  </Card>
</div>

<section>
  <h2>Tracked subscriptions</h2>
  {#if subscriptionsStore.subscriptions.length === 0}
    <p class="muted">Nothing tracked yet. Add a subscription by hand.</p>
  {:else}
    <ul class="list">
      {#each subscriptionsStore.subscriptions as s (s.id)}
        <li>
          <span>{s.merchant_name}</span>
          <span class="muted">{CADENCES.find((c) => c.value === s.cadence)?.label} • next {s.next_charge_date}</span>
          <span>{formatCents(s.amount)}</span>
          <button class="link" onclick={() => void subscriptionsStore.remove(s.id)}>Remove</button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<Dialog open={addOpen} title="Add subscription" onclose={() => (addOpen = false)}>
  <form class="form" onsubmit={(e) => { e.preventDefault(); void save(); }}>
    <Field label="Merchant"><input bind:value={merchant} required /></Field>
    <Field label="Amount"><input inputmode="decimal" bind:value={amount} required /></Field>
    <Field label="How often">
      <select bind:value={cadence}>
        {#each CADENCES as c (c.value)}<option value={c.value}>{c.label}</option>{/each}
      </select>
    </Field>
    <Field label="Next charge date"><input type="date" bind:value={nextDate} /></Field>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="actions">
      <Button variant="secondary" onclick={() => (addOpen = false)}>Cancel</Button>
      <Button type="submit">Save</Button>
    </div>
  </form>
</Dialog>

<style>
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-4);
  }
  h1 {
    margin: 0;
  }
  h2 {
    font-size: var(--font-size-base);
  }
  .top {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }
  .top :global(.card) {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
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
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .top ul li {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-size-sm);
    padding: var(--space-1) 0;
  }
  .list li {
    display: grid;
    grid-template-columns: 1fr 1fr auto auto;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-top: 1px solid var(--color-border);
    font-size: var(--font-size-sm);
  }
  .muted {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  .link {
    background: none;
    border: none;
    color: var(--color-negative);
    cursor: pointer;
    padding: 0;
    font: inherit;
    font-size: var(--font-size-sm);
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: min(420px, 90vw);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  .error {
    color: var(--color-negative);
  }
  @media (max-width: 901px) {
    .top {
      grid-template-columns: 1fr;
    }
  }
</style>
