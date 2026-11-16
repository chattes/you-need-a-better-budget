<script lang="ts">
  import { accountsStore } from '$lib/stores/accounts.svelte';
  import { categoriesStore } from '$lib/stores/categories.svelte';
  import { transactionsStore } from '$lib/stores/transactions.svelte';
  import { scheduledStore } from '$lib/stores/scheduled.svelte';
  import { goalsStore } from '$lib/stores/goals.svelte';
  import { labelsStore } from '$lib/stores/rules.svelte';
  import type { RepeatCadence, TransactionType } from '$lib/domain/types';
  import { parseToCents, formatCents } from '$lib/domain/money';
  import { normalizeSplitAmounts } from '$lib/domain/splits';
  import { blankSplitRows, splitStateForType } from '$lib/domain/split-mode';
  import { todayIso } from '$lib/utils/date';
  import Dialog from '../ui/Dialog.svelte';
  import Button from '../ui/Button.svelte';
  import Field from '../ui/Field.svelte';

  let { open, onclose, presetAccountId = '' }: { open: boolean; onclose: () => void; presetAccountId?: string } = $props();

  const TYPES: Array<{ value: TransactionType; label: string; note?: string }> = [
    { value: 'expense', label: 'Expense' },
    { value: 'income', label: 'Income' },
    { value: 'reimbursement', label: 'Reimbursement' },
    { value: 'refund', label: 'Refund' },
    { value: 'transfer', label: 'Transfer', note: 'Excluded from budget calculations.' }
  ];

  const CADENCES: Array<{ value: RepeatCadence; label: string }> = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Every 2 weeks' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' }
  ];

  let type = $state<TransactionType>('expense');
  let amount = $state('');
  let description = $state('');
  let categoryId = $state('');
  let dateMode = $state<'today' | 'yesterday' | 'pick'>('today');
  let pickedDate = $state(todayIso());
  let accountId = $state('');
  let toAccountId = $state('');
  let goalId = $state('');
  let repeat = $state(false);
  let cadence = $state<RepeatCadence>('monthly');
  let excluded = $state(false);
  let tagsText = $state('');
  let notes = $state('');
  let splitMode = $state(false);
  let splits = $state<Array<{ category_id: string; amount: string }>>([
    { category_id: '', amount: '' },
    { category_id: '', amount: '' }
  ]);
  let advancedOpen = $state(false);
  let error = $state('');
  let lastOpen = false;

  $effect(() => {
    if (open && !lastOpen) {
      type = 'expense';
      amount = '';
      description = '';
      categoryId = '';
      dateMode = 'today';
      pickedDate = todayIso();
      accountId = presetAccountId || accountsStore.accounts[0]?.id || '';
      toAccountId = '';
      goalId = '';
      repeat = false;
      excluded = false;
      tagsText = '';
      notes = '';
      splitMode = false;
      splits = blankSplitRows();
      error = '';
    }
    lastOpen = open;
  });

  const accounts = $derived(accountsStore.accounts.filter((a) => !a.deleted_at && !a.is_closed));
  const categories = $derived(categoriesStore.activeCategories);
  const goals = $derived(goalsStore.goals);
  const isTransfer = $derived(type === 'transfer');

  // Split is expense-only. Changing type to Income or Transfer drops split and its rows.
  function selectType(next: TransactionType) {
    type = next;
    const state = splitStateForType(next, splitMode, splits);
    splitMode = state.splitMode;
    splits = state.splits;
  }
  const dateValue = $derived(
    dateMode === 'today'
      ? todayIso()
      : dateMode === 'yesterday'
        ? shiftDay(todayIso(), -1)
        : pickedDate
  );

  function shiftDay(iso: string, days: number): string {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  const totalCents = $derived(parseToCents(amount) ?? 0);
  const splitSum = $derived(splits.reduce((s, r) => s + (parseToCents(r.amount) ?? 0), 0));
  const remainingToAllocate = $derived(totalCents - splitSum);

  function splitEvenly() {
    const n = splits.length;
    if (n === 0 || totalCents === 0) return;
    const base = Math.floor(totalCents / n);
    const extra = totalCents - base * n;
    splits = splits.map((r, i) => ({ ...r, amount: ((base + (i < extra ? 1 : 0)) / 100).toFixed(2) }));
  }

  function addSplitRow() {
    splits = [...splits, { category_id: '', amount: '' }];
  }

  async function save() {
    error = '';
    const cents = parseToCents(amount);
    if (cents === null || cents <= 0) {
      error = 'Enter an amount greater than 0.';
      return;
    }
    if (!accountId) {
      error = 'Pick an account.';
      return;
    }
    if (isTransfer) {
      if (!toAccountId || toAccountId === accountId) {
        error = 'Pick two different accounts for the transfer.';
        return;
      }
      await transactionsStore.addTransfer({
        date: dateValue,
        amount: cents,
        from_account_id: accountId,
        to_account_id: toAccountId,
        description
      });
      onclose();
      return;
    }

    const signed = type === 'expense' ? -cents : cents;
    // A categorization rule fills the category when none was picked.
    if (type === 'expense' && !categoryId && !splitMode) {
      categoryId = labelsStore.matchRule(description)?.category_id ?? '';
    }
    const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);

    if (splitMode && type === 'expense') {
      const magnitudes = splits.map((r) => parseToCents(r.amount) ?? 0);
      if (splits.some((r) => !r.category_id)) {
        error = 'Pick a category for every split.';
        return;
      }
      if (magnitudes.reduce((s, m) => s + m, 0) !== cents) {
        error = `Splits add up to ${formatCents(magnitudes.reduce((s, m) => s + m, 0))}; transaction total is ${formatCents(cents)}.`;
        return;
      }
      const signedSplits = normalizeSplitAmounts(signed, magnitudes).map((amt, i) => ({
        category_id: splits[i]!.category_id,
        amount: amt,
        memo: ''
      }));
      const parent = await transactionsStore.addSplit(
        {
          date: dateValue,
          amount: signed,
          account_id: accountId,
          category_id: null,
          type,
          description,
          notes,
          tags,
          excluded_from_budget: excluded
        },
        signedSplits
      );
      if (!parent) {
        error = 'Splits must add up to the transaction total.';
        return;
      }
    } else {
      await transactionsStore.add({
        date: dateValue,
        amount: signed,
        account_id: accountId,
        category_id: type === 'expense' ? categoryId || null : null,
        type,
        description,
        notes,
        tags,
        goal_id: goalId || null,
        excluded_from_budget: excluded
      });
    }

    if (repeat) {
      const next = nextRepeatDate(dateValue, cadence);
      await scheduledStore.add({
        name: description || 'Repeating',
        amount: signed,
        account_id: accountId,
        category_id: categoryId,
        cadence,
        next_date: next
      });
    }
    onclose();
  }

  function nextRepeatDate(iso: string, c: RepeatCadence): string {
    const days = c === 'weekly' ? 7 : c === 'biweekly' ? 14 : 0;
    if (days) return shiftDay(iso, days);
    const months = c === 'quarterly' ? 3 : c === 'yearly' ? 12 : 1;
    const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
    const base = new Date(Date.UTC(y, m - 1 + months, 1));
    const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
    base.setUTCDate(Math.min(d, last));
    return base.toISOString().slice(0, 10);
  }
</script>

<Dialog {open} title="Add transaction" {onclose}>
  <form
    class="form"
    onsubmit={(e) => {
      e.preventDefault();
      void save();
    }}
  >
    <div class="chips" role="group" aria-label="Type">
      {#each TYPES as t (t.value)}
        <button type="button" class:on={type === t.value} onclick={() => selectType(t.value)}>{t.label}</button>
      {/each}
    </div>
    {#if isTransfer}
      <p class="note">Excluded from budget calculations.</p>
    {/if}

    <Field label={isTransfer ? 'Amount to move' : type === 'expense' ? 'Amount (spent)' : 'Amount'}>
      <span class="sign">{type === 'expense' ? '−$' : '+$'}</span>
      <input inputmode="decimal" bind:value={amount} placeholder="0.00" required />
    </Field>

    <Field label="Description (optional)"><input bind:value={description} /></Field>

    {#if type === 'expense'}
      <div class="split-toggle">
        <label><input type="checkbox" bind:checked={splitMode} /> Split across categories</label>
      </div>
      {#if !splitMode && type === 'expense'}
        <Field label="Category">
          <select bind:value={categoryId}>
            <option value="">No category</option>
            {#each categories as c (c.id)}
              <option value={c.id}>{c.name}</option>
            {/each}
          </select>
        </Field>
      {/if}
      {#if splitMode && type === 'expense'}
        <div class="splits">
          {#each splits as row, i (i)}
            <div class="split-row">
              <select bind:value={row.category_id} aria-label="Split category">
                <option value="">Category…</option>
                {#each categories as c (c.id)}
                  <option value={c.id}>{c.name}</option>
                {/each}
              </select>
              <input inputmode="decimal" bind:value={row.amount} placeholder="0.00" aria-label="Split amount" />
            </div>
          {/each}
          <div class="split-actions">
            <button type="button" onclick={splitEvenly}>Split evenly</button>
            <button type="button" onclick={addSplitRow}>Add another split</button>
          </div>
          <p class="counter" class:neg={remainingToAllocate !== 0}>
            {formatCents(remainingToAllocate)} remaining to allocate · {formatCents(splitSum)} / {formatCents(totalCents)}
          </p>
        </div>
      {/if}
    {/if}

    <Field label="Date">
      <div class="chips" role="group" aria-label="Date">
        <button type="button" class:on={dateMode === 'today'} onclick={() => (dateMode = 'today')}>Today</button>
        <button type="button" class:on={dateMode === 'yesterday'} onclick={() => (dateMode = 'yesterday')}>Yesterday</button>
        <button type="button" class:on={dateMode === 'pick'} onclick={() => (dateMode = 'pick')}>Pick a date</button>
      </div>
      {#if dateMode === 'pick'}
        <input type="date" bind:value={pickedDate} />
      {:else}
        <span class="hint">{dateValue}</span>
      {/if}
    </Field>

    <details bind:open={advancedOpen}>
      <summary>Advanced options</summary>
      <div class="advanced">
        <Field label={isTransfer ? 'From account' : 'Account'}>
          <select bind:value={accountId}>
            {#each accounts as a (a.id)}
              <option value={a.id}>{a.name}</option>
            {/each}
          </select>
        </Field>
        {#if isTransfer}
          <Field label="To account">
            <select bind:value={toAccountId}>
              <option value="">Choose…</option>
              {#each accounts as a (a.id)}
                <option value={a.id}>{a.name}</option>
              {/each}
            </select>
          </Field>
        {:else}
          <Field label="Goal">
            <select bind:value={goalId}>
              <option value="">None</option>
              {#each goals as g (g.id)}
                <option value={g.id}>{g.name}</option>
              {/each}
            </select>
          </Field>
          <label class="switch"><input type="checkbox" bind:checked={repeat} /> Repeat this transaction</label>
          {#if repeat}
            <Field label="How often">
              <select bind:value={cadence}>
                {#each CADENCES as c (c.value)}
                  <option value={c.value}>{c.label}</option>
                {/each}
              </select>
            </Field>
          {/if}
        {/if}
        <label class="switch"><input type="checkbox" bind:checked={excluded} /> Exclude from budget</label>
        <Field label="Tags (comma separated)"><input bind:value={tagsText} /></Field>
        <Field label="Notes"><input bind:value={notes} /></Field>
      </div>
    </details>

    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="actions">
      <Button variant="secondary" onclick={onclose}>Cancel</Button>
      <Button type="submit">Add</Button>
    </div>
  </form>
</Dialog>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: min(460px, 90vw);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .chips button {
    padding: var(--space-1) var(--space-3);
    border-radius: 999px;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    font-size: var(--font-size-sm);
    cursor: pointer;
  }
  .chips button.on {
    border-color: var(--color-primary);
    color: var(--color-primary);
    font-weight: 600;
  }
  .sign {
    font-weight: 600;
    margin-right: var(--space-1);
  }
  .note,
  .hint {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .split-row {
    display: grid;
    grid-template-columns: 1fr 8rem;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  .split-actions {
    display: flex;
    gap: var(--space-3);
    font-size: var(--font-size-sm);
  }
  .split-actions button {
    background: none;
    border: none;
    color: var(--color-primary);
    cursor: pointer;
    padding: 0;
    font: inherit;
  }
  .counter {
    font-size: var(--font-size-sm);
    margin: var(--space-2) 0 0;
  }
  .advanced {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-top: var(--space-3);
  }
  .switch {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  .error,
  .neg {
    color: var(--color-negative);
  }
  .error {
    margin: 0;
  }
</style>
