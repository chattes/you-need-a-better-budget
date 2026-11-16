<script lang="ts">
  import { goalsStore } from '$lib/stores/goals.svelte';
  import { budgetStore } from '$lib/stores/budget.svelte';
  import { calculateSavingsProgress, calculateDebtPayoffPlan } from '$lib/domain/goals';
  import { formatCents, parseToCents } from '$lib/domain/money';
  import { formatMonth } from '$lib/utils/date';
  import type { Goal, PayoffStrategy } from '$lib/domain/types';
  import Button from '$lib/components/ui/Button.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Field from '$lib/components/ui/Field.svelte';

  let addOpen = $state(false);
  let planOpen = $state(false);
  let extraDollars = $state('');
  let strategy = $state<PayoffStrategy>('avalanche');
  let contributing = $state<string | null>(null);
  let contributeDollars = $state('');
  let error = $state('');

  // Add Goal form state
  let type = $state<'savings' | 'debt_payoff'>('savings');
  let name = $state('');
  let targetDollars = $state('');
  let savedDollars = $state('0');
  let monthlyDollars = $state('');
  let targetDate = $state('');
  let aprPercent = $state('');
  let minPaymentDollars = $state('');
  let description = $state('');

  const savings = $derived(goalsStore.goals.filter((g) => g.type === 'savings' && !g.deleted_at));
  const debts = $derived(goalsStore.goals.filter((g) => g.type === 'debt_payoff' && !g.deleted_at));
  const debtBalance = (g: Goal) => Math.max(g.target_amount - g.saved_so_far, 0);
  const debtTotal = $derived(debts.reduce((s, g) => s + debtBalance(g), 0));
  const fromMonth = $derived(budgetStore.month);

  function statusFor(g: Goal) {
    const p = calculateSavingsProgress(g, new Date(fromMonth + '-01T00:00:00Z'));
    let status = 'On Track';
    if (!p.completionMonth) status = 'Set a monthly contribution';
    else if (g.target_date && p.completionMonth > g.target_date.slice(0, 7)) status = 'Behind';
    return { ...p, status };
  }

  const plan = $derived(
    calculateDebtPayoffPlan(debts, (parseToCents(extraDollars) ?? 0), strategy)
  );

  async function createGoal() {
    error = '';
    const target = parseToCents(targetDollars);
    if (!name.trim() || target === null || target <= 0) {
      error = 'Enter a name and a target amount greater than 0.';
      return;
    }
    const saved = parseToCents(savedDollars) ?? 0;
    const monthly = parseToCents(monthlyDollars) ?? 0;
    if (type === 'savings') {
      await goalsStore.add({
        name,
        type: 'savings',
        target_amount: target,
        saved_so_far: saved,
        monthly_contribution: monthly,
        target_date: targetDate || null,
        description
      });
    } else {
      const apr = Math.round(Number(aprPercent || '0') * 100);
      await goalsStore.add({
        name,
        type: 'debt_payoff',
        target_amount: target,
        saved_so_far: saved,
        monthly_contribution: 0,
        debt_apr: apr,
        debt_min_payment: parseToCents(minPaymentDollars) ?? 0,
        description
      });
    }
    name = '';
    targetDollars = '';
    savedDollars = '0';
    monthlyDollars = '';
    targetDate = '';
    aprPercent = '';
    minPaymentDollars = '';
    description = '';
    addOpen = false;
  }

  async function submitContribution(g: Goal) {
    const cents = parseToCents(contributeDollars);
    if (cents === null || cents <= 0) {
      error = 'Enter an amount greater than 0.';
      return;
    }
    await goalsStore.contribute(g.id, cents);
    contributing = null;
    contributeDollars = '';
    error = '';
  }
</script>

<header class="page-header">
  <h1>Goals</h1>
  <Button onclick={() => (addOpen = true)}>Add Goal</Button>
</header>

<section aria-labelledby="savings-h">
  <h2 id="savings-h">Savings • {savings.length}</h2>
  {#if savings.length === 0}
    <p class="muted">No savings goals yet.</p>
  {/if}
  <div class="cards">
    {#each savings as g (g.id)}
      {@const s = statusFor(g)}
      <article class="card">
        <div class="head">
          <strong>{g.name}</strong>
          <span class="status" class:behind={s.status === 'Behind'}>{s.status}</span>
        </div>
        {#if g.description}<p class="muted">{g.description}</p>{/if}
        <p>{formatCents(g.saved_so_far)} saved of {formatCents(g.target_amount)} • {Math.round(s.percent)}%</p>
        <div class="bar"><i style="width:{s.percent}%"></i></div>
        <p class="muted">
          Monthly contribution {formatCents(g.monthly_contribution)}/mo
          •
          {#if g.target_date}Target date {g.target_date}{:else if s.completionMonth}Estimated completion {formatMonth(s.completionMonth)}{:else}No estimate{/if}
        </p>
        {#if contributing === g.id}
          <form class="inline" onsubmit={(e) => { e.preventDefault(); void submitContribution(g); }}>
            <input inputmode="decimal" bind:value={contributeDollars} placeholder="Amount" aria-label="Contribution amount" />
            <Button type="submit">Save</Button>
            <Button variant="secondary" onclick={() => (contributing = null)}>Cancel</Button>
          </form>
        {:else}
          <Button variant="secondary" onclick={() => (contributing = g.id)}>Contribute</Button>
        {/if}
      </article>
    {/each}
  </div>
</section>

<section aria-labelledby="debt-h">
  <div class="debt-head">
    <h2 id="debt-h">Debt payoff</h2>
    <Button variant="secondary" onclick={() => (planOpen = true)}>Set Up Plan</Button>
  </div>
  <p class="muted">Your {debts.length} {debts.length === 1 ? 'debt' : 'debts'} total {formatCents(debtTotal)}.</p>
  <div class="cards">
    {#each debts as g (g.id)}
      <article class="card">
        <div class="head"><strong>{g.name}</strong><span>{formatCents(debtBalance(g))}</span></div>
        <p class="muted">APR {(g.debt_apr / 100).toFixed(2)}% • minimum {formatCents(g.debt_min_payment)}/mo</p>
        {#if contributing === g.id}
          <form class="inline" onsubmit={(e) => { e.preventDefault(); void submitContribution(g); }}>
            <input inputmode="decimal" bind:value={contributeDollars} placeholder="Payment" aria-label="Payment amount" />
            <Button type="submit">Save</Button>
            <Button variant="secondary" onclick={() => (contributing = null)}>Cancel</Button>
          </form>
        {:else}
          <Button variant="secondary" onclick={() => (contributing = g.id)}>Log payment</Button>
        {/if}
      </article>
    {/each}
  </div>
</section>

{#if error}<p class="error" role="alert">{error}</p>{/if}

<Dialog open={addOpen} title="Add goal" onclose={() => (addOpen = false)}>
  <form class="form" onsubmit={(e) => { e.preventDefault(); void createGoal(); }}>
    <div class="chips" role="group" aria-label="Goal type">
      <button type="button" class:on={type === 'savings'} onclick={() => (type = 'savings')}>Savings</button>
      <button type="button" class:on={type === 'debt_payoff'} onclick={() => (type = 'debt_payoff')}>Debt Payoff</button>
    </div>
    <Field label="Name"><input bind:value={name} required /></Field>
    <Field label="Target amount"><input inputmode="decimal" bind:value={targetDollars} required /></Field>
    <Field label={type === 'savings' ? 'Saved so far' : 'Balance already paid'}><input inputmode="decimal" bind:value={savedDollars} /></Field>
    {#if type === 'savings'}
      <Field label="Monthly contribution"><input inputmode="decimal" bind:value={monthlyDollars} placeholder="200" /></Field>
      <Field label="Target date (optional)"><input type="date" bind:value={targetDate} /></Field>
    {:else}
      <Field label="APR %"><input inputmode="decimal" bind:value={aprPercent} placeholder="19.99" /></Field>
      <Field label="Minimum payment"><input inputmode="decimal" bind:value={minPaymentDollars} /></Field>
    {/if}
    <Field label="Description (optional)"><input bind:value={description} /></Field>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="actions">
      <Button variant="secondary" onclick={() => (addOpen = false)}>Cancel</Button>
      <Button type="submit">Create Goal</Button>
    </div>
  </form>
</Dialog>

<Dialog open={planOpen} title="Debt payoff plan" onclose={() => (planOpen = false)}>
  <div class="form">
    <Field label="Extra payment per month"><input inputmode="decimal" bind:value={extraDollars} placeholder="0" /></Field>
    <div class="chips" role="group" aria-label="Strategy">
      <button type="button" class:on={strategy === 'avalanche'} onclick={() => (strategy = 'avalanche')}>Highest APR first</button>
      <button type="button" class:on={strategy === 'snowball'} onclick={() => (strategy = 'snowball')}>Smallest balance first</button>
    </div>
    {#if debts.length === 0}
      <p class="muted">Add a debt first.</p>
    {:else}
      <ol>
        {#each plan.order as d (d.id)}<li>{d.name}</li>{/each}
      </ol>
      <p>Debt-free in {plan.monthsToFreedom} months. Estimated interest {formatCents(plan.totalInterest)}.</p>
    {/if}
  </div>
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
    margin: var(--space-4) 0 var(--space-2);
  }
  .debt-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space-4);
  }
  .card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .card p {
    margin: 0;
    font-size: var(--font-size-sm);
  }
  .head {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .status {
    font-size: 0.75rem;
    color: var(--color-positive);
  }
  .status.behind {
    color: var(--color-negative);
  }
  .bar {
    height: 8px;
    background: var(--color-surface-alt);
    border-radius: 4px;
    overflow: hidden;
  }
  .bar i {
    display: block;
    height: 100%;
    background: var(--color-positive);
  }
  .inline {
    display: flex;
    gap: var(--space-2);
  }
  .inline input {
    flex: 1;
    min-width: 0;
  }
  .muted {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: min(420px, 90vw);
  }
  .chips {
    display: flex;
    gap: var(--space-2);
  }
  .chips button {
    flex: 1;
    padding: var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    font: inherit;
  }
  .chips button.on {
    border-color: var(--color-primary);
    color: var(--color-primary);
    font-weight: 600;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  .error {
    color: var(--color-negative);
  }
</style>
