<script lang="ts">
  import { budgetStore } from '$lib/stores/budget.svelte';
  import type { PayFrequency } from '$lib/domain/types';
  import { formatCents } from '$lib/domain/money';
  import { paysPerMonth, planForMonth } from '$lib/domain/budget';
  import { parseToCents } from '$lib/domain/money';
  import Dialog from '../ui/Dialog.svelte';
  import Button from '../ui/Button.svelte';

  let { open, onclose }: { open: boolean; onclose: () => void } = $props();

  const FREQUENCIES: Array<{ value: PayFrequency; label: string }> = [
    { value: 'once_monthly', label: 'once a month' },
    { value: 'twice_monthly', label: 'twice a month' },
    { value: 'biweekly', label: 'every 2 weeks' },
    { value: 'weekly', label: 'every week' }
  ];

  let mode = $state<'fixed' | 'variable'>('fixed');
  let payDollars = $state('');
  let frequency = $state<PayFrequency>('twice_monthly');
  let payDay = $state('15');
  let error = $state('');
  let lastOpen = false;

  $effect(() => {
    if (open && !lastOpen) {
      const plan = planForMonth(budgetStore.incomePlans, budgetStore.month);
      mode = plan?.mode ?? 'fixed';
      payDollars = plan && plan.mode === 'fixed' ? String(plan.pay_amount / 100) : '';
      frequency = plan?.frequency ?? 'twice_monthly';
      payDay = plan ? String(plan.pay_day) : '15';
      error = '';
    }
    lastOpen = open;
  });

  const monthlyTotal = $derived(
    Math.round((parseToCents(payDollars) ?? 0) * paysPerMonth(frequency))
  );

  async function save() {
    error = '';
    if (mode === 'variable') {
      await budgetStore.setIncomePlan({
        mode: 'variable',
        pay_amount: 0,
        frequency: 'once_monthly',
        pay_day: 1
      });
      onclose();
      return;
    }
    const cents = parseToCents(payDollars);
    if (cents === null || cents <= 0) {
      error = 'Enter a pay amount greater than 0.';
      return;
    }
    const day = Number(payDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      error = 'Pay day must be between 1 and 31.';
      return;
    }
    await budgetStore.setIncomePlan({ mode: 'fixed', pay_amount: cents, frequency, pay_day: day });
    onclose();
  }
</script>

<Dialog {open} title="Monthly income" {onclose}>
  <form
    class="form"
    onsubmit={(e) => {
      e.preventDefault();
      void save();
    }}
  >
    <div class="mode" role="group" aria-label="Income mode">
      <button type="button" class:on={mode === 'fixed'} onclick={() => (mode = 'fixed')}>Fixed</button>
      <button type="button" class:on={mode === 'variable'} onclick={() => (mode = 'variable')}>Variable</button>
    </div>

    {#if mode === 'fixed'}
      <p class="sentence">
        I get paid
        <input class="inline" inputmode="decimal" bind:value={payDollars} aria-label="Pay amount" placeholder="0.00" />
        <select class="inline" bind:value={frequency} aria-label="Pay frequency">
          {#each FREQUENCIES as f (f.value)}
            <option value={f.value}>{f.label}</option>
          {/each}
        </select>
        on the
        <input class="inline small" inputmode="numeric" bind:value={payDay} aria-label="Pay day" />
      </p>
      <p class="hint">Months shorter than your payday use the last day instead.</p>
      <p class="total">Monthly income <strong>{formatCents(monthlyTotal)}</strong></p>
    {:else}
      <p class="hint">
        Your income each month is what comes in that month, from your income transactions.
      </p>
    {/if}

    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="actions">
      <Button variant="secondary" onclick={onclose}>Cancel</Button>
      <Button type="submit">Update Income</Button>
    </div>
  </form>
</Dialog>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: min(420px, 90vw);
  }
  .mode {
    display: flex;
    gap: var(--space-2);
  }
  .mode button {
    flex: 1;
    padding: var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
  }
  .mode button.on {
    border-color: var(--color-primary);
    color: var(--color-primary);
    font-weight: 600;
  }
  .sentence {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
  }
  .inline {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    width: 7rem;
  }
  .inline.small {
    width: 4rem;
  }
  .hint,
  .total {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .total strong {
    color: var(--color-text);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  .error {
    color: var(--color-negative);
    margin: 0;
  }
</style>
