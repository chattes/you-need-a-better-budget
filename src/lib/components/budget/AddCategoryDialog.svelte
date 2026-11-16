<script lang="ts">
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import { budgetStore } from '$lib/stores/budget.svelte';
  import type { Category, CategoryCadence, CategoryDuration, RolloverMode } from '$lib/domain/types';
  import { parseToCents } from '$lib/domain/money';
  import { formatMonth } from '$lib/utils/date';
  import { showToast } from '../ui/Toast.svelte';
  import Dialog from '../ui/Dialog.svelte';
  import Button from '../ui/Button.svelte';
  import Field from '../ui/Field.svelte';

  let {
    open,
    onclose,
    editCategory = null
  }: { open: boolean; onclose: () => void; editCategory?: Category | null } = $props();

  const CADENCES: Array<{ value: CategoryCadence; label: string }> = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Every 2 weeks' },
    { value: 'semimonthly', label: 'Twice a month' },
    { value: 'bimonthly', label: 'Every 2 months' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' }
  ];

  let name = $state('');
  let groupId = $state('');
  let amount = $state('');
  let percentMode = $state(false);
  let percent = $state('');
  let cadence = $state<CategoryCadence>('monthly');
  let dueDay = $state('');
  let rollover = $state<RolloverMode>('starts_fresh');
  let duration = $state<CategoryDuration>('ongoing');
  let note = $state('');
  let advancedOpen = $state(false);
  let error = $state('');

  let lastOpen = false;
  $effect(() => {
    if (open && !lastOpen) {
      const c = editCategory;
      name = c?.name ?? '';
      groupId = c?.group_id ?? '';
      amount = c?.monthly_target != null ? String(c.monthly_target / 100) : '';
      percentMode = c?.target_percent != null;
      percent = c?.target_percent != null ? String(c.target_percent) : '';
      cadence = c?.cadence ?? 'monthly';
      dueDay = c?.due_day != null ? String(c.due_day) : '';
      rollover = c?.rollover_mode ?? 'starts_fresh';
      duration = c?.duration ?? 'ongoing';
      note = c?.note ?? '';
      advancedOpen = Boolean(c && (c.note || c.rollover_mode !== 'starts_fresh' || c.duration !== 'ongoing'));
      error = '';
    }
    lastOpen = open;
  });

  const monthLabel = $derived(formatMonth(budgetStore.month));

  async function save() {
    error = '';
    if (!name.trim()) {
      error = 'Enter a category name.';
      return;
    }
    let monthly: number | null = null;
    let pct: number | null = null;
    if (percentMode) {
      const p = Number(percent);
      if (percent !== '' && (Number.isNaN(p) || p < 0 || p > 100)) {
        error = 'Enter a percent from 0 to 100.';
        return;
      }
      pct = percent === '' ? null : p;
    } else if (amount.trim() !== '') {
      const cents = parseToCents(amount);
      if (cents === null || cents < 0) {
        error = 'Enter an amount of 0 or more.';
        return;
      }
      monthly = cents;
    }
    let due: number | null = null;
    if (dueDay.trim() !== '') {
      const d = Number(dueDay);
      if (!Number.isInteger(d) || d < 1 || d > 31) {
        error = 'Payment day must be between 1 and 31.';
        return;
      }
      due = d;
    }
    const patch = {
      group_id: groupId || null,
      name: name.trim(),
      monthly_target: monthly,
      target_percent: pct,
      cadence,
      due_day: due,
      rollover_mode: rollover,
      duration,
      duration_month: duration === 'this_month_only' ? budgetStore.month : null,
      note
    };
    if (editCategory) {
      await categoriesStore.update(editCategory.id, patch);
    } else {
      await categoriesStore.add(patch);
      if (monthly === null && pct === null) {
        showToast('Category created. It has no budget yet. Set one any time from its row.');
      }
    }
    onclose();
  }
</script>

<Dialog {open} title={editCategory ? 'Edit category' : 'Add category'} {onclose}>
  <form
    class="form"
    onsubmit={(e) => {
      e.preventDefault();
      void save();
    }}
  >
    <div class="amount-row">
      {#if percentMode}
        <Field label="Percent of income">
          <input inputmode="decimal" bind:value={percent} placeholder="0" />
        </Field>
      {:else}
        <Field label="Amount">
          <input inputmode="decimal" bind:value={amount} placeholder="Not budgeted" />
        </Field>
      {/if}
      <label class="switch">
        <input type="checkbox" bind:checked={percentMode} />
        <span>Set a % of income</span>
      </label>
    </div>
    <Field label="Category name"><input bind:value={name} required /></Field>
    <Field label="Group">
      <select bind:value={groupId}>
        <option value="">Ungrouped</option>
        {#each categoriesStore.groups as g (g.id)}
          <option value={g.id}>{g.name}</option>
        {/each}
      </select>
    </Field>
    <Field label="How often">
      <select bind:value={cadence}>
        {#each CADENCES as c (c.value)}
          <option value={c.value}>{c.label}</option>
        {/each}
      </select>
    </Field>
    <Field label="Payment day (optional)">
      <input inputmode="numeric" bind:value={dueDay} placeholder="1–31" />
    </Field>

    <details bind:open={advancedOpen}>
      <summary>Advanced options</summary>
      <div class="advanced">
        <fieldset class="radio-group">
          <legend>When a month ends</legend>
          <label><input type="radio" bind:group={rollover} value="starts_fresh" /> Starts fresh (same amount each period)</label>
          <label><input type="radio" bind:group={rollover} value="rolls_over" /> Rolls over (balance builds)</label>
        </fieldset>
        <fieldset class="radio-group">
          <legend>Duration</legend>
          <label><input type="radio" bind:group={duration} value="ongoing" /> Ongoing</label>
          <label><input type="radio" bind:group={duration} value="this_month_only" /> This month only ({monthLabel})</label>
        </fieldset>
        <Field label="Note (optional)"><input bind:value={note} /></Field>
      </div>
    </details>

    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="actions">
      <Button variant="secondary" onclick={onclose}>Cancel</Button>
      <Button type="submit">{editCategory ? 'Save' : 'Save Category'}</Button>
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
  .amount-row {
    display: flex;
    gap: var(--space-3);
    align-items: flex-end;
  }
  .amount-row :global(.field) {
    flex: 1;
  }
  .switch {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    white-space: nowrap;
    padding-bottom: var(--space-2);
  }
  .advanced {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-top: var(--space-3);
  }
  .radio-group {
    border: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--font-size-sm);
  }
  .radio-group legend {
    font-weight: 600;
    margin-bottom: var(--space-1);
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
